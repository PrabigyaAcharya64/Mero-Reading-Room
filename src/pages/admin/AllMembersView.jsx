import React, { useState, useEffect } from 'react';

import UserDetailView from './UserDetailView';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { formatBalance } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/dateFormat';
import { useLoading } from '../../context/GlobalLoadingContext';
import { Search, Edit2, User, ChevronRight, AlertCircle, Clock, CheckCircle, BadgeAlert } from 'lucide-react';
import { useAdminHeader } from '../../context/AdminHeaderContext';
import '../../styles/StandardLayout.css';
import '../../styles/AllMembersView.css';

function AllMembersView({ onBack, onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [seatAssignmentsMap, setSeatAssignmentsMap] = useState({});
    const [hostelAssignmentsMap, setHostelAssignmentsMap] = useState({});

    // Set loading true on mount (handles page refresh case)
    useEffect(() => {
        setIsLoading(true);
    }, []);

    useEffect(() => {
        const usersQ = query(collection(db, 'users'), where('verified', '==', true));
        const seatsRef = collection(db, 'seatAssignments');
        const hostelRef = collection(db, 'hostelAssignments');

        let seatsLoaded = false;
        let hostelLoaded = false;
        let usersLoaded = false;

        const checkIfLoaded = () => {
            if (seatsLoaded && hostelLoaded && usersLoaded) {
                onDataLoaded?.();
            }
        };

        // Real-time listeners
        const seatUnsub = onSnapshot(seatsRef, (snapshot) => {
            const map = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.userId) map[data.userId] = data;
            });
            setSeatAssignmentsMap(map);
            seatsLoaded = true;
            checkIfLoaded();
        });

        const hostelUnsub = onSnapshot(hostelRef, (snapshot) => {
            const map = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.userId) map[data.userId] = data;
            });
            setHostelAssignmentsMap(map);
            hostelLoaded = true;
            checkIfLoaded();
        });

        const userUnsub = onSnapshot(usersQ, (snapshot) => {
            const userData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setUsers(userData);
            usersLoaded = true;
            checkIfLoaded();
        }, (error) => {
            console.error("Error fetching users:", error);
        });

        return () => {
            seatUnsub();
            hostelUnsub();
            userUnsub();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredUsers = users.filter((u) => {
        const lowerQ = searchQuery.toLowerCase();
        return (u.name?.toLowerCase().includes(lowerQ) ||
            u.email?.toLowerCase().includes(lowerQ) ||
            u.mrrNumber?.toLowerCase().includes(lowerQ));
    });

    // Pagination Logic
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

    // Reset to page 1 when search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const handleEditUser = (user) => setSelectedUser(user);
    const handleCloseModal = () => setSelectedUser(null);
    const handleUserUpdate = () => { /* User updated callback */ };

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        // Scroll to top of table or container for better UX
        const container = document.querySelector('.std-body');
        if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const { setHeader } = useAdminHeader();

    useEffect(() => {
        setHeader({
            actionBar: (
                <div className="amv-search-wrapper" style={{ marginBottom: '0' }}>
                    <input
                        type="text"
                        placeholder="Search by Name, Email or MRR ID..."
                        className="amv-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search className="amv-search-icon" size={20} />
                </div>
            )
        });
    }, [setHeader, searchQuery, setSearchQuery]);

    // Calculate Status Helper
    const parseDate = (val) => {
        if (!val) return null;
        if (typeof val?.toDate === 'function') return val.toDate(); // Firestore Timestamp
        if (val instanceof Date) return val;
        if (typeof val === 'number') {
            // Check if likely seconds or ms. If small, assume seconds.
            // 2000-01-01 is 946684800.
            if (val < 10000000000) return new Date(val * 1000);
            return new Date(val);
        }
        return new Date(val); // String or other
    };

    const getServiceStatus = (assignment, isReadingRoom, user) => {
        // If not assigned
        if (!assignment) {
            // Check History for "Old" status
            // Reading Room: registrationCompleted (from readingRoomEnrollment)
            // Hostel: hostelRegistrationPaid (from HostelPurchase)
            const hasHistory = isReadingRoom
                ? (user.registrationCompleted === true)
                : (user.hostelRegistrationPaid === true);

            if (hasHistory) {
                return { label: 'Old', className: 'amv-badge old', icon: <Clock size={12} />, date: null };
            }
            return { label: 'Never Joined', className: 'amv-badge none', icon: <User size={12} />, date: null };
        }

        const dueDate = parseDate(assignment.nextPaymentDue);

        // Handle invalid/missing date for active assignments
        if (!dueDate || isNaN(dueDate.getTime())) {
            // If they have an assignment but no valid date, treat as Active or Special
            // e.g. "Lifetime" or "No Expiry"
            return {
                label: 'Active',
                className: 'amv-badge active',
                icon: <CheckCircle size={12} />,
                date: null,
                dateLabel: 'No Expiry'
            };
        }

        const today = new Date();
        const oneDay = 1000 * 60 * 60 * 24;
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / oneDay);

        // Logic Definition:
        // Active: > 3 days remaining.
        // Due Incoming: 3 days or less remaining (including today 0).
        // Grace Period: expired up to 3 days ago (-1, -2, -3).
        // Overdue: expired more than 3 days ago (<-3).

        let status = { label: '', className: '', icon: null, date: dueDate, dateLabel: '' };

        if (diffDays > 3) {
            status = {
                label: 'Active',
                className: 'amv-badge active',
                icon: <CheckCircle size={12} />,
                date: dueDate,
                dateLabel: 'Due'
            };
        } else if (diffDays >= 0) {
            status = {
                label: 'Due Incoming',
                className: 'amv-badge warning',
                icon: <AlertCircle size={12} />,
                date: dueDate,
                dateLabel: 'Due'
            };
        } else if (diffDays >= -3) {
            status = {
                label: 'Grace Period',
                className: 'amv-badge danger',
                icon: <BadgeAlert size={12} />,
                date: dueDate,
                dateLabel: 'Expired'
            };
        } else {
            status = {
                label: 'Overdue',
                className: 'amv-badge overdue',
                icon: <BadgeAlert size={12} />,
                date: dueDate,
                dateLabel: 'Expired'
            };
        }
        return status;
    };

    return (
        <div className="amv-container">
            <main className="std-body">
                <div className="amv-stats" style={{ marginBottom: '16px', display: 'inline-block' }}>
                    {filteredUsers.length} total • Page {currentPage} of {totalPages || 1}
                </div>

                {paginatedUsers.length === 0 && users.length > 0 ? (
                    <div className="amv-empty">
                        <User size={48} className="amv-empty-icon" />
                        <p>No members match your search.</p>
                    </div>
                ) : (
                    <>
                        <div className="amv-table-wrapper">
                            <table className="amv-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '250px' }}>Identity</th>
                                        <th>MRR ID</th>
                                        <th>Balance</th>
                                        <th>Loan</th>
                                        <th>Reading Room</th>
                                        <th>Hostel</th>
                                        <th style={{ textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers.map(user => {
                                        const rrAssignment = seatAssignmentsMap[user.id];
                                        const hostelAssignment = hostelAssignmentsMap[user.id];

                                        const rrStatus = getServiceStatus(rrAssignment, true, user);
                                        const hostelStatus = getServiceStatus(hostelAssignment, false, user);

                                        // "Due Users" logic: Negative balance implies they owe money
                                        const isDue = (user.balance || 0) < 0;

                                        return (
                                            <tr key={user.id}>
                                                <td>
                                                    <div className="amv-user-cell">
                                                        <div className="amv-avatar">
                                                            {user.profileImage || user.photoUrl || user.image ? (
                                                                <img
                                                                    src={user.profileImage || user.photoUrl || user.image}
                                                                    alt={user.name}
                                                                    referrerPolicy="no-referrer"
                                                                />
                                                            ) : (
                                                                <div className="amv-avatar-fallback">
                                                                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="amv-user-info">
                                                            <span className="amv-user-name">{user.name || 'Anonymous Reader'}</span>
                                                            <span className="amv-user-email">{user.email || '-'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="amv-mrr-code">{user.mrrNumber || '-'}</span>
                                                </td>
                                                <td>
                                                    {isDue ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span className="amv-badge overdue" style={{ marginBottom: '2px', fontSize: '10px' }}>Due Payment</span>
                                                            <span className="amv-balance negative" style={{ color: '#dc2626', fontWeight: 'bold' }}>
                                                                {formatBalance(user.balance || 0)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="amv-balance">{formatBalance(user.balance || 0)}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {user.loan?.has_active_loan ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span className="amv-badge active" style={{ fontSize: '10px', width: 'fit-content' }}>Active Loan</span>
                                                            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                                                                {formatBalance(user.loan.current_balance)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="amv-text-muted">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="status-cell">
                                                        <span className={rrStatus.className} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            {rrStatus.icon} {rrStatus.label}
                                                        </span>
                                                        {rrStatus.date && (
                                                            <span className="amv-timestamp" style={{ fontSize: '11px', marginTop: '2px', display: 'block' }}>
                                                                {rrStatus.dateLabel}: {formatDate(rrStatus.date)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="status-cell">
                                                        <span className={hostelStatus.className} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            {hostelStatus.icon} {hostelStatus.label}
                                                        </span>
                                                        {hostelStatus.date && (
                                                            <span className="amv-timestamp" style={{ fontSize: '11px', marginTop: '2px', display: 'block' }}>
                                                                {hostelStatus.dateLabel}: {formatDate(hostelStatus.date)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="amv-manage-btn" onClick={() => handleEditUser(user)}>
                                                        <Edit2 size={14} />
                                                        Manage
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan="7">
                                                <div className="amv-empty">
                                                    <User size={48} className="amv-empty-icon" />
                                                    <p>The directory is currently empty.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="amv-pagination">
                                <button
                                    className="amv-page-nav"
                                    disabled={currentPage === 1}
                                    onClick={() => handlePageChange(currentPage - 1)}
                                >
                                    Previous
                                </button>

                                <div className="amv-page-numbers">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            className={`amv-page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                                            onClick={() => handlePageChange(i + 1)}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    className="amv-page-nav"
                                    disabled={currentPage === totalPages}
                                    onClick={() => handlePageChange(currentPage + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>


            {selectedUser && (
                <UserDetailView
                    user={selectedUser}
                    isOpen={!!selectedUser}
                    onClose={handleCloseModal}
                    onUpdate={handleUserUpdate}
                />
            )}
        </div>
    );
}

export default AllMembersView;

import React, { useState, useEffect } from 'react';

import UserDetailView from './UserDetailView';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatBalance } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/dateFormat';
import { useLoading } from '../../context/GlobalLoadingContext';
import { Search, Edit2, User, CheckCircle, AlertCircle, BadgeAlert, Clock, Filter, X } from 'lucide-react';
import { useAdminHeader } from '../../context/AdminHeaderContext';
import '../../styles/StandardLayout.css';
import '../../styles/AllMembersView.css';

function AllMembersView({ onBack, onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [seatAssignmentsMap, setSeatAssignmentsMap] = useState({});
    const [hostelAssignmentsMap, setHostelAssignmentsMap] = useState({});

    // Filter State
    const [filters, setFilters] = useState({
        search: '',
        balance: 'all', // all, due, positive
        loan: 'all', // all, active, none
        readingRoom: 'all', // all, active, due_incoming, overdue, expired, old, none
        hostel: 'all' // all, active, due_incoming, overdue, expired, old, none
    });

    const [showFilters, setShowFilters] = useState(false);

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

    // Helper to calculate status (reused from original)
    const parseDate = (val) => {
        if (!val) return null;
        if (typeof val?.toDate === 'function') return val.toDate();
        if (val instanceof Date) return val;
        if (typeof val === 'number') {
            if (val < 10000000000) return new Date(val * 1000);
            return new Date(val);
        }
        return new Date(val);
    };

    const getServiceStatus = (assignment, isReadingRoom, user) => {
        if (!assignment) {
            const hasHistory = isReadingRoom
                ? (user.registrationCompleted === true)
                : (user.hostelRegistrationPaid === true);

            if (hasHistory) {
                return { label: 'Old', className: 'amv-badge old', icon: <Clock size={12} />, date: null, statusKey: 'old' };
            }
            return { label: 'Never Joined', className: 'amv-badge none', icon: <User size={12} />, date: null, statusKey: 'none' };
        }

        let dueDateVal = assignment.nextPaymentDue;

        // Reading Room assignments might not have nextPaymentDue on the assignment doc 
        // (it's often on the user doc), so fallback to user.nextPaymentDue
        if (isReadingRoom && !dueDateVal) {
            dueDateVal = user.nextPaymentDue;
        }

        const dueDate = parseDate(dueDateVal);

        if (!dueDate || isNaN(dueDate.getTime())) {
            return {
                label: 'Active',
                className: 'amv-badge active',
                icon: <CheckCircle size={12} />,
                date: null,
                dateLabel: 'No Expiry',
                statusKey: 'active'
            };
        }

        const today = new Date();
        const oneDay = 1000 * 60 * 60 * 24;
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / oneDay);

        let status = { label: '', className: '', icon: null, date: dueDate, dateLabel: '', statusKey: '' };

        if (diffDays > 3) {
            status = {
                label: 'Active',
                className: 'amv-badge active',
                icon: <CheckCircle size={12} />,
                date: dueDate,
                dateLabel: 'Due',
                statusKey: 'active'
            };
        } else if (diffDays >= 0) {
            status = {
                label: 'Due Incoming',
                className: 'amv-badge warning',
                icon: <AlertCircle size={12} />,
                date: dueDate,
                dateLabel: 'Due',
                statusKey: 'due_incoming'
            };
        } else if (diffDays >= -3) {
            status = {
                label: 'Grace Period',
                className: 'amv-badge danger',
                icon: <BadgeAlert size={12} />,
                date: dueDate,
                dateLabel: 'Expired',
                statusKey: 'overdue' // Treating grace as overdue for filter simplicity or distinct? Let's map to overdue
            };
        } else {
            status = {
                label: 'Overdue',
                className: 'amv-badge overdue',
                icon: <BadgeAlert size={12} />,
                date: dueDate,
                dateLabel: 'Expired',
                statusKey: 'overdue'
            };
        }
        return status;
    };

    // Filter Logic
    const filteredUsers = users.filter((u) => {
        // 1. Text Search
        const lowerQ = filters.search.toLowerCase();
        const matchesSearch = !lowerQ || (
            u.name?.toLowerCase().includes(lowerQ) ||
            u.email?.toLowerCase().includes(lowerQ) ||
            u.mrrNumber?.toLowerCase().includes(lowerQ)
        );

        if (!matchesSearch) return false;

        // 2. Balance Filter
        if (filters.balance !== 'all') {
            const balance = u.balance || 0;
            if (filters.balance === 'due' && balance >= 0) return false;
            if (filters.balance === 'positive' && balance < 0) return false;
        }

        // 3. Loan Filter
        if (filters.loan !== 'all') {
            const hasLoan = u.loan?.has_active_loan;
            if (filters.loan === 'active' && !hasLoan) return false;
            if (filters.loan === 'none' && hasLoan) return false;
        }

        // 4. Reading Room Status
        if (filters.readingRoom !== 'all') {
            const rrAssignment = seatAssignmentsMap[u.id];
            const rrStatus = getServiceStatus(rrAssignment, true, u);

            // Map statusKey to filter values
            // filter values: active, due_incoming, overdue, old, none
            // map grace period to overdue for filter? Or strict matching.
            if (filters.readingRoom === 'active' && rrStatus.statusKey !== 'active') return false;
            if (filters.readingRoom === 'due_incoming' && rrStatus.statusKey !== 'due_incoming') return false;
            if (filters.readingRoom === 'overdue' && rrStatus.statusKey !== 'overdue') return false;
            if (filters.readingRoom === 'old' && rrStatus.statusKey !== 'old') return false;
            if (filters.readingRoom === 'none' && rrStatus.statusKey !== 'none') return false;
        }

        // 5. Hostel Status
        if (filters.hostel !== 'all') {
            const hostelAssignment = hostelAssignmentsMap[u.id];
            const hostelStatus = getServiceStatus(hostelAssignment, false, u);

            if (filters.hostel === 'active' && hostelStatus.statusKey !== 'active') return false;
            if (filters.hostel === 'due_incoming' && hostelStatus.statusKey !== 'due_incoming') return false;
            if (filters.hostel === 'overdue' && hostelStatus.statusKey !== 'overdue') return false;
            if (filters.hostel === 'old' && hostelStatus.statusKey !== 'old') return false;
            if (filters.hostel === 'none' && hostelStatus.statusKey !== 'none') return false;
        }

        return true;
    });

    // Pagination Logic
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8; // Maybe increase since we have better filters? Keep 8 for now.
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const handleEditUser = (user) => setSelectedUser(user);
    const handleCloseModal = () => setSelectedUser(null);
    const handleUserUpdate = () => { /* User updated callback */ };

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        const container = document.querySelector('.std-body');
        if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const { setHeader } = useAdminHeader();

    useEffect(() => {
        setHeader({
            actionBar: (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="amv-search-wrapper" style={{ marginBottom: '0', width: '300px' }}>
                        <input
                            type="text"
                            placeholder="Search..."
                            className="amv-search-input"
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        />
                        <Search className="amv-search-icon" size={20} />
                    </div>
                    <button
                        className={`amv-filter-toggle ${showFilters ? 'active' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            background: showFilters ? '#eee' : '#fff',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                        }}
                    >
                        <Filter size={16} /> Filters
                    </button>
                </div>
            )
        });
    }, [setHeader, filters, showFilters]);

    const clearFilters = () => {
        setFilters({
            search: '',
            balance: 'all',
            loan: 'all',
            readingRoom: 'all',
            hostel: 'all'
        });
    };

    return (
        <div className="amv-container">
            <main className="std-body">
                {/* Advanced Filters Bar */}
                {showFilters && (
                    <div className="amv-filters-panel" style={{
                        backgroundColor: '#f8f9fa',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        border: '1px solid #e9ecef',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px',
                        alignItems: 'end'
                    }}>
                        <label className="amv-filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>Balance Status</span>
                            <select
                                value={filters.balance}
                                onChange={(e) => setFilters(p => ({ ...p, balance: e.target.value }))}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                            >
                                <option value="all">All</option>
                                <option value="due">Due Only</option>
                                <option value="positive">Positive Only</option>
                            </select>
                        </label>

                        <label className="amv-filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>Loan Status</span>
                            <select
                                value={filters.loan}
                                onChange={(e) => setFilters(p => ({ ...p, loan: e.target.value }))}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                            >
                                <option value="all">All</option>
                                <option value="active">Active Loan</option>
                                <option value="none">No Loan</option>
                            </select>
                        </label>

                        <label className="amv-filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>Reading Room</span>
                            <select
                                value={filters.readingRoom}
                                onChange={(e) => setFilters(p => ({ ...p, readingRoom: e.target.value }))}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                            >
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="due_incoming">Due Incoming</option>
                                <option value="overdue">Overdue</option>
                                <option value="old">Old Member</option>
                                <option value="none">Never Joined</option>
                            </select>
                        </label>

                        <label className="amv-filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#666' }}>Hostel</span>
                            <select
                                value={filters.hostel}
                                onChange={(e) => setFilters(p => ({ ...p, hostel: e.target.value }))}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                            >
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="due_incoming">Due Incoming</option>
                                <option value="overdue">Overdue</option>
                                <option value="old">Old Member</option>
                                <option value="none">Never Joined</option>
                            </select>
                        </label>

                        <button
                            onClick={clearFilters}
                            style={{
                                padding: '8px',
                                background: '#fff',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: '#d32f2f',
                                fontWeight: '500'
                            }}
                        >
                            Reset
                        </button>
                    </div>
                )}

                <div className="amv-stats" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{filteredUsers.length} total • Page {currentPage} of {totalPages || 1}</span>
                    {filteredUsers.length !== users.length && (
                        <span style={{ fontSize: '12px', color: '#666' }}>
                            Showing {filteredUsers.length} of {users.length} users
                        </span>
                    )}
                </div>

                {paginatedUsers.length === 0 && users.length > 0 ? (
                    <div className="amv-empty">
                        <User size={48} className="amv-empty-icon" />
                        <p>No members match your search.</p>
                        <button onClick={clearFilters} style={{ marginTop: '10px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            Clear Filters
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="amv-table-wrapper">
                            <table className="amv-table">
                                <thead>
                                    <tr>
                                        {/* Split Identity into Name and Email */}
                                        <th style={{ width: '180px' }}>Name</th>
                                        <th style={{ width: '200px' }}>Email</th>
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

                                        const isDue = (user.balance || 0) < 0;

                                        return (
                                            <tr key={user.id}>
                                                {/* Name Column */}
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div className="amv-avatar" style={{ width: '28px', height: '28px', fontSize: '12px' }}>
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
                                                        <span className="amv-user-name" style={{ fontSize: '13px' }}>{user.name || 'Anonymous'}</span>
                                                    </div>
                                                </td>
                                                {/* Email Column */}
                                                <td>
                                                    <span className="amv-user-email" style={{ fontSize: '13px' }}>{user.email || '-'}</span>
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
                                            <td colSpan="8">
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

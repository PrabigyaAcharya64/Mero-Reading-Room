import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import UserDetailView from './UserDetailView';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { formatBalance } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/dateFormat';
import { Search, Edit2, User, ChevronRight } from 'lucide-react';
import '../../styles/StandardLayout.css';
import '../../styles/AllMembersView.css';

function AllMembersView({ onBack, onDataLoaded }) {
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [seatAssignmentsMap, setSeatAssignmentsMap] = useState({});

    useEffect(() => {
        const usersQ = query(collection(db, 'users'), where('verified', '==', true));
        const seatsRef = collection(db, 'seatAssignments');

        // Standard Batch Reveal Pattern - signal parent when loaded
        Promise.all([
            getDocs(usersQ),
            getDocs(seatsRef)
        ]).finally(() => {
            onDataLoaded?.();
        });

        // Real-time listeners
        const seatUnsub = onSnapshot(seatsRef, (snapshot) => {
            const map = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.userId) map[data.userId] = data;
            });
            setSeatAssignmentsMap(map);
        });

        const userUnsub = onSnapshot(usersQ, (snapshot) => {
            const userData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setUsers(userData);
        }, (error) => {
            console.error("Error fetching users:", error);
        });

        return () => {
            seatUnsub();
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
    const handleUserUpdate = () => console.log('User updated');

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        // Scroll to top of table or container for better UX
        const container = document.querySelector('.std-body');
        if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="amv-container">
            <PageHeader
                title="Members Directory"
                onBack={onBack}
            />

            <main className="std-body">
                <div className="amv-header-card">
                    <div className="amv-title-row">
                        <h2 className="amv-title">Member List</h2>
                        <div className="amv-stats">
                            {filteredUsers.length} total • Page {currentPage} of {totalPages || 1}
                        </div>
                    </div>

                    <div className="amv-search-wrapper">
                        <input
                            type="text"
                            placeholder="Search by Name, Email or MRR ID..."
                            className="amv-search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Search className="amv-search-icon" size={20} />
                    </div>
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
                                        <th>Identity</th>
                                        <th>MRR ID</th>
                                        <th>Status</th>
                                        <th>Balance</th>
                                        <th>Reading Room</th>
                                        <th>Next Payment</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers.map(user => (
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
                                                <span className={`amv-badge ${user.verified ? 'verified' : 'pending'}`}>
                                                    {user.verified ? 'Verified' : 'Pending'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="amv-balance">{formatBalance(user.balance || 0)}</span>
                                            </td>
                                            <td>
                                                <div className="amv-room-box">
                                                    <span className={`amv-badge ${seatAssignmentsMap[user.id] ? 'active' : 'inactive'}`}>
                                                        {seatAssignmentsMap[user.id] ? 'Active' : 'Inactive'}
                                                    </span>
                                                    {seatAssignmentsMap[user.id] && (
                                                        <span className="amv-room-info">
                                                            {seatAssignmentsMap[user.id].roomName || 'Room'} • {seatAssignmentsMap[user.id].seatLabel || 'Seat'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="amv-timestamp">{formatDate(user.nextPaymentDue)}</span>
                                            </td>
                                            <td>
                                                <button className="amv-manage-btn" onClick={() => handleEditUser(user)}>
                                                    <Edit2 size={14} />
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
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


import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import UserDetailView from './UserDetailView';
import '../../styles/StandardLayout.css';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { formatBalance } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/dateFormat';
import { Search, Edit2, User } from 'lucide-react';

function AllMembersView({ onBack, isSidebarOpen, onToggleSidebar }) {
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [seatAssignmentsMap, setSeatAssignmentsMap] = useState({});

    useEffect(() => {
        // Listen to seat assignments for real-time status
        const seatUnsub = onSnapshot(collection(db, 'seatAssignments'), (snapshot) => {
            const map = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.userId) {
                    map[data.userId] = data;
                }
            });
            setSeatAssignmentsMap(map);
        });

        return () => seatUnsub();
    }, []);

    useEffect(() => {
        // Fetch all verified users
        const q = query(collection(db, 'users'), where('verified', '==', true));
        const unsub = onSnapshot(q, async (snapshot) => {
            const userData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setUsers(userData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching users:", error);
            setLoading(false);
        });
        return () => unsub();
    }, []);



    const filteredUsers = users.filter((u) => {
        const lowerQ = searchQuery.toLowerCase();
        return (u.name?.toLowerCase().includes(lowerQ) ||
            u.email?.toLowerCase().includes(lowerQ) ||
            u.mrrNumber?.toLowerCase().includes(lowerQ));
    });

    const handleEditUser = (user) => {
        setSelectedUser(user);
    };

    const handleCloseModal = () => {
        setSelectedUser(null);
    };

    const handleUserUpdate = () => {
        // Refresh will happen automatically via onSnapshot
        console.log('User updated');
    };

    return (
        <div className="std-container">
            <PageHeader title="All Members" onBack={onBack} isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />

            <main className="std-body">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="mb-6 flex justify-between align-items-center">
                        <h2 className="text-2xl font-bold" style={{ color: '#1f2937' }}>Member Directory</h2>
                        <div className="text-sm text-gray-600">
                            Total Members: <strong>{users.length}</strong>
                        </div>
                    </div>

                    <div className="mb-4 relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by Name, Email or MRR..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ borderColor: '#d1d5db' }}
                        />
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
                            <p className="mt-4 text-gray-600">Loading members...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse" style={{ minWidth: '1000px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                        <th className="p-3 font-semibold text-gray-700">User Identity</th>
                                        <th className="p-3 font-semibold text-gray-700">MRR No.</th>
                                        <th className="p-3 font-semibold text-gray-700">Balance</th>
                                        <th className="p-3 font-semibold text-gray-700">Verification</th>
                                        <th className="p-3 font-semibold text-gray-700">Reading Room</th>
                                        <th className="p-3 font-semibold text-gray-700">Last Payment</th>
                                        <th className="p-3 font-semibold text-gray-700">Next Payment</th>
                                        <th className="p-3 font-semibold text-gray-700">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="border-b hover:bg-gray-50" style={{ transition: 'background 0.2s' }}>
                                            {/* User Identity Column */}
                                            <td className="p-3">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    {/* User Photo */}
                                                    <div style={{
                                                        width: '48px',
                                                        height: '48px',
                                                        borderRadius: '50%',
                                                        overflow: 'hidden',
                                                        flexShrink: 0,
                                                        border: '2px solid #e5e7eb'
                                                    }}>
                                                        {user.profileImage || user.photoUrl || user.image ? (
                                                            <img
                                                                src={user.profileImage || user.photoUrl || user.image}
                                                                alt={user.name}
                                                                referrerPolicy="no-referrer"
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            />
                                                        ) : (
                                                            <div style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                color: 'white',
                                                                fontSize: '18px',
                                                                fontWeight: 'bold'
                                                            }}>
                                                                {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Name and Email */}
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                                                            {user.name || 'N/A'}
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                                            {user.email || '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* MRR Number */}
                                            <td className="p-3">
                                                <span style={{ fontFamily: 'monospace', color: '#374151', fontWeight: '500' }}>
                                                    {user.mrrNumber || '-'}
                                                </span>
                                            </td>

                                            {/* Balance */}
                                            <td className="p-3">
                                                <span style={{
                                                    fontWeight: '600',
                                                    color: '#059669',
                                                    fontSize: '14px'
                                                }}>
                                                    {formatBalance(user.balance || 0)}
                                                </span>
                                            </td>

                                            {/* Verification Status */}
                                            <td className="p-3">
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    backgroundColor: user.verified ? '#dcfce7' : '#f3f4f6',
                                                    color: user.verified ? '#166534' : '#6b7280'
                                                }}>
                                                    {user.verified ? '✓ Verified' : 'Pending'}
                                                </span>
                                            </td>

                                            {/* Reading Room Status */}
                                            <td className="p-3">
                                                <div className="flex flex-col">
                                                    <span style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        backgroundColor: seatAssignmentsMap[user.id] ? '#dbeafe' : '#f3f4f6',
                                                        color: seatAssignmentsMap[user.id] ? '#1e40af' : '#6b7280',
                                                        width: 'fit-content'
                                                    }}>
                                                        {seatAssignmentsMap[user.id] ? '✓ Active' : 'Inactive'}
                                                    </span>
                                                    {seatAssignmentsMap[user.id] && (
                                                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontWeight: '500', display: 'flex', flexDirection: 'column' }}>
                                                            <span>Room: {seatAssignmentsMap[user.id].roomName || 'Reading Room'}</span>
                                                            <span>Seat: {seatAssignmentsMap[user.id].seatLabel || seatAssignmentsMap[user.id].seatId || '-'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Last Payment Date */}
                                            <td className="p-3">
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                                                    {formatDate(user.lastPaymentDate)}
                                                </span>
                                            </td>

                                            {/* Next Payment Date */}
                                            <td className="p-3">
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                                                    {formatDate(user.nextPaymentDate)}
                                                </span>
                                            </td>

                                            {/* Action Button */}
                                            <td className="p-3">
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '6px 14px',
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '13px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#2563eb';
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#3b82f6';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <Edit2 size={14} />
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="p-6 text-center text-gray-500">
                                                <div style={{ padding: '40px' }}>
                                                    <User size={48} style={{ margin: '0 auto 16px', color: '#d1d5db' }} />
                                                    <p style={{ fontSize: '16px', color: '#6b7280' }}>
                                                        {searchQuery ? 'No members found matching your search.' : 'No members found.'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* User Detail View Modal */}
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

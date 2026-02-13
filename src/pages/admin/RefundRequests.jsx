import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Check, X, Eye, Edit, Trash2 } from 'lucide-react';
import { useLoading } from '../../context/GlobalLoadingContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/StandardLayout.css';
import '../../styles/AdminSidebar.css';

const RefundRequests = ({ onDataLoaded }) => {
    const { setIsLoading } = useLoading();
    const [requests, setRequests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'

    // Modal State
    const [showActionModal, setShowActionModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [actionType, setActionType] = useState(''); // 'approve', 'reject', 'complete'
    const [editAmount, setEditAmount] = useState('');
    const [note, setNote] = useState('');

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return '#ff9800';
            case 'approved': return '#2196f3';
            case 'rejected': return '#f44336';
            case 'completed': return '#4caf50';
            default: return '#757575';
        }
    };

    const handleActionClick = (request, type) => {
        setSelectedRequest(request);
        setActionType(type);
        setEditAmount(request.finalRefundAmount || request.calculatedAmount || 0);
        setNote(request.adminNote || '');
        setShowActionModal(true);
    };

    const handleConfirmAction = async () => {
        if (!selectedRequest) return;
        setIsLoading(true);

        try {
            const docRef = doc(db, 'refunds', selectedRequest.id);
            const updateData = {
                status: actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'completed',
                adminNote: note,
                updatedAt: new Date().toISOString(),
                processedBy: 'Admin'
            };

            if (actionType === 'approve') {
                updateData.finalRefundAmount = parseFloat(editAmount);
            }

            await updateDoc(docRef, updateData);

            // If completed, maybe update user balance if it was a refund to wallet? 
            // Or if it was cash, just mark done. 
            // For now, assuming cash collection at office as per instruction.

            setShowActionModal(false);
            // Refresh logic handled by snapshot listener
        } catch (error) {
            console.error("Error updating refund:", error);
            alert("Failed to update refund request.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const q = query(collection(db, 'refunds'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRequests(data);
            if (onDataLoaded) onDataLoaded();
        }, (error) => {
            console.error("Error fetching refund requests:", error);
            if (onDataLoaded) onDataLoaded();
        });

        return () => unsubscribe();
    }, [onDataLoaded]);

    const filteredRequests = requests.filter(req => {
        const matchesTab = activeTab === 'pending' ? req.status === 'pending' : req.status !== 'pending';

        if (!matchesTab) return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return (
                (req.refundToken && req.refundToken.toLowerCase().includes(q))
            );
        }
        return true;
    });

    // ... (handle functions same) ...




    return (
        <div className="std-container">
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <button
                        onClick={() => setActiveTab('pending')}
                        style={{
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'pending' ? '2px solid #000' : 'none',
                            fontWeight: activeTab === 'pending' ? 'bold' : 'normal',
                            cursor: 'pointer',
                            padding: '4px 0'
                        }}
                    >
                        Pending Requests ({requests.filter(r => r.status === 'pending').length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        style={{
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'history' ? '2px solid #000' : 'none',
                            fontWeight: activeTab === 'history' ? 'bold' : 'normal',
                            cursor: 'pointer',
                            padding: '4px 0'
                        }}
                    >
                        History
                    </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="REF-XXXX"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '20px',
                            border: '1px solid #ddd',
                            width: '250px',
                            fontSize: '14px'
                        }}
                    />
                </div>
            </div>

            {/* Table or Loader */}
            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minHeight: '200px' }}>
                {filteredRequests.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                        No {activeTab} refund requests found.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Client</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Service</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Reason</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Days Used</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Refund Amount</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map(req => (
                                <tr key={req.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px' }}>
                                        {new Date(req.createdAt).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ fontWeight: 'bold' }}>{req.userName}</div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>{req.userMrr || 'N/A'}</div>
                                        {req.refundToken && (
                                            <div style={{ fontSize: '11px', color: '#1976d2', fontWeight: 'bold', marginTop: '2px' }}>
                                                {req.refundToken}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                                        {req.serviceType?.replace('_', ' ')}
                                    </td>
                                    <td style={{ padding: '12px', fontSize: '13px', color: '#555', maxWidth: '200px' }}>
                                        {req.details || '-'}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {req.daysUsed}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                        रु {(req.finalRefundAmount || req.calculatedAmount || 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            color: 'white',
                                            background: getStatusColor(req.status),
                                            textTransform: 'capitalize'
                                        }}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {req.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handleActionClick(req, 'approve')}
                                                    title="Approve"
                                                    style={{ background: '#e3f2fd', color: '#1976d2', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleActionClick(req, 'reject')}
                                                    title="Reject"
                                                    style={{ background: '#ffebee', color: '#d32f2f', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        )}
                                        {req.status === 'approved' && (
                                            <button
                                                onClick={() => handleActionClick(req, 'complete')}
                                                style={{ background: '#e8f5e9', color: '#2e7d32', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                            >
                                                Mark Paid
                                            </button>
                                        )}
                                        {req.status === 'completed' && (
                                            <span style={{ color: '#4caf50', fontSize: '20px' }}>✓</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Action Modal */}
            {showActionModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
                        <h3 style={{ marginTop: 0, textTransform: 'capitalize' }}>{actionType} Refund Request</h3>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Client</label>
                            <div>{selectedRequest?.userName}</div>
                        </div>

                        {actionType === 'approve' && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Refund Amount (Editable)</label>
                                <input
                                    type="number"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    System calculated: रु {(selectedRequest?.calculatedAmount || 0).toLocaleString()}
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Note (Optional)</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add admin note..."
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '80px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowActionModal(false)}
                                style={{ padding: '8px 16px', border: '1px solid #ddd', background: 'white', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmAction}
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    background: actionType === 'reject' ? '#d32f2f' : actionType === 'complete' ? '#4caf50' : '#1976d2',
                                    color: 'white',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize'
                                }}
                            >
                                Confirm {actionType}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RefundRequests;

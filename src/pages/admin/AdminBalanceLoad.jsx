import React, { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    doc,
    updateDoc,
    serverTimestamp,
    limit
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import {
    Check,
    X,
    Clock,
    CreditCard,
    ExternalLink,
    ZoomIn,
    History
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import '../../styles/AdminBalanceLoad.css';

export default function AdminBalanceLoad({ onBack }) {
    const [requests, setRequests] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [processingId, setProcessingId] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Reset page when tab changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    // Fetch Pending Requests
    useEffect(() => {
        const q = query(
            collection(db, 'balanceRequests'),
            where('status', '==', 'pending'),
            orderBy('submittedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRequests(msgs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching balance requests:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Fetch History (Approved/Rejected)
    useEffect(() => {
        if (activeTab === 'history') {
            const q = query(
                collection(db, 'balanceRequests'),
                where('status', 'in', ['approved', 'rejected']),
                orderBy('submittedAt', 'desc'),
                limit(50)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const msgs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setHistory(msgs);
            });

            return () => unsubscribe();
        }
    }, [activeTab]);

    const handleApprove = async (request) => {
        if (!window.confirm(`Approve रु ${request.amount} for ${request.userName}?`)) return;

        setProcessingId(request.id);
        try {
            const approveBalanceLoad = httpsCallable(functions, 'approveBalanceLoad');
            const result = await approveBalanceLoad({ requestId: request.id });

            if (result.data.success) {
                alert("Balance approved and loaded successfully.");
            } else {
                alert("Operation returned failure.");
            }
        } catch (error) {
            console.error("Error approving request:", error);
            alert(`Failed to approve: ${error.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (request) => {
        const reason = prompt("Enter reason for rejection:");
        if (reason === null) return; // Cancelled

        setProcessingId(request.id);
        try {
            await updateDoc(doc(db, 'balanceRequests', request.id), {
                status: 'rejected',
                rejectionReason: reason || 'Admin rejected',
                rejectedAt: serverTimestamp()
            });
            alert("Request rejected.");
        } catch (error) {
            console.error("Error rejecting request:", error);
            alert("Failed to reject request.");
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="std-container">
                <PageHeader title="Balance Requests" onBack={onBack} />
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    const headerActions = (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="abl-tabs">
                <button
                    className={`abl-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                >
                    Pending
                    {requests.length > 0 && <span className="abl-badge-count">{requests.length}</span>}
                </button>
                <button
                    className={`abl-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    History
                </button>
            </div>
        </div>
    );

    return (
        <div className="abl-container">
            <PageHeader
                title="Balance Requests"
                onBack={onBack}
                rightElement={headerActions}
            />

            {activeTab === 'pending' ? (
                requests.length === 0 ? (
                    <div className="abl-empty">
                        <div className="abl-empty-icon">
                            <Check size={32} className="text-gray-400" />
                        </div>
                        <h3 className="abl-empty-title">All Caught Up</h3>
                        <p className="abl-empty-text">No pending balance requests.</p>
                    </div>
                ) : (
                    <>
                        <div className="abl-grid">
                            {requests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => (
                                <div key={req.id} className="abl-card">
                                    <div className="abl-receipt">
                                        <img src={req.receiptUrl} alt="Receipt" className="abl-receipt-img" />
                                        <div className="abl-receipt-overlay">
                                            <button onClick={() => setSelectedImage(req.receiptUrl)} className="abl-zoom-btn">
                                                <ZoomIn size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="abl-content">
                                        <div className="abl-user-row">
                                            <div>
                                                <h3 className="abl-user-name">{req.userName}</h3>
                                                <p className="abl-user-email">{req.userEmail}</p>
                                            </div>
                                            <div className="abl-status"><Clock size={10} /> Pending</div>
                                        </div>
                                        <div className="abl-info-grid">
                                            <div className="abl-info-box">
                                                <div className="abl-info-label">Amount</div>
                                                <div className="abl-info-value abl-amount">रु {req.amount}</div>
                                            </div>
                                            <div className="abl-info-box">
                                                <div className="abl-info-label">Transaction ID</div>
                                                <div className="abl-info-value abl-txn-id">{req.transactionId}</div>
                                            </div>
                                        </div>
                                        <div className="abl-actions">
                                            <button onClick={() => handleReject(req)} disabled={processingId === req.id} className="abl-btn abl-btn-reject">
                                                <X size={14} /> Reject
                                            </button>
                                            <button onClick={() => handleApprove(req)} disabled={processingId === req.id} className="abl-btn abl-btn-approve">
                                                {processingId === req.id ? <div className="abl-spinner"></div> : <Check size={14} />} Approve
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {requests.length > itemsPerPage && (
                            <div className="abl-pagination">
                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="abl-page-btn">Prev</button>
                                <span className="abl-page-info">{currentPage} / {Math.ceil(requests.length / itemsPerPage)}</span>
                                <button disabled={currentPage === Math.ceil(requests.length / itemsPerPage)} onClick={() => setCurrentPage(p => p + 1)} className="abl-page-btn">Next</button>
                            </div>
                        )}
                    </>
                )
            ) : (
                <div className="abl-grid-history">
                    {history.length === 0 ? (
                        <div className="abl-empty">
                            <h3 className="abl-empty-title">No History</h3>
                            <p className="abl-empty-text">No past requests found.</p>
                        </div>
                    ) : (
                        <>
                            {history.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => (
                                <div key={req.id} className="abl-card-history">
                                    <div className="abl-history-header">
                                        <div>
                                            <span className={`abl-status-badge ${req.status}`}>
                                                {req.status === 'approved' ? <Check size={12} /> : <X size={12} />} {req.status}
                                            </span>
                                            <span className="abl-history-date">{req.submittedAt?.toDate().toLocaleString()}</span>
                                        </div>
                                        <button className="abl-view-receipt-sm" onClick={() => setSelectedImage(req.receiptUrl)}>View Receipt</button>
                                    </div>
                                    <div className="abl-history-content">
                                        <div className="abl-history-user">
                                            <strong>{req.userName}</strong>
                                            <span>{req.userEmail}</span>
                                        </div>
                                        <div className="abl-history-amount">रु {req.amount}</div>
                                    </div>
                                    <div className="abl-history-footer">
                                        <span>Txn: <span className="abl-mono">{req.transactionId}</span></span>
                                        {req.rejectionReason && <span className="abl-reject-reason">Reason: {req.rejectionReason}</span>}
                                    </div>
                                </div>
                            ))}
                            {history.length > itemsPerPage && (
                                <div className="abl-pagination">
                                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="abl-page-btn">Prev</button>
                                    <span className="abl-page-info">{currentPage} / {Math.ceil(history.length / itemsPerPage)}</span>
                                    <button disabled={currentPage === Math.ceil(history.length / itemsPerPage)} onClick={() => setCurrentPage(p => p + 1)} className="abl-page-btn">Next</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {selectedImage && (
                <div className="abl-modal-overlay" onClick={() => setSelectedImage(null)}>
                    <button onClick={() => setSelectedImage(null)} className="abl-close-btn"><X size={24} /></button>
                    <img src={selectedImage} alt="Receipt Full" className="abl-modal-img" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
}

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
    getDocs
} from 'firebase/firestore';
import {
    Check,
    X,
    Clock,
    CreditCard,
    ExternalLink,
    ZoomIn,
    History,
    Search
} from 'lucide-react';
import { useLoading } from '../../context/GlobalLoadingContext';
import { useAdminHeader } from '../../context/AdminHeaderContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/AdminBalanceLoad.css';

export default function AdminBalanceLoad({ onBack, onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const [requests, setRequests] = useState([]);

    // Set loading true on mount (handles page refresh case)
    useEffect(() => {
        setIsLoading(true);
    }, []);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [processingId, setProcessingId] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Reset page when tab changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery]);

    // Fetch Pending Requests
    useEffect(() => {
        const q = query(
            collection(db, 'balanceRequests'),
            where('status', '==', 'pending'),
            orderBy('submittedAt', 'desc')
        );

        let hasLoaded = false;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRequests(msgs);

            if (!hasLoaded) {
                hasLoaded = true;
                onDataLoaded?.();
            }
        }, (error) => {
            console.error("Error fetching balance requests:", error);
            if (!hasLoaded) {
                hasLoaded = true;
                onDataLoaded?.();
            }
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch History (Approved/Rejected)
    useEffect(() => {
        if (activeTab === 'history') {
            // Only set loading if not already loading (prevents reset)
            setIsLoadingHistory(true);
            const q = query(
                collection(db, 'balanceRequests'),
                where('status', 'in', ['approved', 'rejected']),
                orderBy('submittedAt', 'desc'),
                limit(50)
            );

            // Initial fetch to clear loading state
            getDocs(q).finally(() => {
                setIsLoadingHistory(false);
            });

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


    const { setHeader } = useAdminHeader();

    useEffect(() => {
        setHeader({
            actionBar: (
                <div className="abl-tabs" style={{ padding: '0' }}>
                    <button
                        className={`abl-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pending')}
                    >
                        Pending
                        {requests.length > 0 && <span className="abl-badge-count">{requests.length}</span>}
                    </button>
                    <button
                        className={`abl-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => {
                            if (activeTab !== 'history') {
                                setIsLoadingHistory(true);
                            }
                            setActiveTab('history');
                        }}
                    >
                        History
                    </button>
                </div>
            )
        });

        // Cleanup: Remove action bar when leaving this page
        return () => {
            setHeader({ title: '', actionBar: null, rightElement: null, onBack: null });
        };
    }, [setHeader, activeTab, requests.length]);

    return (
        <div className="abl-container">

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
                    {!isLoadingHistory && (
                        <div className="abl-history-search-row">
                            <div className="abl-search-wrapper">
                                <Search className="abl-search-icon" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by Transaction ID..."
                                    className="abl-search-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                    {isLoadingHistory ? (
                        <div className="abl-history-loading">
                            <LoadingSpinner size="35" color="var(--color-primary, #000)" />
                        </div>
                    ) : (
                        <div className="reveal-container active" style={{ gridColumn: '1 / -1' }}>
                            {(() => {
                                const filteredHistory = history.filter(req =>
                                    req.transactionId?.toLowerCase().includes(searchQuery.toLowerCase())
                                );

                                if (filteredHistory.length === 0) {
                                    return (
                                        <div className="abl-empty">
                                            <h3 className="abl-empty-title">
                                                {searchQuery ? "No Matches Found" : "No History"}
                                            </h3>
                                            <p className="abl-empty-text">
                                                {searchQuery ? `No requests found for "${searchQuery}"` : "No past requests found."}
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <>
                                        <div className="abl-grid-history-list">
                                            {filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((req) => (
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
                                        </div>
                                        {filteredHistory.length > itemsPerPage && (
                                            <div className="abl-pagination">
                                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="abl-page-btn">Prev</button>
                                                <span className="abl-page-info">{currentPage} / {Math.ceil(filteredHistory.length / itemsPerPage)}</span>
                                                <button disabled={currentPage === Math.ceil(filteredHistory.length / itemsPerPage)} onClick={() => setCurrentPage(p => p + 1)} className="abl-page-btn">Next</button>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {
                selectedImage && (
                    <div className="abl-modal-overlay" onClick={() => setSelectedImage(null)}>
                        <button onClick={() => setSelectedImage(null)} className="abl-close-btn"><X size={24} /></button>
                        <img src={selectedImage} alt="Receipt Full" className="abl-modal-img" onClick={(e) => e.stopPropagation()} />
                    </div>
                )
            }
        </div >
    );
}

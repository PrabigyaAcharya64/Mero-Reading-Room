import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownLeft, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit, getDocs } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useLoading } from '../../context/GlobalLoadingContext';
import PageHeader from '../../components/PageHeader';
import '../../styles/Statement.css';

export default function Statement({ onBack }) {
    const { user, userBalance } = useAuth();
    const { setIsLoading } = useLoading();
    const [transactions, setTransactions] = useState([]);
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        if (!user) return;
        setIsLoading(true);

        const txnQuery = query(
            collection(db, 'transactions'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const reqQuery = query(
            collection(db, 'balanceRequests'),
            where('userId', '==', user.uid),
            orderBy('submittedAt', 'desc'),
            limit(20)
        );

        // Standard Batch Reveal Pattern
        Promise.all([
            getDocs(txnQuery),
            getDocs(reqQuery)
        ]).finally(() => {
            setIsLoading(false);
        });

        const unsubscribeTxn = onSnapshot(txnQuery, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                _type: 'transaction'
            }));
            setTransactions(msgs);
        }, (error) => {
            console.error("Error fetching transactions:", error);
        });

        const unsubscribeReq = onSnapshot(reqQuery, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                _type: 'request',
                createdAt: doc.data().submittedAt // normalize date field
            }));
            setRequests(msgs);
        }, (error) => {
            console.error("Error fetching requests:", error);
        });

        return () => {
            unsubscribeTxn();
            unsubscribeReq();
        };
    }, [user]);

    // Merge and Sort
    // Filter out requests that are already 'approved' OR have a corresponding transaction
    // This prevents showing "Pending" if the transaction is already visible
    const completedRequestIds = new Set(transactions.map(t => t.requestId).filter(Boolean));
    const activeRequests = requests.filter(r =>
        r.status !== 'approved' && !completedRequestIds.has(r.id)
    );

    const combinedHistory = [...activeRequests, ...transactions].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
    });


    return (
        <div className="stmt-container">
            <div className="stmt-header">
                <button onClick={onBack} className="stmt-back-btn">
                    <ArrowLeft size={20} className="text-gray-800" />
                </button>
                <span className="stmt-title">Transaction History</span>
            </div>

            <div className="stmt-content">
                <div className="stmt-balance-card">
                    <div>
                        <div className="stmt-balance-label">Current Balance</div>
                        <div className="stmt-balance-val">रु {userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="stmt-balance-icon">
                        <Wallet size={24} className="text-white" />
                    </div>
                </div>

                <div className="stmt-section-title">Latest Activity</div>

                {combinedHistory.length === 0 ? (
                    <div className="stmt-empty">
                        <Clock size={32} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
                        No activity found.
                    </div>
                ) : (
                    <div className="stmt-list">
                        {combinedHistory.map((item) => {
                            if (item._type === 'request') {
                                // Render Request Item (Pending/Rejected)
                                return (
                                    <div key={item.id} className="stmt-card" style={{ opacity: item.status === 'rejected' ? 0.7 : 1 }}>
                                        <div className="stmt-icon" style={{ backgroundColor: item.status === 'rejected' ? '#fef2f2' : '#eff6ff', color: item.status === 'rejected' ? '#dc2626' : '#2563eb' }}>
                                            {item.status === 'rejected' ? <AlertCircle size={20} /> : <Clock size={20} />}
                                        </div>
                                        <div className="stmt-details">
                                            <h4 className="stmt-desc">Balance Request ({item.status})</h4>
                                            <div className="stmt-date">
                                                {item.createdAt?.toDate().toLocaleString()}
                                            </div>
                                            {(item.method || item.transactionId) && (
                                                <div className="stmt-meta">
                                                    {item.method && (
                                                        <span className="stmt-meta-badge capitalize">
                                                            {item.method === 'esewa' || item.method === 'mobile_banking' ? 'Mobile Banking' : item.method}
                                                        </span>
                                                    )}
                                                    {/* If it's a manual load or esewa with an ID, show it if available in request (not always on txn) */}
                                                    {/* Using requestId if available instead since txn ID might be sensitive or long? No, usually fine */}
                                                </div>
                                            )}
                                            {item.rejectionReason && (
                                                <div className="stmt-meta" style={{ color: '#dc2626' }}>
                                                    {item.rejectionReason}
                                                </div>
                                            )}
                                        </div>
                                        <div className="stmt-amount" style={{ color: '#6b7280' }}>
                                            रु {item.amount}
                                        </div>
                                    </div>
                                );
                            }

                            // Render Transaction Item
                            const isPositive = ['balance_load', 'balance_topup'].includes(item.type);

                            return (
                                <div key={item.id} className="stmt-card">
                                    <div className={`stmt-icon ${isPositive ? 'topup' : 'expense'}`}>
                                        {isPositive ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                    </div>
                                    <div className="stmt-details">
                                        <h4 className="stmt-desc">{item.details || item.type}</h4>
                                        <div className="stmt-date">
                                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}
                                        </div>
                                    </div>
                                    <div className={`stmt-amount ${isPositive ? 'positive' : 'negative'}`}>
                                        {isPositive ? '+' : '-'} रु {item.amount}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

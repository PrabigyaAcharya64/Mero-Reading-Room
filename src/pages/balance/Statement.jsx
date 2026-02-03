import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownLeft, Clock, AlertCircle, Search, Calendar, Filter, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { useLoading } from '../../context/GlobalLoadingContext';
import '../../styles/TransactionStatement.css';

import { useNavigate } from 'react-router-dom';

export default function Statement({ onBack }) {
    const { user, userBalance } = useAuth();
    const navigate = useNavigate();
    const { setIsLoading } = useLoading();
    const [refunds, setRefunds] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [requests, setRequests] = useState([]);
    const [filteredHistory, setFilteredHistory] = useState([]);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // Filter states
    const [dateRange, setDateRange] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Summary stats
    const [stats, setStats] = useState({
        totalInflow: 0,
        totalOutflow: 0
    });

    // Refund Modal State (moved to separate page eventually, but fixing error first)
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundAmount, setRefundAmount] = useState('');
    const [refundReason, setRefundReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!user) return;
        setIsLoading(true);

        const txnQuery = query(
            collection(db, 'transactions'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const reqQuery = query(
            collection(db, 'balanceRequests'),
            where('userId', '==', user.uid),
            orderBy('submittedAt', 'desc')
        );

        const refundQuery = query(
            collection(db, 'refunds'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        // Standard Batch Reveal Pattern
        Promise.all([
            getDocs(txnQuery),
            getDocs(reqQuery),
            getDocs(refundQuery)
        ]).finally(() => {
            setIsLoading(false);
        });

        const unsubscribeTxn = onSnapshot(txnQuery, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                _type: 'transaction',
                createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
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
                createdAt: doc.data().submittedAt?.toDate?.() || new Date(doc.data().submittedAt)
            }));
            setRequests(msgs);
        }, (error) => {
            console.error("Error fetching requests:", error);
        });

        const unsubscribeRefunds = onSnapshot(refundQuery, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                _type: 'refund_request',
                createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
                amount: doc.data().calculatedAmount || doc.data().amount || 0 // Handle both legacy and new
            }));
            setRefunds(msgs);
        });

        return () => {
            unsubscribeTxn();
            unsubscribeReq();
            unsubscribeRefunds();
        };
    }, [user, setIsLoading]);

    // Apply filters
    useEffect(() => {
        const completedRequestIds = new Set(transactions.map(t => t.requestId).filter(Boolean));


        const activeRequests = requests.filter(r =>
            r.status !== 'approved' && !completedRequestIds.has(r.id)
        );

        // Include Refunds
        const combined = [...activeRequests, ...transactions, ...refunds];



        let filtered = combined; // Helper var

        // Date range filter
        if (dateRange !== 'all') {
            const now = new Date();
            let startDate = new Date();

            switch (dateRange) {
                case 'today':
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case '7days':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case 'thisMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'custom':
                    if (customStartDate) {
                        startDate = new Date(customStartDate);
                    }
                    break;
                default:
                    startDate = new Date(0);
            }

            filtered = filtered.filter(item => {
                const itemDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt || 0);
                if (dateRange === 'custom' && customEndDate) {
                    const endDate = new Date(customEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    return itemDate >= startDate && itemDate <= endDate;
                }
                return itemDate >= startDate;
            });
        }

        // Search filter
        if (searchQuery.trim()) {
            const queryLowercase = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.details?.toLowerCase().includes(queryLowercase) ||
                item.id?.toLowerCase().includes(queryLowercase) ||
                item.type?.toLowerCase().includes(queryLowercase) ||
                (item.serviceType && item.serviceType.toLowerCase().includes(queryLowercase))
            );
        }

        // Sort by date
        filtered.sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        setFilteredHistory(filtered);

        // Calculate stats (only from actual transactions)
        // ... (same stats logic)
        const actualTransactions = filtered.filter(item => item._type === 'transaction');
        const inflow = actualTransactions
            .filter(txn => ['balance_load', 'balance_topup'].includes(txn.type))
            .reduce((sum, txn) => sum + (txn.amount || 0), 0);

        const outflow = actualTransactions
            .filter(txn => !['balance_load', 'balance_topup'].includes(txn.type))
            .reduce((sum, txn) => sum + (txn.amount || 0), 0);

        setStats({ totalInflow: inflow, totalOutflow: outflow });

    }, [transactions, requests, refunds, dateRange, customStartDate, customEndDate, searchQuery]);

    const handleRequestRefund = async () => {
        if (!refundAmount || parseFloat(refundAmount) <= 0) {
            alert("Please enter a valid amount.");
            return;
        }
        if (parseFloat(refundAmount) > userBalance) {
            alert("Insufficient balance for this refund amount.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { addDoc } = await import('firebase/firestore'); // Lazy import or move to top

            await addDoc(collection(db, 'refunds'), {
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                serviceType: 'balance_refund',
                details: refundReason || 'Balance Refund Request',
                amount: parseFloat(refundAmount),
                packagePrice: parseFloat(refundAmount), // For consistency with admin table
                calculatedAmount: parseFloat(refundAmount), // For consistency
                finalRefundAmount: parseFloat(refundAmount),
                status: 'pending',
                createdAt: new Date().toISOString()
            });
            setShowRefundModal(false);
            setRefundAmount('');
            setRefundReason('');
            alert('Refund request submitted successfully.');
        } catch (error) {
            console.error("Error submitting refund:", error);
            alert("Failed to submit refund request.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDateTime = (date) => {
        if (!date) return 'N/A';
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) + ' • ' + d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getMerchantName = (item) => {
        if (item._type === 'request') {
            return `Balance Request (${item.status})`;
        }
        if (item._type === 'refund_request') {
            const types = {
                'reading_room': 'Reading Room Refund',
                'hostel': 'Hostel Refund',
                'balance_refund': 'Balance Withdraw'
            };
            return types[item.serviceType] || 'Refund Request';
        }
        if (item.details) return item.details;
        if (item.type === 'balance_load') return 'Balance Load';
        if (item.type === 'balance_topup') return 'Balance Top-up';
        if (item.type === 'canteen_payment') return 'Canteen Purchase';
        if (item.type === 'reading_room_payment') return 'Reading Room Payment';
        return item.type || 'Transaction';
    };

    return (
        <div className="txn-statement-container">
            {/* Header */}
            <div className="txn-statement-header">
                <div className="txn-header-left">
                    <button onClick={onBack} className="txn-back-btn">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="txn-statement-title">Transaction History</h1>
                </div>
            </div>

            {/* Summary Section */}
            <div className="txn-summary-section">
                <div className="txn-summary-cards">
                    {/* ... (inflow/outflow cards same) ... */}
                    <div className="txn-summary-card">
                        <div className="txn-summary-label">Total Inflow</div>
                        <div className="txn-summary-value inflow">
                            + रु {stats.totalInflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="txn-summary-subtext">Money received</div>
                    </div>
                    <div className="txn-summary-card">
                        <div className="txn-summary-label">Total Outflow</div>
                        <div className="txn-summary-value outflow">
                            - रु {stats.totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="txn-summary-subtext">Money spent</div>
                    </div>
                    <div className="txn-summary-card">
                        <div className="txn-summary-label">Current Balance</div>
                        <div className="txn-summary-value balance">
                            रु {userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div
                            onClick={() => navigate('/refund-request')}
                            style={{
                                marginTop: '8px',
                                fontSize: '12px',
                                color: '#d32f2f',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                fontWeight: '600'
                            }}
                        >
                            Request Refund
                        </div>

                    </div>
                </div>
            </div>

            {/* Filter Bar ... (unchanged) ... */}
            <div className="txn-filter-bar">
                <div className="txn-filter-controls">
                    {/* Date Range Presets */}
                    <div className="txn-filter-group">
                        <span className="txn-filter-label">
                            <Calendar size={16} /> Period:
                        </span>
                        <div className="txn-date-presets">
                            <button
                                className={`txn-date-preset-btn ${dateRange === 'today' ? 'active' : ''}`}
                                onClick={() => setDateRange('today')}
                            >
                                Today
                            </button>
                            <button
                                className={`txn-date-preset-btn ${dateRange === '7days' ? 'active' : ''}`}
                                onClick={() => setDateRange('7days')}
                            >
                                Last 7 Days
                            </button>
                            <button
                                className={`txn-date-preset-btn ${dateRange === 'thisMonth' ? 'active' : ''}`}
                                onClick={() => setDateRange('thisMonth')}
                            >
                                This Month
                            </button>
                            <button
                                className={`txn-date-preset-btn ${dateRange === 'all' ? 'active' : ''}`}
                                onClick={() => setDateRange('all')}
                            >
                                All Time
                            </button>
                            <button
                                className={`txn-date-preset-btn ${dateRange === 'custom' ? 'active' : ''}`}
                                onClick={() => setDateRange('custom')}
                            >
                                Custom Range
                            </button>
                        </div>
                    </div>

                    {/* Custom Date Range */}
                    {dateRange === 'custom' && (
                        <div className="txn-filter-group">
                            <input
                                type="date"
                                className="txn-date-input"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                placeholder="Start Date"
                            />
                            <span style={{ color: '#6b7280' }}>to</span>
                            <input
                                type="date"
                                className="txn-date-input"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                placeholder="End Date"
                            />
                        </div>
                    )}

                    {/* Search */}
                    <div className="txn-search-wrapper">
                        <Search className="txn-search-icon" size={16} />
                        <input
                            type="text"
                            className="txn-search-input"
                            placeholder="Search transactions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Transaction List */}
            <div className="txn-content">
                <div className="txn-content-inner">
                    {filteredHistory.length === 0 ? (
                        <div className="txn-empty-state">
                            <Clock className="txn-empty-icon" size={48} />
                            <p className="txn-empty-text">No transactions found</p>
                        </div>
                    ) : (
                        <div className="txn-list">
                            {filteredHistory.map((item) => {
                                if (item._type === 'request' || item._type === 'refund_request') {
                                    // Render Request Item
                                    const isPending = item.status === 'pending';
                                    const isRejected = item.status === 'rejected';
                                    const isCompleted = item.status === 'completed';
                                    const isRefund = item._type === 'refund_request';

                                    // Determine if it's an inflow (money coming back) or outflow (withdrawal)
                                    const isWithdrawal = item.serviceType === 'balance_refund';
                                    const isInflowRefund = !isWithdrawal && ['reading_room', 'hostel'].includes(item.serviceType);

                                    // Status Logic
                                    const showAsInflow = isCompleted && isInflowRefund;
                                    const showAsOutflow = isCompleted && isWithdrawal;

                                    return (
                                        <div
                                            key={item.id}
                                            className="txn-item"
                                            onClick={() => setSelectedTransaction(item)}
                                            style={{ borderLeft: isRefund ? (showAsInflow ? '4px solid #16a34a' : '4px solid #f59e0b') : undefined }}
                                        >
                                            <div className={`txn-icon ${isPending ? 'pending' : (showAsInflow ? 'inflow' : 'outflow')}`}>
                                                {isRejected ? <AlertCircle size={20} /> :
                                                    isPending ? <Clock size={20} /> :
                                                        showAsInflow ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                            </div>
                                            <div className="txn-details">
                                                <h4 className="txn-merchant-name">{getMerchantName(item)}</h4>
                                                <div className="txn-timestamp">{formatDateTime(item.createdAt)}</div>
                                                <div className="txn-meta-info">
                                                    {isRefund && (
                                                        <span className="txn-id-badge" style={{
                                                            backgroundColor: showAsInflow ? '#dcfce7' : '#fff7ed',
                                                            color: showAsInflow ? '#166534' : '#c2410c'
                                                        }}>
                                                            {isWithdrawal ? 'WITHDRAW' : 'REFUND'}
                                                        </span>
                                                    )}
                                                    <span className={`txn-status-badge ${item.status}`}>{item.status}</span>
                                                </div>
                                            </div>
                                            <div className="txn-amount-section">
                                                <div className={`txn-amount ${showAsInflow ? 'positive' : 'negative'}`}>
                                                    {showAsInflow ? '+' : (isWithdrawal ? '-' : '')} रु {item.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                // Render Transaction Item
                                const isInflow = ['balance_load', 'balance_topup', 'refund_credit'].includes(item.type);

                                return (
                                    <div
                                        key={item.id}
                                        className="txn-item"
                                        onClick={() => setSelectedTransaction(item)}
                                    >
                                        <div className={`txn-icon ${isInflow ? 'inflow' : 'outflow'}`}>
                                            {isInflow ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                        </div>
                                        <div className="txn-details">
                                            <h4 className="txn-merchant-name">{getMerchantName(item)}</h4>
                                            <div className="txn-timestamp">{formatDateTime(item.createdAt)}</div>
                                            <div className="txn-meta-info">
                                                <span className="txn-id-badge">ID: {item.id.slice(0, 8)}...</span>
                                                <span className="txn-status-badge success">success</span>
                                            </div>
                                        </div>
                                        <div className="txn-amount-section">
                                            <div className={`txn-amount ${isInflow ? 'positive' : 'negative'}`}>
                                                {isInflow ? '+' : '-'} रु {item.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Transaction Detail Drawer */}
            {selectedTransaction && (
                <>
                    <div className="txn-drawer-overlay" onClick={() => setSelectedTransaction(null)} />
                    <div className="txn-drawer">
                        <div className="txn-drawer-header">
                            <h2 className="txn-drawer-title">
                                {selectedTransaction._type === 'request' ? 'Request Details' :
                                    selectedTransaction._type === 'refund_request' ? 'Refund Details' : 'Transaction Details'}
                            </h2>
                            <button className="txn-drawer-close" onClick={() => setSelectedTransaction(null)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="txn-drawer-content">
                            {/* Amount Section */}
                            <div className="txn-drawer-section">
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Amount</span>
                                    <span className={`txn-drawer-value large ${selectedTransaction._type === 'transaction' ? (
                                        ['balance_load', 'balance_topup'].includes(selectedTransaction.type) ? 'positive' : 'negative'
                                    ) : ''
                                        }`}>
                                        {selectedTransaction._type === 'transaction' && (
                                            ['balance_load', 'balance_topup'].includes(selectedTransaction.type) ? '+' : '-'
                                        )} रु {selectedTransaction.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* ... (rest of drawer fields similar, just update logic for refund type) ... */}
                            <div className="txn-drawer-section">
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Type</span>
                                    <span className="txn-drawer-value">
                                        {selectedTransaction._type === 'refund_request' ? 'Refund Request' :
                                            selectedTransaction._type === 'request' ? 'Balance Load Request' : 'Transaction'}
                                    </span>
                                </div>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Status</span>
                                    <span className={`txn-status-badge ${selectedTransaction.status || 'success'}`}>
                                        {selectedTransaction.status || 'success'}
                                    </span>
                                </div>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Date</span>
                                    <span className="txn-drawer-value">{formatDateTime(selectedTransaction.createdAt)}</span>
                                </div>
                                {selectedTransaction.serviceType && (
                                    <div className="txn-drawer-detail-row">
                                        <span className="txn-drawer-label">Service</span>
                                        <span className="txn-drawer-value">{selectedTransaction.serviceType}</span>
                                    </div>
                                )}
                            </div>

                            <div className="txn-drawer-section">
                                <div className="txn-drawer-section-title">Parties</div>
                                <div className="txn-drawer-card">
                                    <div className="txn-drawer-detail-row">
                                        <span className="txn-drawer-label">From</span>
                                        <span className="txn-drawer-value">
                                            {['refund', 'withdrawal', 'cashback', 'refund_request'].includes(selectedTransaction.type || selectedTransaction._type)
                                                ? 'Mero Reading Room'
                                                : (user.displayName || 'Me')}
                                        </span>
                                    </div>
                                    <div className="txn-drawer-detail-row">
                                        <span className="txn-drawer-label">To</span>
                                        <span className="txn-drawer-value">
                                            {['refund', 'withdrawal', 'cashback', 'refund_request'].includes(selectedTransaction.type || selectedTransaction._type)
                                                ? (user.displayName || 'Me')
                                                : (['canteen_payment', 'canteen_order'].includes(selectedTransaction.type) ? 'Canteen' : 'Mero Reading Room')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Refund Modal */}
            {showRefundModal && (
                <>
                    <div className="txn-drawer-overlay" onClick={() => setShowRefundModal(false)} />
                    <div className="txn-drawer">
                        <div className="txn-drawer-header">
                            <h2 className="txn-drawer-title">Request Balance Refund</h2>
                            <button className="txn-drawer-close" onClick={() => setShowRefundModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="txn-drawer-content">
                            <div className="txn-drawer-section">
                                <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                                    You can request a refund of your available balance. This will be processed by the admin.
                                </p>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500' }}>Refund Amount (Max: रु {userBalance})</label>
                                    <input
                                        type="number"
                                        value={refundAmount}
                                        onChange={(e) => setRefundAmount(e.target.value)}
                                        placeholder="Enter amount"
                                        max={userBalance}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                    />
                                </div>
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500' }}>Reason (Optional)</label>
                                    <textarea
                                        value={refundReason}
                                        onChange={(e) => setRefundReason(e.target.value)}
                                        placeholder="Why are you requesting a refund?"
                                        rows={3}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                    />
                                </div>
                                <button
                                    onClick={handleRequestRefund}
                                    disabled={isSubmitting}
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        backgroundColor: '#000',
                                        color: '#fff',
                                        borderRadius: '12px',
                                        fontWeight: '600',
                                        opacity: isSubmitting ? 0.7 : 1
                                    }}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

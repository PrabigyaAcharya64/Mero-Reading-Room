import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownLeft, Clock, AlertCircle, Search, Calendar, Filter, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { useLoading } from '../../context/GlobalLoadingContext';
import '../../styles/TransactionStatement.css';

export default function Statement({ onBack }) {
    const { user, userBalance } = useAuth();
    const { setIsLoading } = useLoading();
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

        return () => {
            unsubscribeTxn();
            unsubscribeReq();
        };
    }, [user, setIsLoading]);

    // Apply filters
    useEffect(() => {
        const completedRequestIds = new Set(transactions.map(t => t.requestId).filter(Boolean));
        const activeRequests = requests.filter(r =>
            r.status !== 'approved' && !completedRequestIds.has(r.id)
        );

        let combined = [...activeRequests, ...transactions];

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

            combined = combined.filter(item => {
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
            const query = searchQuery.toLowerCase();
            combined = combined.filter(item =>
                item.details?.toLowerCase().includes(query) ||
                item.id?.toLowerCase().includes(query) ||
                item.type?.toLowerCase().includes(query)
            );
        }

        // Sort by date
        combined.sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        setFilteredHistory(combined);

        // Calculate stats (only from actual transactions, not requests)
        const actualTransactions = combined.filter(item => item._type === 'transaction');
        const inflow = actualTransactions
            .filter(txn => ['balance_load', 'balance_topup'].includes(txn.type))
            .reduce((sum, txn) => sum + (txn.amount || 0), 0);

        const outflow = actualTransactions
            .filter(txn => !['balance_load', 'balance_topup'].includes(txn.type))
            .reduce((sum, txn) => sum + (txn.amount || 0), 0);

        setStats({ totalInflow: inflow, totalOutflow: outflow });

    }, [transactions, requests, dateRange, customStartDate, customEndDate, searchQuery]);

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
                        <div className="txn-summary-subtext">Available now</div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
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
                                if (item._type === 'request') {
                                    // Render Request Item
                                    const isPending = item.status === 'pending';
                                    const isRejected = item.status === 'rejected';

                                    return (
                                        <div
                                            key={item.id}
                                            className="txn-item"
                                            onClick={() => setSelectedTransaction(item)}
                                        >
                                            <div className={`txn-icon ${isPending ? 'pending' : 'outflow'}`}>
                                                {isRejected ? <AlertCircle size={20} /> : <Clock size={20} />}
                                            </div>
                                            <div className="txn-details">
                                                <h4 className="txn-merchant-name">{getMerchantName(item)}</h4>
                                                <div className="txn-timestamp">{formatDateTime(item.createdAt)}</div>
                                                <div className="txn-meta-info">
                                                    {item.method && (
                                                        <span className="txn-id-badge">
                                                            {item.method === 'esewa' || item.method === 'mobile_banking' ? 'Mobile Banking' : item.method}
                                                        </span>
                                                    )}
                                                    <span className={`txn-status-badge ${item.status}`}>{item.status}</span>
                                                </div>
                                            </div>
                                            <div className="txn-amount-section">
                                                <div className="txn-amount" style={{ color: '#6b7280' }}>
                                                    रु {item.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                // Render Transaction Item
                                const isInflow = ['balance_load', 'balance_topup'].includes(item.type);

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
                                                <span className="txn-id-badge">ID: {item.id.slice(0, 12)}...</span>
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
                                {selectedTransaction._type === 'request' ? 'Request Details' : 'Transaction Details'}
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
                                    <span className={`txn-drawer-value large ${selectedTransaction._type === 'request' ? '' :
                                        ['balance_load', 'balance_topup'].includes(selectedTransaction.type) ? 'positive' : 'negative'
                                        }`}>
                                        {selectedTransaction._type === 'request' ? '' :
                                            ['balance_load', 'balance_topup'].includes(selectedTransaction.type) ? '+' : '-'
                                        } रु {selectedTransaction.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Main Info */}
                            <div className="txn-drawer-section">
                                <h3 className="txn-drawer-section-title">
                                    {selectedTransaction._type === 'request' ? 'Request Information' : 'Transaction Information'}
                                </h3>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Description</span>
                                    <span className="txn-drawer-value">{getMerchantName(selectedTransaction)}</span>
                                </div>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">ID</span>
                                    <span className="txn-drawer-value mono">{selectedTransaction.id}</span>
                                </div>
                                {selectedTransaction._type === 'transaction' && (
                                    <div className="txn-drawer-detail-row">
                                        <span className="txn-drawer-label">Type</span>
                                        <span className="txn-drawer-value">{selectedTransaction.type}</span>
                                    </div>
                                )}
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Status</span>
                                    <span className={`txn-status-badge ${selectedTransaction._type === 'request' ? selectedTransaction.status : 'success'}`}>
                                        {selectedTransaction._type === 'request' ? selectedTransaction.status : 'success'}
                                    </span>
                                </div>
                                {selectedTransaction._type === 'request' && selectedTransaction.rejectionReason && (
                                    <div className="txn-drawer-detail-row">
                                        <span className="txn-drawer-label">Rejection Reason</span>
                                        <span className="txn-drawer-value" style={{ color: '#dc2626' }}>
                                            {selectedTransaction.rejectionReason}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Transaction Parties */}
                            {selectedTransaction._type === 'transaction' && (
                                <div className="txn-drawer-section">
                                    <h3 className="txn-drawer-section-title">Transaction Parties</h3>
                                    <div className="txn-drawer-detail-row">
                                        <span className="txn-drawer-label">From</span>
                                        <span className="txn-drawer-value">
                                            {(user?.displayName || user?.email || 'You')}
                                        </span>
                                    </div>
                                    <div className="txn-drawer-detail-row">
                                        <span className="txn-drawer-label">To</span>
                                        <span className="txn-drawer-value">
                                            {['balance_load', 'balance_topup'].includes(selectedTransaction.type)
                                                ? 'Mero Reading Room'
                                                : selectedTransaction.type === 'canteen_payment' || selectedTransaction.type === 'canteen_order'
                                                    ? 'Canteen'
                                                    : selectedTransaction.type === 'reading_room' || selectedTransaction.type === 'reading_room_payment'
                                                        ? 'Mero Reading Room'
                                                        : selectedTransaction.type === 'hostel_payment'
                                                            ? 'Hostel'
                                                            : 'Merchant'
                                            }
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Date & Time */}
                            <div className="txn-drawer-section">
                                <h3 className="txn-drawer-section-title">Date & Time</h3>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Date</span>
                                    <span className="txn-drawer-value">
                                        {selectedTransaction.createdAt instanceof Date
                                            ? selectedTransaction.createdAt.toLocaleDateString('en-US', {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })
                                            : 'N/A'
                                        }
                                    </span>
                                </div>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Time</span>
                                    <span className="txn-drawer-value">
                                        {selectedTransaction.createdAt instanceof Date
                                            ? selectedTransaction.createdAt.toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit'
                                            })
                                            : 'N/A'
                                        }
                                    </span>
                                </div>
                            </div>

                            {/* Payment Method (for requests) */}
                            {selectedTransaction._type === 'request' && selectedTransaction.method && (
                                <div className="txn-drawer-section">
                                    <h3 className="txn-drawer-section-title">Payment Details</h3>
                                    <div className="txn-drawer-detail-row">
                                        <span className="txn-drawer-label">Method</span>
                                        <span className="txn-drawer-value">
                                            {selectedTransaction.method === 'esewa' || selectedTransaction.method === 'mobile_banking'
                                                ? 'Mobile Banking'
                                                : selectedTransaction.method
                                            }
                                        </span>
                                    </div>
                                    {selectedTransaction.transactionId && (
                                        <div className="txn-drawer-detail-row">
                                            <span className="txn-drawer-label">Reference ID</span>
                                            <span className="txn-drawer-value mono">{selectedTransaction.transactionId}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

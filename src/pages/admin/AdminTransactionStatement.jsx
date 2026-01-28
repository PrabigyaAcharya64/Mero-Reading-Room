import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Search, X, Calendar } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { useLoading } from '../../context/GlobalLoadingContext';
import PageHeader from '../../components/PageHeader';
import '../../styles/TransactionStatement.css';

export default function AdminTransactionStatement({ onBack, onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const [allTransactions, setAllTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [selectedUserDetails, setSelectedUserDetails] = useState(null);

    // Filter states
    const [dateRange, setDateRange] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Summary stats
    const [stats, setStats] = useState({
        totalInflow: 0,
        totalOutflow: 0,
        currentBalance: 0
    });

    useEffect(() => {
        setIsLoading(true);


        const txnQuery = collection(db, 'transactions');
        const ordersQuery = collection(db, 'orders');

        Promise.all([
            getDocs(query(txnQuery, orderBy('createdAt', 'desc'))).catch(err => {
                console.error("Error fetching transactions (trying without orderBy):", err);
                // Fallback: try without orderBy
                return getDocs(txnQuery).catch(err2 => {
                    console.error("Error fetching transactions (no orderBy):", err2);
                    return { docs: [] };
                });
            }),
            getDocs(query(ordersQuery, orderBy('createdAt', 'desc'))).catch(err => {
                console.error("Error fetching orders (trying without orderBy):", err);
                // Fallback: try without orderBy
                return getDocs(ordersQuery).catch(err2 => {
                    console.error("Error fetching orders (no orderBy):", err2);
                    return { docs: [] };
                });
            })
        ]).finally(() => {
            setIsLoading(false);
            onDataLoaded?.();
        });

        // Real-time listener for transactions (try with orderBy, fallback without)
        let unsubscribeTxn;
        try {
            const txnQueryOrdered = query(txnQuery, orderBy('createdAt', 'desc'));
            unsubscribeTxn = onSnapshot(txnQueryOrdered, (snapshot) => {
                const transactions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
                    source: 'transactions'
                }));
                setAllTransactions(prev => {
                    const orders = prev.filter(item => item.source === 'orders');
                    return [...transactions, ...orders];
                });
            }, (error) => {
                console.error("Error in transactions listener:", error);
                setIsLoading(false);
                // Try without orderBy
                unsubscribeTxn = onSnapshot(txnQuery, (snapshot) => {
                    const transactions = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
                        source: 'transactions'
                    }));
                    setAllTransactions(prev => {
                        const orders = prev.filter(item => item.source === 'orders');
                        return [...transactions, ...orders].sort((a, b) => b.createdAt - a.createdAt);
                    });
                });
            });
        } catch (error) {
            console.error("Error setting up transactions listener:", error);
            setIsLoading(false);
        }

        // Real-time listener for orders
        let unsubscribeOrders;
        try {
            const ordersQueryOrdered = query(ordersQuery, orderBy('createdAt', 'desc'));
            unsubscribeOrders = onSnapshot(ordersQueryOrdered, (snapshot) => {
                const orders = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        type: 'canteen_order',
                        amount: data.total || 0,
                        details: `Canteen Order #${doc.id.slice(0, 8)}`,
                        userId: data.userId || 'N/A',
                        status: data.status === 'completed' ? 'success' : (data.status || 'success'),
                        source: 'orders'
                    };
                });
                setAllTransactions(prev => {
                    const transactions = prev.filter(item => item.source === 'transactions');
                    return [...transactions, ...orders];
                });
            }, (error) => {
                console.error("Error in orders listener:", error);
                setIsLoading(false);

                unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
                    const orders = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                            type: 'canteen_order',
                            amount: data.total || 0,
                            details: `Canteen Order #${doc.id.slice(0, 8)}`,
                            userId: data.userId || 'N/A',
                            status: data.status === 'completed' ? 'success' : (data.status || 'success'),
                            source: 'orders'
                        };
                    });
                    setAllTransactions(prev => {
                        const transactions = prev.filter(item => item.source === 'transactions');
                        return [...transactions, ...orders].sort((a, b) => b.createdAt - a.createdAt);
                    });
                });
            });
        } catch (error) {
            console.error("Error setting up orders listener:", error);
            setIsLoading(false);
        }

        return () => {
            unsubscribeTxn?.();
            unsubscribeOrders?.();
        };
    }, []); // Empty dependency array - only run once on mount

    // Apply filters whenever transactions or filter criteria change
    useEffect(() => {
        let filtered = [...allTransactions];

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

            filtered = filtered.filter(txn => {
                const txnDate = txn.createdAt;
                if (dateRange === 'custom' && customEndDate) {
                    const endDate = new Date(customEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    return txnDate >= startDate && txnDate <= endDate;
                }
                return txnDate >= startDate;
            });
        }

        // Search filter (merchant name or transaction ID)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(txn =>
                txn.details?.toLowerCase().includes(query) ||
                txn.id?.toLowerCase().includes(query) ||
                txn.userId?.toLowerCase().includes(query)
            );
        }

        setFilteredTransactions(filtered);

        // Calculate stats from BUSINESS PERSPECTIVE
        // Inflow = Balance loads + Revenue from sales (canteen, reading room, hostel)
        const inflow = filtered
            .filter(txn =>
                ['balance_load', 'balance_topup', 'canteen_payment', 'reading_room', 'canteen_order', 'hostel_payment'].includes(txn.type)
            )
            .reduce((sum, txn) => sum + (txn.amount || 0), 0);

        // Outflow = Refunds, withdrawals, cashbacks, etc.
        const outflow = filtered
            .filter(txn =>
                ['refund', 'withdrawal', 'cashback'].includes(txn.type)
            )
            .reduce((sum, txn) => sum + (txn.amount || 0), 0);

        setStats({
            totalInflow: inflow,
            totalOutflow: outflow,
            currentBalance: inflow - outflow
        });

    }, [allTransactions, dateRange, customStartDate, customEndDate, searchQuery]);

    // Fetch user details (including MRR number) when transaction is selected
    useEffect(() => {
        const fetchUserDetails = async () => {
            if (!selectedTransaction || !selectedTransaction.userId) {
                setSelectedUserDetails(null);
                return;
            }

            try {
                const userRef = doc(db, 'users', selectedTransaction.userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    setSelectedUserDetails(userSnap.data());
                } else {
                    setSelectedUserDetails(null);
                }
            } catch (error) {
                console.error('Error fetching user details:', error);
                setSelectedUserDetails(null);
            }
        };

        fetchUserDetails();
    }, [selectedTransaction]);

    const getTransactionIcon = (txn) => {
        // From BUSINESS perspective:
        // Inflow = Balance loads, Canteen sales, Reading room payments, Hostel payments
        // Outflow = Refunds, Withdrawals, Cashbacks
        const isInflow = ['balance_load', 'balance_topup', 'canteen_payment', 'reading_room', 'canteen_order', 'hostel_payment'].includes(txn.type);
        return isInflow ? ArrowDownLeft : ArrowUpRight;
    };

    const getTransactionStatus = (txn) => {
        if (!txn.status) return 'success';
        if (txn.status === 'completed') return 'success';
        return txn.status;
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

    const getMerchantName = (txn) => {
        if (txn.details) return txn.details;
        if (txn.type === 'balance_load') return 'Balance Load';
        if (txn.type === 'balance_topup') return 'Balance Top-up';
        if (txn.type === 'canteen_payment') return 'Canteen Purchase';
        if (txn.type === 'canteen_order') return txn.details || 'Canteen Order';
        if (txn.type === 'reading_room') return txn.details || 'Reading Room Payment';
        if (txn.type === 'hostel_payment') return txn.details || 'Hostel Room Fee';
        if (txn.type === 'refund') return 'Refund';
        if (txn.type === 'withdrawal') return 'Withdrawal';
        if (txn.type === 'cashback') return 'Cashback';
        return txn.type || 'Transaction';
    };

    return (
        <div className="txn-statement-container">
            {/* Header */}
            <div className="txn-statement-header">
                <div className="txn-header-left">
                    {onBack && (
                        <button onClick={onBack} className="txn-back-btn">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 className="txn-statement-title">Transaction Statement</h1>
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
                            placeholder="Search by ID, Name or User ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Transaction List */}
            <div className="txn-content">
                <div className="txn-content-inner">
                    {filteredTransactions.length === 0 ? (
                        <div className="txn-empty-state">
                            <Calendar className="txn-empty-icon" size={48} />
                            <p className="txn-empty-text">No transactions found</p>
                        </div>
                    ) : (
                        <div className="txn-list">
                            {filteredTransactions.map((txn) => {
                                const Icon = getTransactionIcon(txn);
                                // From business perspective: revenue = inflow (green)
                                const isInflow = ['balance_load', 'balance_topup', 'canteen_payment', 'reading_room', 'canteen_order', 'hostel_payment'].includes(txn.type);
                                const status = getTransactionStatus(txn);

                                return (
                                    <div
                                        key={txn.id}
                                        className="txn-item"
                                        onClick={() => setSelectedTransaction(txn)}
                                    >
                                        <div className={`txn-icon ${isInflow ? 'inflow' : 'outflow'}`}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="txn-details">
                                            <h4 className="txn-merchant-name">{getMerchantName(txn)}</h4>
                                            <div className="txn-timestamp">{formatDateTime(txn.createdAt)}</div>
                                            <div className="txn-meta-info">
                                                <span className="txn-id-badge">ID: {txn.id.slice(0, 12)}...</span>
                                                <span className={`txn-status-badge ${status}`}>{status}</span>
                                            </div>
                                        </div>
                                        <div className="txn-amount-section">
                                            <div className={`txn-amount ${isInflow ? 'positive' : 'negative'}`}>
                                                {isInflow ? '+' : '-'} रु {txn.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                            <h2 className="txn-drawer-title">Transaction Details</h2>
                            <button className="txn-drawer-close" onClick={() => setSelectedTransaction(null)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="txn-drawer-content">
                            {/* Amount Section */}
                            <div className="txn-drawer-section">
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Amount</span>
                                    <span className={`txn-drawer-value large ${['balance_load', 'balance_topup', 'canteen_payment', 'reading_room', 'canteen_order', 'hostel_payment'].includes(selectedTransaction.type)
                                        ? 'positive'
                                        : 'negative'
                                        }`}>
                                        {['balance_load', 'balance_topup', 'canteen_payment', 'reading_room', 'canteen_order', 'hostel_payment'].includes(selectedTransaction.type) ? '+' : '-'} रु {selectedTransaction.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Transaction Info */}
                            <div className="txn-drawer-section">
                                <h3 className="txn-drawer-section-title">Transaction Information</h3>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Merchant/Receiver</span>
                                    <span className="txn-drawer-value">{getMerchantName(selectedTransaction)}</span>
                                </div>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Transaction ID</span>
                                    <span className="txn-drawer-value mono">{selectedTransaction.id}</span>
                                </div>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Type</span>
                                    <span className="txn-drawer-value">{selectedTransaction.type}</span>
                                </div>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Status</span>
                                    <span className={`txn-status-badge ${getTransactionStatus(selectedTransaction)}`}>
                                        {getTransactionStatus(selectedTransaction)}
                                    </span>
                                </div>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">User ID</span>
                                    <span className="txn-drawer-value mono">{selectedTransaction.userId || 'N/A'}</span>
                                </div>
                            </div>


                            {/* Transaction Parties */}
                            <div className="txn-drawer-section">
                                <h3 className="txn-drawer-section-title">Transaction Parties</h3>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Payment By:</span>
                                    <span className="txn-drawer-value">
                                        {selectedUserDetails?.mrrNumber
                                            ? `${selectedTransaction.userName || 'User'} (${selectedUserDetails.mrrNumber})`
                                            : (selectedTransaction.userName || `User ID: ${selectedTransaction.userId?.slice(0, 12)}...`)
                                        }
                                    </span>
                                </div>
                                <div className="txn-drawer-detail-row">
                                    <span className="txn-drawer-label">Payment To:</span>
                                    <span className="txn-drawer-value">
                                        {['balance_load', 'balance_topup'].includes(selectedTransaction.type)
                                            ? 'Mero Reading Room'
                                            : selectedTransaction.type === 'canteen_payment' || selectedTransaction.type === 'canteen_order'
                                                ? 'Canteen'
                                                : selectedTransaction.type === 'reading_room' || selectedTransaction.type === 'reading_room_payment'
                                                    ? 'Mero Reading Room'
                                                    : selectedTransaction.type === 'hostel_payment'
                                                        ? 'Hostel'
                                                        : ['refund', 'withdrawal', 'cashback'].includes(selectedTransaction.type)
                                                            ? selectedUserDetails?.mrrNumber
                                                                ? `${selectedTransaction.userName || 'User'} (${selectedUserDetails.mrrNumber})`
                                                                : (selectedTransaction.userName || `User ID: ${selectedTransaction.userId?.slice(0, 12)}...`)
                                                            : 'Business'
                                        }
                                    </span>
                                </div>
                            </div>



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

                            {/* Additional Details */}
                            {selectedTransaction.requestId && (
                                <div className="txn-drawer-section">
                                    <h3 className="txn-drawer-section-title">Additional Details</h3>
                                    <div className="txn-drawer-detail-row">
                                        <span className="txn-drawer-label">Request ID</span>
                                        <span className="txn-drawer-value mono">{selectedTransaction.requestId}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

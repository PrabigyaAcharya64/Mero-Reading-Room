import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ArrowUpRight, ArrowDownLeft, Search, X, Calendar } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { useLoading } from '../../context/GlobalLoadingContext';
import { useAdminHeader } from '../../context/AdminHeaderContext';
import '../../styles/TransactionStatement.css';

export default function AdminTransactionStatement({ onBack, onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const [allTransactions, setAllTransactions] = useState([]);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [selectedUserDetails, setSelectedUserDetails] = useState(null);

    const [searchParams] = useSearchParams();
    const [dateRange, setDateRange] = useState(() => searchParams.get('type') ? 'all' : 'today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') || 'all');

    useEffect(() => {
        setIsLoading(true);

        const txnQuery = collection(db, 'transactions');
        const ordersQuery = collection(db, 'orders');

        const unsubscribeTxn = onSnapshot(query(txnQuery, orderBy('createdAt', 'desc')), (snapshot) => {
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
            setIsLoading(false);
            onDataLoaded?.();
        }, (error) => {
            console.error("Error in transactions listener:", error);
            onSnapshot(txnQuery, (snapshot) => {
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
                setIsLoading(false);
                onDataLoaded?.();
            });
        });

        const unsubscribeOrders = onSnapshot(query(ordersQuery, orderBy('createdAt', 'desc')), (snapshot) => {
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
        }, (error) => {
            console.error("Error in orders listener:", error);
        });

        return () => {
            unsubscribeTxn?.();
            unsubscribeOrders?.();
        };
    }, []);

    // Filter and Group Transactions
    const groupedTransactions = useMemo(() => {
        let filtered = [...allTransactions];

        // Date range filter
        if (dateRange !== 'all') {
            const now = new Date();
            let startDate = new Date();
            switch (dateRange) {
                case 'today': startDate.setHours(0, 0, 0, 0); break;
                case '7days': startDate.setDate(now.getDate() - 7); break;
                case 'thisMonth': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
                case 'custom': if (customStartDate) startDate = new Date(customStartDate); break;
                default: startDate = new Date(0);
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

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(txn =>
                txn.details?.toLowerCase().includes(q) ||
                txn.id?.toLowerCase().includes(q) ||
                txn.userId?.toLowerCase().includes(q)
            );
        }

        // Module type filter
        if (typeFilter !== 'all') {
            const typeMap = {
                reading_room: ['reading_room'],
                hostel: ['hostel', 'hostel_renewal'],
                canteen: ['canteen_payment', 'canteen_order'],
                balance: ['balance_load', 'balance_topup'],
                other: ['refund', 'withdrawal', 'cashback']
            };
            const allowedTypes = typeMap[typeFilter] || [];
            filtered = filtered.filter(txn => allowedTypes.includes(txn.type));
        }

        // Group by Date
        const groups = {};
        filtered.forEach(txn => {
            const dateStr = txn.createdAt.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(txn);
        });

        // Return sorted groups
        return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
    }, [allTransactions, dateRange, customStartDate, customEndDate, searchQuery, typeFilter]);

    // Fetch user details for selected transaction
    useEffect(() => {
        if (!selectedTransaction?.userId) {
            setSelectedUserDetails(null);
            return;
        }
        getDoc(doc(db, 'users', selectedTransaction.userId)).then(snap => {
            if (snap.exists()) setSelectedUserDetails(snap.data());
        });
    }, [selectedTransaction]);

    const getMerchantName = (txn) => {
        if (txn.details) return txn.details;
        const types = {
            'balance_load': 'Balance Load',
            'balance_topup': 'Balance Top-up',
            'canteen_payment': 'Canteen Purchase',
            'canteen_order': 'Canteen Order',
            'reading_room': 'Reading Room Payment',
            'hostel': 'Hostel Room Fee',
            'hostel_renewal': 'Hostel Renewal',
            'refund': 'Refund',
            'withdrawal': 'Withdrawal',
            'cashback': 'Cashback'
        };
        return types[txn.type] || txn.type || 'Transaction';
    };

    const isInflow = (txn) => ['balance_load', 'balance_topup', 'canteen_payment', 'reading_room', 'canteen_order', 'hostel', 'hostel_renewal'].includes(txn.type);

    const { setHeader } = useAdminHeader();

    useEffect(() => {
        setHeader({
            actionBar: (
                <>
                    <div className="txn-filter-controls" style={{ padding: '0' }}>
                        <div className="txn-search-wrapper">
                            <Search className="txn-search-icon" size={18} />
                            <input
                                type="text"
                                className="txn-search-input"
                                placeholder="Search transactions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="txn-date-presets">
                            {['Today', '7 Days', 'This Month', 'All Time', 'Custom'].map((label) => {
                                const val = label.toLowerCase().replace(' ', '');
                                return (
                                    <button
                                        key={val}
                                        className={`txn-date-preset-btn ${dateRange === val ? 'active' : ''}`}
                                        onClick={() => setDateRange(val)}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {dateRange === 'custom' && (
                            <div className="txn-custom-date-container">
                                <div className="txn-date-input-row">
                                    <label>Start Date</label>
                                    <input
                                        type="date"
                                        className="txn-date-input"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="txn-date-input-row">
                                    <label>End Date</label>
                                    <input
                                        type="date"
                                        className="txn-date-input"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="txn-type-filter" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {[['all', 'All'], ['reading_room', 'Reading Room'], ['hostel', 'Hostel'], ['canteen', 'Canteen'], ['balance', 'Balance'], ['other', 'Other']].map(([val, label]) => (
                            <button
                                key={val}
                                className={`txn-date-preset-btn ${typeFilter === val ? 'active' : ''}`}
                                onClick={() => setTypeFilter(val)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </>
            )
        });

        // Cleanup: Remove ALL header customizations when leaving this page
        return () => {
            setHeader({ title: '', actionBar: null, rightElement: null, onBack: null });
        };
    }, [setHeader, searchQuery, setSearchQuery, dateRange, setDateRange, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, typeFilter]);

    return (
        <div className="txn-container">
            <div className="std-body">

                {/* Transaction List Grouped */}
                <div className="txn-content">
                    <div className="txn-content-inner">
                        {groupedTransactions.length === 0 ? (
                            <div className="txn-empty-state">
                                <Calendar className="txn-empty-icon" size={48} />
                                <p className="txn-empty-text">No Transactions</p>
                            </div>
                        ) : (
                            groupedTransactions.map(([date, transactions]) => (
                                <div key={date} className="txn-date-group">
                                    <div className="txn-date-group-header">{date}</div>
                                    <div className="txn-list-section">
                                        {transactions.map(txn => {
                                            const inflow = isInflow(txn);
                                            const Icon = inflow ? ArrowDownLeft : ArrowUpRight;
                                            return (
                                                <div
                                                    key={txn.id}
                                                    className="txn-item"
                                                    onClick={() => setSelectedTransaction(txn)}
                                                >
                                                    <div className={`txn-icon ${inflow ? 'inflow' : 'outflow'}`}>
                                                        <Icon size={18} />
                                                    </div>
                                                    <div className="txn-details">
                                                        <h4 className="txn-merchant-name">{getMerchantName(txn)}</h4>
                                                        <div className="txn-timestamp">
                                                            {txn.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div className="txn-amount-section">
                                                        <div className={`txn-amount ${inflow ? 'positive' : 'negative'}`}>
                                                            {inflow ? '+' : '-'} रु {txn.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Transaction Detail Modal */}
                {selectedTransaction && (
                    <div className="txn-drawer-overlay" onClick={() => setSelectedTransaction(null)}>
                        <div className="txn-drawer" onClick={(e) => e.stopPropagation()}>
                            <div className="txn-drawer-header">
                                <h2 className="txn-drawer-title">Details</h2>
                                <button className="txn-drawer-close" onClick={() => setSelectedTransaction(null)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="txn-drawer-content">
                                <div className="txn-drawer-value large">
                                    रु {selectedTransaction.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>

                                <div className="txn-drawer-section">
                                    <div className="txn-drawer-section-title">Information</div>
                                    <div className="txn-drawer-card">
                                        <div className="txn-drawer-detail-row">
                                            <span className="txn-drawer-label">Merchant</span>
                                            <span className="txn-drawer-value">{getMerchantName(selectedTransaction)}</span>
                                        </div>
                                        <div className="txn-drawer-detail-row">
                                            <span className="txn-drawer-label">Reference</span>
                                            <span className="txn-drawer-value mono">{selectedTransaction.id.slice(0, 16)}...</span>
                                        </div>
                                        <div className="txn-drawer-detail-row">
                                            <span className="txn-drawer-label">Status</span>
                                            <span className={`txn-drawer-value ${selectedTransaction.status === 'error' ? 'negative' : 'positive'}`}>
                                                {selectedTransaction.status || 'Success'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="txn-drawer-section">
                                    <div className="txn-drawer-section-title">Parties</div>
                                    <div className="txn-drawer-card">
                                        <div className="txn-drawer-detail-row">
                                            <span className="txn-drawer-label">From</span>
                                            <span className="txn-drawer-value">
                                                {isInflow(selectedTransaction)
                                                    ? (selectedUserDetails?.mrrNumber ? `${selectedTransaction.userName} (${selectedUserDetails.mrrNumber})` : (selectedTransaction.userName || 'User'))
                                                    : 'Mero Reading Room'}
                                            </span>
                                        </div>
                                        <div className="txn-drawer-detail-row">
                                            <span className="txn-drawer-label">To</span>
                                            <span className="txn-drawer-value">
                                                {isInflow(selectedTransaction)
                                                    ? (['canteen_payment', 'canteen_order'].includes(selectedTransaction.type) ? 'Canteen' : 'Mero Reading Room')
                                                    : (selectedUserDetails?.mrrNumber ? `${selectedTransaction.userName} (${selectedUserDetails.mrrNumber})` : (selectedTransaction.userName || 'User'))}

                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="txn-drawer-section">
                                    <div className="txn-drawer-section-title">Date & Time</div>
                                    <div className="txn-drawer-card">
                                        <div className="txn-drawer-detail-row">
                                            <span className="txn-drawer-label">Timestamp</span>
                                            <span className="txn-drawer-value">
                                                {selectedTransaction.createdAt.toLocaleString('en-US', {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

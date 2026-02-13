import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    ArrowDownLeft,
    ArrowUpRight,
    Settings,
    Calendar,
    ChevronDown
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useLoading } from '../../../context/GlobalLoadingContext';

import '../../../styles/AccountDashboard.css';

const COLORS = {
    earning: '#10b981',
    expense: '#ef4444',
    profit: '#6366f1',
    hostel: '#8b5cf6',
    canteen: '#f59e0b',
    readingRoom: '#3b82f6',
    inventory: '#ec4899',
    manual: '#6b7280'
};

const PIE_COLORS = ['#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899', '#6b7280'];

export default function AccountDashboard({ onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const [timeRange, setTimeRange] = useState('6m');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Data states
    const [rawData, setRawData] = useState({
        transactions: [],
        orders: [],
        manualExpenses: [],
        manualEarnings: [],
        inventoryPurchases: []
    });

    // Calculate date cutoff based on time range
    const getDateCutoff = () => {
        const now = new Date();
        if (timeRange === 'custom') {
            return customStartDate ? new Date(customStartDate) : new Date(0);
        }
        const cutoff = new Date();
        switch (timeRange) {
            case '1m': cutoff.setMonth(now.getMonth() - 1); break;
            case '3m': cutoff.setMonth(now.getMonth() - 3); break;
            case '6m': cutoff.setMonth(now.getMonth() - 6); break;
            case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
            default: cutoff.setMonth(now.getMonth() - 6);
        }
        return cutoff;
    };

    const getEndDate = () => {
        if (timeRange === 'custom' && customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            return end;
        }
        return new Date();
    };

    // Set loading true on mount (handles page refresh case)
    useEffect(() => {
        setIsLoading(true);
    }, []);

    // Fetch all data
    useEffect(() => {
        setLoading(true);

        const unsubscribers = [];

        // Listen to transactions
        const txnUnsub = onSnapshot(collection(db, 'transactions'), (snapshot) => {
            const transactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt || doc.data().date)
            }));
            setRawData(prev => ({ ...prev, transactions }));
        });
        unsubscribers.push(txnUnsub);

        // Listen to orders
        const ordersUnsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
            const orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
                amount: doc.data().total || 0
            }));
            setRawData(prev => ({ ...prev, orders }));
        });
        unsubscribers.push(ordersUnsub);

        // Listen to manual expenses
        const expensesUnsub = onSnapshot(collection(db, 'manual_expenses'), (snapshot) => {
            const expenses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate?.() || new Date(doc.data().date)
            }));
            setRawData(prev => ({ ...prev, manualExpenses: expenses }));
        });
        unsubscribers.push(expensesUnsub);

        // Listen to manual earnings
        const earningsUnsub = onSnapshot(collection(db, 'manual_earnings'), (snapshot) => {
            const earnings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate?.() || new Date(doc.data().date)
            }));
            setRawData(prev => ({ ...prev, manualEarnings: earnings }));
        });
        unsubscribers.push(earningsUnsub);

        // Listen to inventory purchases
        const invUnsub = onSnapshot(collection(db, 'inventory_purchases'), (snapshot) => {
            const purchases = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().purchaseDate?.toDate?.() || new Date(doc.data().purchaseDate || doc.data().createdAt)
            }));
            setRawData(prev => ({ ...prev, inventoryPurchases: purchases }));
            setLoading(false);
            onDataLoaded?.();
        });
        unsubscribers.push(invUnsub);

        return () => unsubscribers.forEach(unsub => unsub());
    }, []);

    // Calculate aggregated data based on time range
    const aggregatedData = useMemo(() => {
        const cutoff = getDateCutoff();
        const endDate = getEndDate();

        // Filter by date range
        const filterByDate = (items) => items.filter(item => {
            const d = item.date;
            return d >= cutoff && d <= endDate;
        });

        const filteredTxns = filterByDate(rawData.transactions);
        const filteredOrders = filterByDate(rawData.orders);
        const filteredExpenses = filterByDate(rawData.manualExpenses);
        const filteredPurchases = filterByDate(rawData.inventoryPurchases);
        const filteredManualEarnings = filterByDate(rawData.manualEarnings);

        // Calculate earnings by source
        const hostelEarnings = filteredTxns
            .filter(t => t.type === 'hostel' || t.type === 'hostel_renewal')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        const readingRoomEarnings = filteredTxns
            .filter(t => t.type === 'reading_room' || t.type === 'reading_room_renewal')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        const canteenEarnings = filteredOrders
            .filter(o => o.status === 'completed' || o.status === 'success')
            .reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

        const manualEarningsTotal = filteredManualEarnings.reduce((sum, e) => sum + (e.amount || 0), 0);

        const totalEarnings = hostelEarnings + readingRoomEarnings + canteenEarnings + manualEarningsTotal;

        // Calculate expenses
        const manualExpenseTotal = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const inventoryExpenseTotal = filteredPurchases.reduce((sum, p) => sum + (p.totalCost || (p.quantity * p.unitPrice) || 0), 0);
        const totalExpenses = manualExpenseTotal + inventoryExpenseTotal;

        const netProfit = totalEarnings - totalExpenses;

        return {
            totalEarnings,
            totalExpenses,
            netProfit,
            breakdown: {
                hostel: hostelEarnings,
                readingRoom: readingRoomEarnings,
                canteen: canteenEarnings,
                manualEarnings: manualEarningsTotal,
                manualExpenses: manualExpenseTotal,
                inventoryExpenses: inventoryExpenseTotal
            },
            filteredTxns,
            filteredOrders,
            filteredExpenses,
            filteredPurchases
        };
    }, [rawData, timeRange, customStartDate, customEndDate]);

    // Generate chart data for area chart
    const areaChartData = useMemo(() => {
        const cutoff = getDateCutoff();
        const endDate = getEndDate();
        const data = [];

        // Determine granularity based on time range
        if (timeRange === '1m') {
            // Daily for 1 month
            for (let i = 30; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                d.setHours(0, 0, 0, 0);
                const nextD = new Date(d);
                nextD.setDate(nextD.getDate() + 1);

                const earnings = rawData.transactions
                    .filter(t => ['hostel', 'hostel_renewal', 'reading_room', 'reading_room_renewal'].includes(t.type) && t.date >= d && t.date < nextD)
                    .reduce((s, t) => s + (t.amount || 0), 0) +
                    rawData.orders
                        .filter(o => o.date >= d && o.date < nextD && (o.status === 'completed' || o.status === 'success'))
                        .reduce((s, o) => s + (o.amount || o.total || 0), 0) +
                    rawData.manualEarnings
                        .filter(e => e.date >= d && e.date < nextD)
                        .reduce((s, e) => s + (e.amount || 0), 0);

                const expenses = rawData.manualExpenses
                    .filter(e => e.date >= d && e.date < nextD)
                    .reduce((s, e) => s + (e.amount || 0), 0) +
                    rawData.inventoryPurchases
                        .filter(p => p.date >= d && p.date < nextD)
                        .reduce((s, p) => s + (p.totalCost || 0), 0);

                data.push({
                    name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    earnings,
                    expenses
                });
            }
        } else {
            // Monthly for longer periods
            const months = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            for (let i = months - 1; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const monthIdx = d.getMonth();
                const year = d.getFullYear();

                const earnings = rawData.transactions
                    .filter(t => ['hostel', 'hostel_renewal', 'reading_room', 'reading_room_renewal'].includes(t.type) && t.date.getMonth() === monthIdx && t.date.getFullYear() === year)
                    .reduce((s, t) => s + (t.amount || 0), 0) +
                    rawData.orders
                        .filter(o => o.date.getMonth() === monthIdx && o.date.getFullYear() === year && (o.status === 'completed' || o.status === 'success'))
                        .reduce((s, o) => s + (o.amount || o.total || 0), 0) +
                    rawData.manualEarnings
                        .filter(e => e.date.getMonth() === monthIdx && e.date.getFullYear() === year)
                        .reduce((s, e) => s + (e.amount || 0), 0);

                const expenses = rawData.manualExpenses
                    .filter(e => e.date.getMonth() === monthIdx && e.date.getFullYear() === year)
                    .reduce((s, e) => s + (e.amount || 0), 0) +
                    rawData.inventoryPurchases
                        .filter(p => p.date.getMonth() === monthIdx && p.date.getFullYear() === year)
                        .reduce((s, p) => s + (p.totalCost || 0), 0);

                data.push({
                    name: monthNames[monthIdx],
                    earnings,
                    expenses
                });
            }
        }

        return data;
    }, [rawData, timeRange]);

    // Pie chart data for expense breakdown
    const expensePieData = useMemo(() => {
        const { breakdown } = aggregatedData;
        return [
            { name: 'Inventory', value: breakdown.inventoryExpenses, color: COLORS.inventory },
            { name: 'Manual Expenses', value: breakdown.manualExpenses, color: COLORS.manual }
        ].filter(d => d.value > 0);
    }, [aggregatedData]);

    // Earnings breakdown for bar chart
    const earningsBreakdownData = useMemo(() => {
        const { breakdown } = aggregatedData;
        return [
            { name: 'Hostel', value: breakdown.hostel },
            { name: 'Canteen', value: breakdown.canteen },
            { name: 'Reading Room', value: breakdown.readingRoom },
            { name: 'Manual Earnings', value: breakdown.manualEarnings }
        ];
    }, [aggregatedData]);

    const timeRangeOptions = [
        { key: '1m', label: '1 Month' },
        { key: '3m', label: '3 Months' },
        { key: '6m', label: '6 Months' },
        { key: '1y', label: '1 Year' },
        { key: 'custom', label: 'Custom' }
    ];

    if (loading) {
        return (
            <div className="account-dashboard">
                <div className="account-dashboard-content">
                    <div className="kpi-cards-grid">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton skeleton-kpi"></div>
                        ))}
                    </div>
                    <div className="charts-grid">
                        <div className="skeleton skeleton-chart"></div>
                        <div className="skeleton skeleton-chart"></div>
                    </div>
                </div>
            </div>
        );
    }

    // eslint-disable-next-line
    const navigate = (path) => {
        // We can't navigate directly inside this component since it's used inside AdminLanding's Router
        // But since we are likely inside a Router context, we could use useNavigate()
        // But to avoid adding a new hook import if not already there, let's check imports
        // Ah, I need to add useNavigate.
        window.location.href = path; // Simple fallback or I should add useNavigate
    };

    return (
        <div className="account-dashboard">
            <div className="account-dashboard-content">
                {/* Top Bar */}


                {/* Header Controls: Time Range (Left) & Manage Button (Right) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    {/* Time Range Picker */}
                    <div className="time-range-picker" style={{ marginBottom: 0 }}>
                        {timeRangeOptions.map(opt => (
                            <button
                                key={opt.key}
                                className={`time-range-btn ${timeRange === opt.key ? 'active' : ''}`}
                                onClick={() => setTimeRange(opt.key)}
                            >
                                {opt.label}
                            </button>
                        ))}
                        {timeRange === 'custom' && (
                            <div className="custom-date-picker">
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    placeholder="Start Date"
                                />
                                <span>to</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    placeholder="End Date"
                                />
                            </div>
                        )}
                    </div>

                    <a href="/admin/expense-earning-management" className="manage-expenses-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Settings size={18} />
                        Manage
                    </a>
                </div>

                {/* KPI Cards */}
                <div className="kpi-cards-grid">
                    {/* Total Earnings Card */}
                    <div className="kpi-card earning">
                        <div className="kpi-card-header">
                            <div>
                                <p className="kpi-card-label">Total Earnings</p>
                                <h3 className="kpi-card-value">रु {aggregatedData.totalEarnings.toLocaleString()}</h3>
                            </div>
                            <div className="kpi-card-icon">
                                <ArrowDownLeft size={20} />
                            </div>
                        </div>
                        <p className="kpi-card-trend positive">
                            <TrendingUp size={14} /> Hostel + Canteen + Reading Room + Manual
                        </p>
                    </div>

                    {/* Total Expenses Card */}
                    <div className="kpi-card expense">
                        <div className="kpi-card-header">
                            <div>
                                <p className="kpi-card-label">Total Expenses</p>
                                <h3 className="kpi-card-value">रु {aggregatedData.totalExpenses.toLocaleString()}</h3>
                            </div>
                            <div className="kpi-card-icon">
                                <ArrowUpRight size={20} />
                            </div>
                        </div>
                        <p className="kpi-card-trend negative">
                            <TrendingDown size={14} /> Inventory + Manual Expenses
                        </p>
                    </div>

                    {/* Net Profit Card */}
                    <div className="kpi-card profit">
                        <div className="kpi-card-header">
                            <div>
                                <p className="kpi-card-label">Net Profit</p>
                                <h3 className="kpi-card-value" style={{ color: aggregatedData.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                    रु {aggregatedData.netProfit.toLocaleString()}
                                </h3>
                            </div>
                            <div className="kpi-card-icon">
                                <Wallet size={20} />
                            </div>
                        </div>
                        <p className={`kpi-card-trend ${aggregatedData.netProfit >= 0 ? 'positive' : 'negative'}`}>
                            {aggregatedData.netProfit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            Earnings - Expenses
                        </p>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="charts-grid">
                    {/* Area Chart - Earnings vs Expenses over time */}
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <div>
                                <h3 className="chart-card-title">Earnings vs Expenses</h3>
                                <p className="chart-card-subtitle">Financial flow over selected period</p>
                            </div>
                        </div>
                        <div className="chart-container">
                            {areaChartData.some(d => d.earnings > 0 || d.expenses > 0) ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <AreaChart data={areaChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={COLORS.earning} stopOpacity={0.8} />
                                                <stop offset="95%" stopColor={COLORS.earning} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={COLORS.expense} stopOpacity={0.8} />
                                                <stop offset="95%" stopColor={COLORS.expense} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                        <CartesianGrid vertical={false} stroke="#f3f4f6" />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            formatter={(value) => [`रु ${value.toLocaleString()}`, '']}
                                        />
                                        <Legend verticalAlign="top" height={36} />
                                        <Area type="monotone" dataKey="earnings" name="Earnings" stroke={COLORS.earning} fillOpacity={1} fill="url(#colorEarnings)" strokeWidth={3} />
                                        <Area type="monotone" dataKey="expenses" name="Expenses" stroke={COLORS.expense} fillOpacity={1} fill="url(#colorExpenses)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state">
                                    <Calendar className="empty-state-icon" size={48} />
                                    <p className="empty-state-text">No data for this period</p>
                                    <p className="empty-state-subtext">Try selecting a different time range</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pie Chart - Expense Breakdown */}
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <div>
                                <h3 className="chart-card-title">Expense Categories</h3>
                                <p className="chart-card-subtitle">Distribution of expenses</p>
                            </div>
                        </div>
                        <div className="chart-container small">
                            {expensePieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <PieChart>
                                        <Pie
                                            data={expensePieData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {expensePieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => [`रु ${value.toLocaleString()}`, '']} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state">
                                    <p className="empty-state-text">No expenses recorded</p>
                                </div>
                            )}
                        </div>
                        <div className="pie-legend">
                            {expensePieData.map((item, idx) => (
                                <div key={idx} className="pie-legend-item">
                                    <span className="pie-legend-label">
                                        <span className="pie-legend-dot" style={{ backgroundColor: item.color }}></span>
                                        {item.name}
                                    </span>
                                    <span className="pie-legend-value">रु {item.value.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Earnings Breakdown Bar Chart */}
                <div className="comparison-chart-section">
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <div>
                                <h3 className="chart-card-title">Revenue Sources</h3>
                                <p className="chart-card-subtitle">Breakdown of earnings by category</p>
                            </div>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart data={earningsBreakdownData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 500 }} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={(value) => [`रु ${value.toLocaleString()}`, '']}
                                    />
                                    <Bar dataKey="value" fill="#111827" radius={[0, 4, 4, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

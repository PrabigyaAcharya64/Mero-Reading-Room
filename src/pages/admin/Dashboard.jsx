import React, { useState, useEffect, useRef } from 'react';
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
    Legend
} from 'recharts';
import {
    Users,
    CreditCard,
    ShoppingCart,
    ShoppingBag,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    ChevronDown,
    Calendar
} from 'lucide-react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useLoading } from '../../context/GlobalLoadingContext';
import PageHeader from '../../components/PageHeader';
import '../../styles/Dashboard.css';

function Dashboard({ onNavigate, onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const [timeRange, setTimeRange] = useState('6m');
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const selectRef = useRef(null);

    const [stats, setStats] = useState({
        readingRoomSales: 0,
        canteenSales: 0,
        totalEarnings: 0
    });
    const [chartData, setChartData] = useState([]);
    const [salesBreakdown, setSalesBreakdown] = useState([]);

    const timeRangeLabels = {
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '6m': 'Last 6 Months',
        '12m': 'Last 12 Months',
        '3y': 'Last 3 Years'
    };

    // Set loading true on mount (handles page refresh case)
    useEffect(() => {
        setIsLoading(true);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsSelectOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const ordersRef = collection(db, 'orders');
                const transactionsRef = collection(db, 'transactions');

                // Standard Batch Reveal Pattern: Promise.all for all initial fetches
                const [ordersSnapshot, transactionsSnapshot] = await Promise.all([
                    getDocs(query(ordersRef, orderBy('createdAt', 'desc'))),
                    getDocs(query(transactionsRef, orderBy('date', 'desc')))
                ]);

                const orders = ordersSnapshot.docs.map(doc => ({
                    ...doc.data(),
                    date: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt),
                    amount: doc.data().total || 0,
                    type: 'canteen'
                }));

                const transactions = transactionsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    let transactionDate = new Date();
                    if (data.date) {
                        if (typeof data.date === 'string') {
                            transactionDate = new Date(data.date);
                        } else if (data.date.toDate) {
                            transactionDate = data.date.toDate();
                        }
                    }
                    return {
                        ...data,
                        date: transactionDate,
                        amount: data.amount || 0,
                        type: 'reading_room'
                    };
                });

                const now = new Date();
                let cutoff = new Date();
                if (timeRange === '7d') cutoff.setDate(now.getDate() - 7);
                else if (timeRange === '30d') cutoff.setDate(now.getDate() - 30);
                else if (timeRange === '6m') cutoff.setMonth(now.getMonth() - 6);
                else if (timeRange === '12m') cutoff.setMonth(now.getMonth() - 12);
                else if (timeRange === '3y') cutoff.setFullYear(now.getFullYear() - 3);

                const filteredOrders = orders.filter(o => o.date >= cutoff);
                const filteredTxns = transactions.filter(t => t.date >= cutoff);

                const totalCanteen = filteredOrders.reduce((sum, order) => sum + order.amount, 0);
                const totalReadingRoom = filteredTxns.reduce((sum, txn) => sum + txn.amount, 0);

                const newChartData = [];
                const allSales = [...filteredOrders, ...filteredTxns];

                if (timeRange === '7d' || timeRange === '30d') {
                    const daysToFetch = timeRange === '7d' ? 7 : 30;
                    for (let i = daysToFetch - 1; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const dayData = { name: dateStr, readingRoom: 0, canteen: 0 };
                        allSales.forEach(sale => {
                            if (sale.date.toDateString() === d.toDateString()) {
                                if (sale.type === 'canteen') dayData.canteen += sale.amount;
                                else dayData.readingRoom += sale.amount;
                            }
                        });
                        newChartData.push(dayData);
                    }
                } else if (timeRange === '6m' || timeRange === '12m') {
                    const monthsToFetch = timeRange === '6m' ? 6 : 12;
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    for (let i = monthsToFetch - 1; i >= 0; i--) {
                        const d = new Date();
                        d.setMonth(d.getMonth() - i);
                        const monthIdx = d.getMonth();
                        const year = d.getFullYear();
                        const monthData = { name: months[monthIdx], readingRoom: 0, canteen: 0 };
                        allSales.forEach(sale => {
                            if (sale.date.getMonth() === monthIdx && sale.date.getFullYear() === year) {
                                if (sale.type === 'canteen') monthData.canteen += sale.amount;
                                else monthData.readingRoom += sale.amount;
                            }
                        });
                        newChartData.push(monthData);
                    }
                } else if (timeRange === '3y') {
                    for (let i = 2; i >= 0; i--) {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() - i);
                        const year = d.getFullYear();
                        const yearData = { name: year.toString(), readingRoom: 0, canteen: 0 };
                        allSales.forEach(sale => {
                            if (sale.date.getFullYear() === year) {
                                if (sale.type === 'canteen') yearData.canteen += sale.amount;
                                else yearData.readingRoom += sale.amount;
                            }
                        });
                        newChartData.push(yearData);
                    }
                }

                // Update all state together
                setStats({
                    readingRoomSales: totalReadingRoom,
                    canteenSales: totalCanteen,
                    totalEarnings: totalCanteen + totalReadingRoom
                });
                setChartData(newChartData);
                setSalesBreakdown([
                    { name: 'Reading Room', value: totalReadingRoom },
                    { name: 'Canteen', value: totalCanteen }
                ]);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchData().finally(() => {
            onDataLoaded?.();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange]);


    return (
        <div className="dashboard-container">
            <div className="dashboard-content" style={{ padding: '24px' }}>
                <p style={{ color: '#6b7280', marginBottom: '24px' }}>Welcome back, Admin. Here's what's happening today.</p>

                {/* Top Stats Row - Original Inline Styles Restored */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '24px',
                    marginBottom: '32px'
                }}>
                    {/* Card 1: Reading Room Sales */}
                    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Reading Room Sales</p>
                                <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                                    रु {stats.readingRoomSales.toLocaleString()}
                                </h3>
                            </div>
                            <div style={{ padding: '10px', backgroundColor: '#eff6ff', borderRadius: '12px', color: '#3b82f6' }}>
                                <TrendingUp size={20} />
                            </div>
                        </div>
                        <p style={{ fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Effective Revenue
                        </p>
                    </div>

                    {/* Card 2: Canteen Sales */}
                    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Canteen Revenue</p>
                                <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                                    रु {stats.canteenSales.toLocaleString()}
                                </h3>
                            </div>
                            <div style={{ padding: '10px', backgroundColor: '#fef3c7', borderRadius: '12px', color: '#d97706' }}>
                                <ShoppingCart size={20} />
                            </div>
                        </div>
                        <p style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Updated in realtime
                        </p>
                    </div>

                    {/* Card 3: Total Earnings */}
                    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Total Revenue</p>
                                <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                                    रु {stats.totalEarnings.toLocaleString()}
                                </h3>
                            </div>
                            <div style={{ padding: '10px', backgroundColor: '#ecfdf5', borderRadius: '12px', color: '#059669' }}>
                                <CreditCard size={20} />
                            </div>
                        </div>
                        <p style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={14} /> Filtered View
                        </p>
                    </div>
                </div>

                {/* Main Content Grid - Original Responsive Settings */}
                <div className="db-charts-grid">

                    {/* Main Chart Card */}
                    <div style={{
                        backgroundColor: '#fff',
                        padding: '24px',
                        borderRadius: '16px',
                        border: '1px solid #e5e7eb',
                        height: '400px',
                        position: 'relative',
                        minWidth: 0
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>Revenue Trends</h3>

                            {/* CUSTOM DROPDOWN ONLY */}
                            <div className="db-select-wrapper" ref={selectRef}>
                                <div
                                    className={`db-select-trigger ${isSelectOpen ? 'open' : ''}`}
                                    onClick={() => setIsSelectOpen(!isSelectOpen)}
                                >
                                    <span>{timeRangeLabels[timeRange]}</span>
                                    <ChevronDown size={16} style={{
                                        transform: isSelectOpen ? 'rotate(180deg)' : 'none',
                                        transition: 'transform 0.2s',
                                        marginLeft: '8px'
                                    }} />
                                </div>

                                {isSelectOpen && (
                                    <div className="db-select-options">
                                        {Object.entries(timeRangeLabels).map(([key, label]) => (
                                            <div
                                                key={key}
                                                className={`db-select-option ${timeRange === key ? 'active' : ''}`}
                                                onClick={() => {
                                                    setTimeRange(key);
                                                    setIsSelectOpen(false);
                                                }}
                                            >
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="85%" minWidth={0} minHeight={0}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCanteen" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                                />
                                <CartesianGrid vertical={false} stroke="#f3f4f6" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => [`रु ${value.toLocaleString()}`, '']}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Area type="monotone" dataKey="readingRoom" name="Reading Room" stroke="#8884d8" fillOpacity={1} fill="url(#colorRr)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                                <Area type="monotone" dataKey="canteen" name="Canteen" stroke="#82ca9d" fillOpacity={1} fill="url(#colorCanteen)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Breakdown Chart Card */}
                    <div style={{
                        backgroundColor: '#fff',
                        padding: '24px',
                        borderRadius: '16px',
                        border: '1px solid #e5e7eb',
                        height: '400px',
                        position: 'relative',
                        minWidth: 0
                    }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>Revenue Sources</h3>
                        <ResponsiveContainer width="100%" height="60%" minWidth={0} minHeight={0}>
                            <BarChart data={salesBreakdown} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 500 }} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => [`रु ${value.toLocaleString()}`, '']}
                                />
                                <Bar dataKey="value" fill="#111827" radius={[0, 4, 4, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>

                        <div style={{ marginTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Reading Room</span>
                                <span style={{ fontWeight: '600', color: '#111827' }}>रु {stats.readingRoomSales.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Canteen</span>
                                <span style={{ fontWeight: '600', color: '#111827' }}>रु {stats.canteenSales.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;

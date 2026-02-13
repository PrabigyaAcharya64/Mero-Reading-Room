import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
    Users,
    CreditCard,
    ShoppingCart,
    TrendingUp,
    ChevronDown,
    Calendar,
    Building,
    Armchair
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useLoading } from '../../../context/GlobalLoadingContext';
import '../../../styles/Dashboard.css';

const PIE_COLORS = ['#007AFF', '#34C759', '#FF9F0A', '#AF52DE', '#F59E0B']; // Added Amber for Hostel
const MEMBER_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];

function Dashboard({ onNavigate, onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState('6m');
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const selectRef = useRef(null);

    const [orders, setOrders] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [users, setUsers] = useState([]);
    const [hostelRooms, setHostelRooms] = useState([]);
    const [hostelAssignments, setHostelAssignments] = useState([]);
    const [seatAssignments, setSeatAssignments] = useState([]);

    const [dashboardReady, setDashboardReady] = useState(false);
    const dataLoadedRef = useRef(false);
    const timerDoneRef = useRef(false);

    const timeRangeLabels = {
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '6m': 'Last 6 Months',
        '12m': 'Last 12 Months',
        '3y': 'Last 3 Years'
    };

    useEffect(() => { setIsLoading(true); }, []);

    // 1.5 second minimum loading timer
    useEffect(() => {
        const timer = setTimeout(() => {
            timerDoneRef.current = true;
            if (dataLoadedRef.current) setDashboardReady(true);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

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
                const [ordersSnap, txnSnap, usersSnap, hostelRoomsSnap, hostelAssignSnap, seatAssignSnap] = await Promise.all([
                    getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
                    getDocs(query(collection(db, 'transactions'), orderBy('date', 'desc'))),
                    getDocs(query(collection(db, 'users'), where('verified', '==', true))),
                    getDocs(collection(db, 'hostelRooms')),
                    getDocs(collection(db, 'hostelAssignments')),
                    getDocs(collection(db, 'seatAssignments'))
                ]);

                setOrders(ordersSnap.docs.map(doc => ({
                    ...doc.data(),
                    date: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt),
                    amount: doc.data().total || 0,
                    type: 'canteen'
                })));

                setTransactions(txnSnap.docs.map(doc => {
                    const data = doc.data();
                    let transactionDate = new Date();
                    if (data.date) {
                        if (typeof data.date === 'string') transactionDate = new Date(data.date);
                        else if (data.date.toDate) transactionDate = data.date.toDate();
                    }
                    // Respect the valid types: 'reading_room', 'reading_room_renewal', 'hostel_renewal', 'hostel', etc.
                    // Fallback to 'reading_room' only if type is missing or generic 'payment'
                    let type = data.type || 'reading_room';

                    return { ...data, date: transactionDate, amount: data.amount || 0, type };
                }));

                setUsers(usersSnap.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id,
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : (doc.data().joinedAt ? new Date(doc.data().joinedAt) : new Date())
                })));
                setHostelRooms(hostelRoomsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setHostelAssignments(hostelAssignSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status === 'active'));
                setSeatAssignments(seatAssignSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchData().finally(() => {
            dataLoadedRef.current = true;
            if (timerDoneRef.current) setDashboardReady(true);
            onDataLoaded?.();
        });
    }, []);

    // ── Time filtering ──
    const cutoff = useMemo(() => {
        const now = new Date();
        const c = new Date();
        if (timeRange === '7d') c.setDate(now.getDate() - 7);
        else if (timeRange === '30d') c.setDate(now.getDate() - 30);
        else if (timeRange === '6m') c.setMonth(now.getMonth() - 6);
        else if (timeRange === '12m') c.setMonth(now.getMonth() - 12);
        else if (timeRange === '3y') c.setFullYear(now.getFullYear() - 3);
        return c;
    }, [timeRange]);

    // ── Stat Cards ──
    const stats = useMemo(() => {
        const filteredOrders = orders.filter(o => o.date >= cutoff);
        const filteredTxns = transactions.filter(t => t.date >= cutoff);
        // Filter users by creation date to show "New Members" in this period
        const filteredUsers = users.filter(u => u.createdAt >= cutoff);

        const totalCanteen = filteredOrders.reduce((sum, o) => sum + o.amount, 0);

        // Reading Room Revenue: includes 'reading_room' and 'reading_room_renewal'
        const totalReadingRoom = filteredTxns
            .filter(t => t.type === 'reading_room' || t.type === 'reading_room_renewal')
            .reduce((sum, t) => sum + t.amount, 0);

        // Hostel Revenue (from transactions): includes 'hostel' and 'hostel_renewal'
        const totalHostelTxn = filteredTxns
            .filter(t => t.type === 'hostel' || t.type === 'hostel_renewal')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalBeds = hostelRooms.reduce((s, r) => s + (r.capacity || 1), 0);
        const occupiedBeds = hostelAssignments.length;

        return {
            newMembers: filteredUsers.length,
            readingRoomSales: totalReadingRoom,
            canteenSales: totalCanteen,
            totalEarnings: totalCanteen + totalReadingRoom + totalHostelTxn,
            hostelRevenue: totalHostelTxn,
            totalBeds,
            occupiedBeds,
            rrOccupied: seatAssignments.length
        };
    }, [orders, transactions, users, hostelRooms, hostelAssignments, seatAssignments, cutoff]);

    // ── Revenue Trend Chart ──
    const chartData = useMemo(() => {
        const filteredOrders = orders.filter(o => o.date >= cutoff);
        const filteredTxns = transactions.filter(t => t.date >= cutoff);
        const allSales = [...filteredOrders, ...filteredTxns];
        const data = [];

        if (timeRange === '7d' || timeRange === '30d') {
            const days = timeRange === '7d' ? 7 : 30;
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const dayData = { name: dateStr, readingRoom: 0, canteen: 0, hostel: 0 };
                allSales.forEach(sale => {
                    if (sale.date.toDateString() === d.toDateString()) {
                        if (sale.type === 'canteen') dayData.canteen += sale.amount;
                        else if (sale.type === 'hostel' || sale.type === 'hostel_renewal') dayData.hostel += sale.amount;
                        else if (sale.type === 'reading_room' || sale.type === 'reading_room_renewal') dayData.readingRoom += sale.amount;
                    }
                });
                data.push(dayData);
            }
        } else if (timeRange === '6m' || timeRange === '12m') {
            const months = timeRange === '6m' ? 6 : 12;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            for (let i = months - 1; i >= 0; i--) {
                const d = new Date(); d.setMonth(d.getMonth() - i);
                const mi = d.getMonth(), yr = d.getFullYear();
                const monthData = { name: monthNames[mi], readingRoom: 0, canteen: 0, hostel: 0 };
                allSales.forEach(sale => {
                    if (sale.date.getMonth() === mi && sale.date.getFullYear() === yr) {
                        if (sale.type === 'canteen') monthData.canteen += sale.amount;
                        else if (sale.type === 'hostel' || sale.type === 'hostel_renewal') monthData.hostel += sale.amount;
                        else if (sale.type === 'reading_room' || sale.type === 'reading_room_renewal') monthData.readingRoom += sale.amount;
                    }
                });
                data.push(monthData);
            }
        } else if (timeRange === '3y') {
            for (let i = 2; i >= 0; i--) {
                const yr = new Date().getFullYear() - i;
                const yearData = { name: yr.toString(), readingRoom: 0, canteen: 0, hostel: 0 };
                allSales.forEach(sale => {
                    if (sale.date.getFullYear() === yr) {
                        if (sale.type === 'canteen') yearData.canteen += sale.amount;
                        else if (sale.type === 'hostel' || sale.type === 'hostel_renewal') yearData.hostel += sale.amount;
                        else if (sale.type === 'reading_room' || sale.type === 'reading_room_renewal') yearData.readingRoom += sale.amount;
                    }
                });
                data.push(yearData);
            }
        }
        return data;
    }, [orders, transactions, cutoff, timeRange]);

    // ── Revenue Breakdown (Pie) ──
    const revenueBreakdown = useMemo(() => [
        { name: 'Reading Room', value: stats.readingRoomSales },
        { name: 'Canteen', value: stats.canteenSales },
        { name: 'Hostel', value: stats.hostelRevenue }
    ].filter(d => d.value > 0), [stats]);

    // ── Member Types Breakdown (Pie) ──
    const memberTypesData = useMemo(() => {
        let rrCount = 0;
        let hostelCount = 0;
        let bothCount = 0;
        let otherCount = 0;

        const rrUsers = new Set(seatAssignments.map(a => a.userId));
        const hostelUsers = new Set(hostelAssignments.map(a => a.userId));

        users.forEach(u => {
            const hasRr = rrUsers.has(u.id);
            const hasHostel = hostelUsers.has(u.id);

            if (hasRr && hasHostel) bothCount++;
            else if (hasRr) rrCount++;
            else if (hasHostel) hostelCount++;
            else otherCount++;
        });

        return [
            { name: 'Reading Room Only', value: rrCount },
            { name: 'Hostel Only', value: hostelCount },
            { name: 'Both', value: bothCount },
            { name: 'Inactive/Other', value: otherCount }
        ].filter(d => d.value > 0);
    }, [users, seatAssignments, hostelAssignments]);

    // ── Members Trend (simulated from verified users) ──
    const membersTrend = useMemo(() => {
        const data = [];

        const countByDate = (d, filterFn) => {
            const activeRR = transactions.filter(t => filterFn(t) && (t.type === 'reading_room' || t.type === 'reading_room_renewal')).length;
            const activeHostel = transactions.filter(t => filterFn(t) && (t.type === 'hostel' || t.type === 'hostel_renewal')).length;
            const activeCanteen = orders.filter(o => filterFn(o)).length;
            return { 'Reading Room': activeRR, 'Canteen': activeCanteen, 'Hostel': activeHostel };
        };

        if (timeRange === '7d' || timeRange === '30d') {
            const days = timeRange === '7d' ? 7 : 30;
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const counts = countByDate(d, (item) => item.date.toDateString() === d.toDateString());
                data.push({ name: dayStr, ...counts });
            }
        } else {
            const months = timeRange === '6m' ? 6 : timeRange === '12m' ? 12 : 36;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            for (let i = months - 1; i >= 0; i--) {
                const d = new Date(); d.setMonth(d.getMonth() - i);
                const mi = d.getMonth(), yr = d.getFullYear();
                const counts = countByDate(d, (item) => item.date.getMonth() === mi && item.date.getFullYear() === yr);
                data.push({ name: monthNames[mi], ...counts });
            }
        }
        return data;
    }, [transactions, orders, timeRange]);



    return (
        <div className="dashboard-container">
            <div className="dashboard-content" style={{ padding: '24px' }}>

                {!dashboardReady && (
                    <div className="db-skeleton-wrapper">
                        <style>{`
                            .db-skeleton-wrapper { animation: dbSkeletonFadeIn 0.3s ease; }
                            @keyframes dbSkeletonFadeIn { from { opacity: 0; } to { opacity: 1; } }
                            .db-skeleton-shimmer {
                                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                                background-size: 200% 100%;
                                animation: dbShimmer 1.5s infinite;
                                border-radius: 12px;
                            }
                            @keyframes dbShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                        `}</style>
                        {/* Skeleton header */}
                        <div style={{ marginBottom: '24px' }}>
                            <div className="db-skeleton-shimmer" style={{ width: '240px', height: '28px', marginBottom: '8px' }} />
                            <div className="db-skeleton-shimmer" style={{ width: '320px', height: '16px' }} />
                        </div>
                        {/* Skeleton stat cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <div>
                                            <div className="db-skeleton-shimmer" style={{ width: '100px', height: '14px', marginBottom: '8px' }} />
                                            <div className="db-skeleton-shimmer" style={{ width: '80px', height: '26px' }} />
                                        </div>
                                        <div className="db-skeleton-shimmer" style={{ width: '40px', height: '40px', borderRadius: '12px' }} />
                                    </div>
                                    <div className="db-skeleton-shimmer" style={{ width: '140px', height: '12px' }} />
                                </div>
                            ))}
                        </div>
                        {/* Skeleton charts */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            <div className="db-skeleton-shimmer" style={{ height: '380px' }} />
                            <div className="db-skeleton-shimmer" style={{ height: '380px' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                            <div className="db-skeleton-shimmer" style={{ height: '350px' }} />
                            <div className="db-skeleton-shimmer" style={{ height: '350px' }} />
                        </div>
                    </div>
                )}

                {dashboardReady && (<div style={{ animation: 'dbContentFadeIn 0.5s ease' }}>
                    <style>{`@keyframes dbContentFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                    {/* Header with Global Time Filter */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>Dashboard Overview</h1>
                            <p style={{ color: '#6b7280', fontSize: '14px' }}>Welcome back, Admin. Overview for {timeRangeLabels[timeRange]}</p>
                        </div>

                        {/* Global Time Selector */}
                        <div className="db-select-wrapper" ref={selectRef}>
                            <div
                                className={`db-select-trigger ${isSelectOpen ? 'open' : ''}`}
                                onClick={() => setIsSelectOpen(!isSelectOpen)}
                                style={{ minWidth: '160px' }}
                            >
                                <Calendar size={16} style={{ marginRight: '8px', color: '#6b7280' }} />
                                <span>{timeRangeLabels[timeRange]}</span>
                                <ChevronDown size={16} style={{
                                    transform: isSelectOpen ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.2s', marginLeft: 'auto'
                                }} />
                            </div>
                            {isSelectOpen && (
                                <div className="db-select-options">
                                    {Object.entries(timeRangeLabels).map(([key, label]) => (
                                        <div key={key}
                                            className={`db-select-option ${timeRange === key ? 'active' : ''}`}
                                            onClick={() => { setTimeRange(key); setIsSelectOpen(false); }}
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stat Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '20px',
                        marginBottom: '28px'
                    }}>
                        <div onClick={() => navigate('/admin/user-management')} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <p style={{ color: '#6b7280', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>New Members</p>
                                    <h3 style={{ fontSize: '26px', fontWeight: 'bold', color: '#111827' }}>{stats.newMembers}</h3>
                                </div>
                                <div style={{ padding: '10px', backgroundColor: '#eff6ff', borderRadius: '12px', color: '#3b82f6' }}>
                                    <Users size={20} />
                                </div>
                            </div>
                            <p style={{ fontSize: '12px', color: '#6b7280' }}>Joined in selected period</p>
                        </div>

                        <div onClick={() => navigate('/admin/reading-rooms')} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <p style={{ color: '#6b7280', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Reading Room</p>
                                    <h3 style={{ fontSize: '26px', fontWeight: 'bold', color: '#111827' }}>रु {stats.readingRoomSales.toLocaleString()}</h3>
                                </div>
                                <div style={{ padding: '10px', backgroundColor: '#f0f5ff', borderRadius: '12px', color: '#6366f1' }}>
                                    <Armchair size={20} />
                                </div>
                            </div>
                            <p style={{ fontSize: '12px', color: '#10b981' }}>{stats.rrOccupied} current seats assigned</p>
                        </div>

                        <div onClick={() => navigate('/admin/hostel')} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <p style={{ color: '#6b7280', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Hostel</p>
                                    <h3 style={{ fontSize: '26px', fontWeight: 'bold', color: '#111827' }}>रु {stats.hostelRevenue.toLocaleString()}</h3>
                                </div>
                                <div style={{ padding: '10px', backgroundColor: '#fef3c7', borderRadius: '12px', color: '#d97706' }}>
                                    <Building size={20} />
                                </div>
                            </div>
                            <p style={{ fontSize: '12px', color: '#6b7280' }}>{stats.occupiedBeds}/{stats.totalBeds} beds occupied</p>
                        </div>

                        <div onClick={() => navigate('/admin/canteen')} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <p style={{ color: '#6b7280', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Canteen</p>
                                    <h3 style={{ fontSize: '26px', fontWeight: 'bold', color: '#111827' }}>रु {stats.canteenSales.toLocaleString()}</h3>
                                </div>
                                <div style={{ padding: '10px', backgroundColor: '#ecfdf5', borderRadius: '12px', color: '#059669' }}>
                                    <ShoppingCart size={20} />
                                </div>
                            </div>
                            <p style={{ fontSize: '12px', color: '#6b7280' }}>Revenue in period</p>
                        </div>

                        <div onClick={() => navigate('/admin/transaction-statement')} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <p style={{ color: '#6b7280', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Total Revenue</p>
                                    <h3 style={{ fontSize: '26px', fontWeight: 'bold', color: '#111827' }}>रु {stats.totalEarnings.toLocaleString()}</h3>
                                </div>
                                <div style={{ padding: '10px', backgroundColor: '#fdf2f8', borderRadius: '12px', color: '#ec4899' }}>
                                    <CreditCard size={20} />
                                </div>
                            </div>
                            <p style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                View Statement →
                            </p>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="db-charts-grid">

                        {/* Revenue Trends */}
                        <div style={{
                            backgroundColor: '#fff', padding: '24px', borderRadius: '16px',
                            border: '1px solid #e5e7eb', height: '400px', position: 'relative', minWidth: 0
                        }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>Revenue Trends</h3>
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
                                        <linearGradient id="colorHostel" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }}
                                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                    <CartesianGrid vertical={false} stroke="#f3f4f6" />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={(value) => [`रु ${value.toLocaleString()}`, '']}
                                    />
                                    <Legend verticalAlign="top" height={36} />
                                    <Area type="monotone" dataKey="readingRoom" name="Reading Room" stroke="#8884d8" fillOpacity={1} fill="url(#colorRr)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                                    <Area type="monotone" dataKey="canteen" name="Canteen" stroke="#82ca9d" fillOpacity={1} fill="url(#colorCanteen)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                                    <Area type="monotone" dataKey="hostel" name="Hostel" stroke="#F59E0B" fillOpacity={1} fill="url(#colorHostel)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Revenue Breakdown Pie */}
                        <div style={{
                            backgroundColor: '#fff', padding: '24px', borderRadius: '16px',
                            border: '1px solid #e5e7eb', height: '400px', position: 'relative', minWidth: 0
                        }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>Revenue Sources</h3>
                            <ResponsiveContainer width="100%" height="85%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={revenueBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={85}
                                        dataKey="value"
                                        paddingAngle={2}
                                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                        labelLine={true}
                                    >
                                        {revenueBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={v => [`रु ${v.toLocaleString()}`, '']} />
                                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bottom Row: Member Types & Activity */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginTop: '24px' }}>

                        {/* Member Types Pie */}
                        <div style={{
                            backgroundColor: '#fff', padding: '24px', borderRadius: '16px',
                            border: '1px solid #e5e7eb', height: '400px', position: 'relative', minWidth: 0
                        }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>Member Distribution</h3>
                            <ResponsiveContainer width="100%" height="85%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={memberTypesData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={85}
                                        dataKey="value"
                                        paddingAngle={2}
                                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                        labelLine={true}
                                    >
                                        {memberTypesData.map((_, i) => <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Activity Trend */}
                        <div style={{
                            backgroundColor: '#fff', padding: '24px', borderRadius: '16px',
                            border: '1px solid #e5e7eb', height: '350px', minWidth: 0
                        }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '20px' }}>Activity Trend — {timeRangeLabels[timeRange]}</h3>
                            <div style={{ width: '100%', height: '85%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={membersTrend} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 11 }} />
                                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend verticalAlign="top" height={28} iconSize={10} />
                                        <Bar dataKey="Reading Room" fill="#8884d8" radius={[3, 3, 0, 0]} barSize={16} />
                                        <Bar dataKey="Canteen" fill="#82ca9d" radius={[3, 3, 0, 0]} barSize={16} />
                                        <Bar dataKey="Hostel" fill="#F59E0B" radius={[3, 3, 0, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                </div>)}

            </div>
        </div>
    );
}

export default Dashboard;

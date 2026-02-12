import React, { useState, useEffect, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { IndianRupee, ShoppingCart, TrendingUp, Clock, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useLoading } from '../../context/GlobalLoadingContext';
import {
    StatCard, ChartCard, EmptyState,
    TimeRangeBar, DashboardTooltip, getCutoffDate, buildTimeBuckets, getRangeLabel
} from '../../components/DashboardWidgets';
import '../../styles/ModuleDashboard.css';

const COLORS = ['#007AFF', '#34C759', '#FF9F0A', '#FF3B30', '#AF52DE', '#5AC8FA', '#FFCC00', '#8E8E93'];
const STATUS_COLORS_MAP = {
    completed: '#34C759', preparing: '#FF9F0A', pending: '#007AFF',
    cancelled: '#FF3B30', delivered: '#5AC8FA', ready: '#AF52DE'
};

function CanteenDashboard({ onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const navigate = useNavigate();
    const [range, setRange] = useState('1w');

    const [orders, setOrders] = useState([]);
    const [pendingLive, setPendingLive] = useState(0);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => { setIsLoading(true); }, []);

    const getOrderDate = (o) => {
        if (!o.createdAt) return null;
        if (typeof o.createdAt === 'string') return new Date(o.createdAt);
        if (o.createdAt?.toDate) return o.createdAt.toDate();
        return null;
    };

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
                setOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoaded(true);
            } catch (error) {
                console.error('CanteenDashboard:', error);
            } finally {
                onDataLoaded?.();
            }
        };
        fetchAll();

        const unsubscribe = onSnapshot(
            query(collection(db, 'orders'), where('status', 'in', ['pending', 'preparing'])),
            (snap) => setPendingLive(snap.size)
        );
        return () => unsubscribe();
    }, []);

    const handleManage = () => {
        navigate('/admin/canteen/manage');
    };

    const rangeLabel = getRangeLabel(range);

    // ── Stat Cards — all respond to range ──
    const stats = useMemo(() => {
        const cutoff = getCutoffDate(range);
        const filtered = orders.filter(o => { const d = getOrderDate(o); return d && d >= cutoff; });
        const completed = filtered.filter(o => o.status !== 'cancelled');
        const revenue = completed.reduce((s, o) => s + (o.totalAmount || o.total || 0), 0);
        const avg = completed.length > 0 ? Math.round(revenue / completed.length) : 0;
        return { revenue, totalOrders: filtered.length, avgOrderValue: avg };
    }, [orders, range]);

    // ── Revenue Trend ──
    const revenueData = useMemo(() => {
        const cutoff = getCutoffDate(range);
        const filtered = orders.filter(o => {
            const d = getOrderDate(o);
            return d && d >= cutoff && o.status !== 'cancelled';
        });
        const buckets = buildTimeBuckets(range);
        return buckets.map(b => {
            let revenue = 0;
            filtered.forEach(o => {
                const d = getOrderDate(o);
                if (d && b.match(d)) revenue += (o.totalAmount || o.total || 0);
            });
            return { name: b.label, revenue };
        });
    }, [orders, range]);

    // ── Orders by Status (in range) ──
    const ordersByStatus = useMemo(() => {
        const cutoff = getCutoffDate(range);
        const filtered = orders.filter(o => { const d = getOrderDate(o); return d && d >= cutoff; });
        const counts = {};
        filtered.forEach(o => {
            const s = o.status || 'unknown';
            counts[s] = (counts[s] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            fill: STATUS_COLORS_MAP[name] || '#8E8E93'
        }));
    }, [orders, range]);

    // ── Top Selling Items (in range) ──
    const topItems = useMemo(() => {
        const cutoff = getCutoffDate(range);
        const filtered = orders.filter(o => { const d = getOrderDate(o); return d && d >= cutoff; });
        const sales = {};
        filtered.forEach(o => {
            (o.items || []).forEach(item => {
                const name = item.name || item.itemName || 'Unknown';
                sales[name] = (sales[name] || 0) + (item.quantity || 1);
            });
        });
        return Object.entries(sales).sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([name, qty]) => ({ name, quantity: qty }));
    }, [orders, range]);

    // ── Category Sales (in range) ──
    const categorySales = useMemo(() => {
        const cutoff = getCutoffDate(range);
        const filtered = orders.filter(o => { const d = getOrderDate(o); return d && d >= cutoff; });
        const cats = {};
        filtered.forEach(o => {
            (o.items || []).forEach(item => {
                const cat = item.category || 'Other';
                cats[cat] = (cats[cat] || 0) + (item.price || 0) * (item.quantity || 1);
            });
        });
        return Object.entries(cats).map(([name, value]) => ({ name, value: Math.round(value) }));
    }, [orders, range]);

    const renderPieLabel = ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`;

    if (!loaded) return null;

    return (
        <div className="mod-db-container">
            <div className="mod-db-top-bar">
                <p className="mod-db-subtitle">Performance, orders, and menu analytics — {rangeLabel}</p>
                <button className="mod-db-manage-btn" onClick={handleManage}>
                    <Settings size={16} /> Manage Canteen
                </button>
            </div>

            <div className="mod-db-stats-grid">
                <StatCard label="Revenue" value={`रु ${stats.revenue.toLocaleString()}`} icon={<IndianRupee size={18} />} accent="green" subtitle={rangeLabel} onClick={() => navigate('/admin/transaction-statement?type=canteen')} />
                <StatCard label="Orders" value={stats.totalOrders} icon={<ShoppingCart size={18} />} accent="blue" subtitle={rangeLabel} onClick={() => navigate('/admin/canteen/manage')} />
                <StatCard label="Avg Order" value={`रु ${stats.avgOrderValue}`} icon={<TrendingUp size={18} />} accent="purple" subtitle="Per order" onClick={() => navigate('/admin/canteen/manage')} />
                <StatCard label="Pending" value={pendingLive} icon={<Clock size={18} />} accent={pendingLive > 5 ? 'red' : 'orange'} subtitle="Live" onClick={() => navigate('/admin/canteen/manage')} />
            </div>

            <TimeRangeBar selected={range} onChange={setRange} />

            <div className="mod-db-charts-grid">
                <ChartCard title={`Revenue Trend — ${rangeLabel}`} height={280}>
                    {revenueData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="canteenRevGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34C759" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#34C759" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#34C759" fillOpacity={1} fill="url(#canteenRevGrad)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No order data." />}
                </ChartCard>

                <ChartCard title={`Orders by Status — ${rangeLabel}`} height={280}>
                    {ordersByStatus.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, bottom: 10, left: 10, right: 10 }}>
                                <Pie data={ordersByStatus} cx="50%" cy="45%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3} label={renderPieLabel} labelLine={true}>
                                    {ordersByStatus.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Pie>
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="bottom" height={28} iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No orders in range." />}
                </ChartCard>
            </div>

            <div className="mod-db-charts-grid">
                <ChartCard title={`Top Items — ${rangeLabel}`} height={280}>
                    {topItems.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topItems} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 11 }} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Bar dataKey="quantity" name="Sold" fill="#AF52DE" radius={[0, 3, 3, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No sales data." />}
                </ChartCard>
            </div>

            {categorySales.length > 0 && (
                <div className="mod-db-charts-grid">
                    <ChartCard title={`Category Sales — ${rangeLabel}`} height={280}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, bottom: 10, left: 10, right: 10 }}>
                                <Pie data={categorySales} cx="50%" cy="45%" outerRadius={70} dataKey="value" label={renderPieLabel} labelLine={true}>
                                    {categorySales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="bottom" height={28} iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartCard>
                    <div />
                </div>
            )}
        </div>
    );
}

export default CanteenDashboard;

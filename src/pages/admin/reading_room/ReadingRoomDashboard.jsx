import React, { useState, useEffect, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Armchair, Users, CheckCircle, Percent, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useLoading } from '../../../context/GlobalLoadingContext';
import {
    StatCard, ChartCard, EmptyState,
    TimeRangeBar, DashboardTooltip, getCutoffDate, buildTimeBuckets, getRangeLabel
} from '../../../components/DashboardWidgets';
import '../../../styles/ModuleDashboard.css';

const COLORS = ['#007AFF', '#34C759', '#FF9F0A', '#FF3B30', '#AF52DE', '#5AC8FA'];
const STATUS_COLORS = { active: '#34C759', dueIncoming: '#FF9F0A', gracePeriod: '#FF3B30', overdue: '#636366' };

function ReadingRoomDashboard({ onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const navigate = useNavigate();
    const [range, setRange] = useState('6m');

    const [rooms, setRooms] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [users, setUsers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => { setIsLoading(true); }, []);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [roomsSnap, assignmentsSnap, usersSnap, txnSnap] = await Promise.all([
                    getDocs(collection(db, 'readingRooms')),
                    getDocs(collection(db, 'seatAssignments')),
                    getDocs(query(collection(db, 'users'), where('verified', '==', true))),
                    getDocs(query(collection(db, 'transactions'), orderBy('date', 'desc')))
                ]);
                setRooms(roomsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setAssignments(assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setTransactions(txnSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoaded(true);
            } catch (error) {
                console.error('ReadingRoomDashboard:', error);
            } finally {
                onDataLoaded?.();
            }
        };
        fetchAll();
    }, []);

    const parseDate = (d) => {
        if (!d) return null;
        if (typeof d === 'string') return new Date(d);
        if (d.toDate) return d.toDate();
        return null;
    };

    const handleManage = () => {
        navigate('/admin/reading-rooms/manage');
    };

    const rangeLabel = getRangeLabel(range);

    // ── Stat Cards (revenue responds to range) ──
    const stats = useMemo(() => {
        let totalSeats = 0;
        rooms.forEach(r => {
            const elements = r.elements || r.seats || [];
            totalSeats += elements.filter(e => !e.type || e.type === 'seat').length;
        });
        const occupied = assignments.length;
        const vacant = Math.max(0, totalSeats - occupied);
        const rate = totalSeats > 0 ? Math.round((occupied / totalSeats) * 100) : 0;

        const cutoff = getCutoffDate(range);
        const revenue = transactions
            .filter(t => { const d = parseDate(t.date); return d && d >= cutoff; })
            .reduce((s, t) => s + (t.amount || 0), 0);

        return { totalSeats, occupied, vacant, occupancyRate: rate, revenue };
    }, [rooms, assignments, transactions, range]);

    // ── AC vs Non-AC ──
    const roomBreakdown = useMemo(() => {
        const ac = rooms.filter(r => r.type === 'ac').length;
        const nonAc = rooms.filter(r => r.type !== 'ac').length;
        return [
            { name: 'AC', value: ac },
            { name: 'Non-AC', value: nonAc }
        ].filter(d => d.value > 0);
    }, [rooms]);

    // ── Seat Fill Rate ──
    const seatFillByRoom = useMemo(() =>
        rooms.map(r => {
            const elements = r.elements || r.seats || [];
            const seats = elements.filter(e => !e.type || e.type === 'seat');
            const occ = assignments.filter(a => a.roomId === r.id).length;
            return { name: r.name, Occupied: occ, Available: Math.max(0, seats.length - occ) };
        }), [rooms, assignments]);

    // ── Subscription Status ──
    const statusDistribution = useMemo(() => {
        const now = new Date();
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        const assignedIds = new Set(assignments.map(a => a.userId));
        let active = 0, due = 0, grace = 0, overdue = 0;
        users.forEach(u => {
            if (!assignedIds.has(u.id)) return;
            if (!u.nextPaymentDue) { active++; return; }
            const diff = new Date(u.nextPaymentDue) - now;
            if (diff > threeDays) active++;
            else if (diff >= 0) due++;
            else if (Math.abs(diff) <= threeDays) grace++;
            else overdue++;
        });
        return [
            { name: 'Active', value: active, fill: STATUS_COLORS.active },
            { name: 'Due Soon', value: due, fill: STATUS_COLORS.dueIncoming },
            { name: 'Grace', value: grace, fill: STATUS_COLORS.gracePeriod },
            { name: 'Overdue', value: overdue, fill: STATUS_COLORS.overdue }
        ].filter(d => d.value > 0);
    }, [users, assignments]);

    // ── Revenue Trend ──
    const revenueData = useMemo(() => {
        const cutoff = getCutoffDate(range);
        const filtered = transactions.filter(t => {
            const d = parseDate(t.date);
            return d && d >= cutoff;
        });
        const buckets = buildTimeBuckets(range);
        return buckets.map(b => {
            let revenue = 0;
            filtered.forEach(t => {
                const d = parseDate(t.date);
                if (d && b.match(d)) revenue += (t.amount || 0);
            });
            return { name: b.label, revenue };
        });
    }, [transactions, range]);

    const renderPieLabel = ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`;

    if (!loaded) return null;

    return (
        <div className="mod-db-container">
            <div className="mod-db-top-bar">
                <p className="mod-db-subtitle">Occupancy and revenue — {rangeLabel}</p>
                <button className="mod-db-manage-btn" onClick={handleManage}>
                    <Settings size={16} /> Manage Rooms
                </button>
            </div>

            <div className="mod-db-stats-grid">
                <StatCard label="Total Seats" value={stats.totalSeats} icon={<Armchair size={18} />} accent="blue" subtitle="Across all rooms" onClick={() => navigate('/admin/reading-rooms/manage')} />
                <StatCard label="Occupied" value={stats.occupied} icon={<Users size={18} />} accent="green" subtitle="Currently assigned" onClick={() => navigate('/admin/user-management/manage/all-members?rr=active')} />
                <StatCard label="Vacant" value={stats.vacant} icon={<CheckCircle size={18} />} accent="orange" subtitle="Available" onClick={() => navigate('/admin/reading-rooms/manage')} />
                <StatCard label="Revenue" value={`रु ${stats.revenue.toLocaleString()}`} icon={<Percent size={18} />} accent="purple" subtitle={rangeLabel} onClick={() => navigate('/admin/transaction-statement?type=reading_room')} />
            </div>

            <TimeRangeBar selected={range} onChange={setRange} />

            <div className="mod-db-charts-grid">
                <ChartCard title="AC vs Non-AC Rooms" height={280}>
                    {roomBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, bottom: 10, left: 10, right: 10 }}>
                                <Pie data={roomBreakdown} cx="50%" cy="45%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={4} label={renderPieLabel} labelLine={true}>
                                    {roomBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="bottom" height={28} iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No rooms configured." />}
                </ChartCard>

                <ChartCard title="Seat Fill Rate by Room" height={280}>
                    {seatFillByRoom.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={seatFillByRoom} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" width={70} axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 11 }} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Bar dataKey="Occupied" stackId="a" fill="#FF3B30" barSize={16} />
                                <Bar dataKey="Available" stackId="a" fill="#34C759" radius={[0, 3, 3, 0]} barSize={16} />
                                <Legend verticalAlign="top" height={28} iconSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No rooms configured." />}
                </ChartCard>
            </div>

            <div className="mod-db-charts-grid">
                <ChartCard title="Subscription Status" height={280}>
                    {statusDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, bottom: 10, left: 10, right: 10 }}>
                                <Pie data={statusDistribution} cx="50%" cy="45%" outerRadius={75} dataKey="value" label={renderPieLabel} labelLine={true}>
                                    {statusDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Pie>
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="bottom" height={28} iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No subscriptions found." />}
                </ChartCard>

                <ChartCard title={`Revenue Trend — ${rangeLabel}`} height={280}>
                    {revenueData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="rrRevGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#007AFF" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#007AFF" fillOpacity={1} fill="url(#rrRevGrad)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No transaction data." />}
                </ChartCard>
            </div>
        </div>
    );
}

export default ReadingRoomDashboard;

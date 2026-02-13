import React, { useState, useEffect, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Building, BedDouble, Users, TrendingDown, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useLoading } from '../../../context/GlobalLoadingContext';
import {
    StatCard, ChartCard, EmptyState,
    TimeRangeBar, DashboardTooltip, getRangeLabel
} from '../../../components/DashboardWidgets';
import '../../../styles/ModuleDashboard.css';

const COLORS = ['#007AFF', '#34C759', '#FF9F0A', '#FF3B30', '#AF52DE', '#5AC8FA'];
const STATUS_COLORS = { active: '#34C759', dueIncoming: '#FF9F0A', gracePeriod: '#FF3B30', overdue: '#636366' };

const ROOM_TYPE_LABELS = {
    single: 'Single', single_attached: 'Single Att.',
    double: 'Twin', twin: 'Twin', twin_attached: 'Twin Att.', triple: 'Triple'
};

const BUILDING_NAMES = {
    building_a: 'Building A', building_b: 'Building B', building_c: 'Building C'
};

function HostelDashboard({ onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const navigate = useNavigate();
    const [range, setRange] = useState('6m');

    const [rooms, setRooms] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => { setIsLoading(true); }, []);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [roomsSnap, assignmentsSnap] = await Promise.all([
                    getDocs(collection(db, 'hostelRooms')),
                    getDocs(collection(db, 'hostelAssignments'))
                ]);
                setRooms(roomsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setAssignments(assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status === 'active'));
                setLoaded(true);
            } catch (error) {
                console.error('HostelDashboard:', error);
            } finally {
                onDataLoaded?.();
            }
        };
        fetchAll();
    }, []);

    const handleManage = () => {
        navigate('/admin/hostel/manage');
    };

    const rangeLabel = getRangeLabel(range);

    // ── Stat Cards ──
    const stats = useMemo(() => {
        const totalRooms = rooms.length;
        const totalBeds = rooms.reduce((s, r) => s + (r.capacity || 1), 0);
        const occupiedBeds = assignments.length;
        const vacancyRate = totalBeds > 0 ? Math.round(((totalBeds - occupiedBeds) / totalBeds) * 100) : 0;
        const monthlyRevenue = rooms.reduce((sum, r) => {
            const occ = assignments.filter(a => a.roomId === r.id).length;
            return sum + (occ > 0 ? (r.price || 0) : 0);
        }, 0);
        return { totalRooms, totalBeds, occupiedBeds, vacancyRate, monthlyRevenue };
    }, [rooms, assignments]);

    // ── Occupancy by Building ──
    const occupancyByBuilding = useMemo(() => {
        const map = {};
        rooms.forEach(r => {
            const bId = r.buildingId || 'unknown';
            if (!map[bId]) map[bId] = { capacity: 0, occupied: 0, rooms: 0, revenue: 0 };
            map[bId].capacity += (r.capacity || 1);
            map[bId].rooms += 1;
        });
        assignments.forEach(a => {
            const room = rooms.find(r => r.id === a.roomId);
            if (room) {
                const bId = room.buildingId || 'unknown';
                if (map[bId]) map[bId].occupied += 1;
            }
        });
        rooms.forEach(r => {
            const bId = r.buildingId || 'unknown';
            const occ = assignments.filter(a => a.roomId === r.id).length;
            if (map[bId] && occ > 0) map[bId].revenue += (r.price || 0);
        });
        return map;
    }, [rooms, assignments]);

    const buildingChartData = useMemo(() =>
        Object.entries(occupancyByBuilding).map(([bId, d]) => ({
            name: BUILDING_NAMES[bId] || bId,
            Occupied: d.occupied,
            Capacity: d.capacity
        })), [occupancyByBuilding]);

    const buildingCards = useMemo(() =>
        Object.entries(occupancyByBuilding).map(([bId, d]) => ({
            name: BUILDING_NAMES[bId] || bId,
            rooms: d.rooms,
            fillPercent: d.capacity > 0 ? Math.round((d.occupied / d.capacity) * 100) : 0,
            revenue: d.revenue
        })), [occupancyByBuilding]);

    // ── Room Type Distribution ──
    const roomTypeDistribution = useMemo(() => {
        const count = {};
        rooms.forEach(r => { const t = r.type || 'other'; count[t] = (count[t] || 0) + 1; });
        return Object.entries(count).map(([t, v]) => ({
            name: ROOM_TYPE_LABELS[t] || t, value: v
        }));
    }, [rooms]);

    // ── Room Type Fill Rate ──
    const roomTypeFillRate = useMemo(() => {
        const fill = {};
        rooms.forEach(r => {
            const t = r.type || 'other';
            if (!fill[t]) fill[t] = { filled: 0, empty: 0 };
            const occ = assignments.filter(a => a.roomId === r.id).length;
            fill[t].filled += occ;
            fill[t].empty += Math.max(0, (r.capacity || 1) - occ);
        });
        return Object.entries(fill).map(([t, d]) => ({
            name: ROOM_TYPE_LABELS[t] || t, Filled: d.filled, Empty: d.empty
        }));
    }, [rooms, assignments]);

    // ── Payment Status ──
    const paymentStatus = useMemo(() => {
        const now = new Date();
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        let active = 0, due = 0, grace = 0, overdue = 0;
        assignments.forEach(a => {
            if (!a.nextPaymentDue) { active++; return; }
            const diff = new Date(a.nextPaymentDue) - now;
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
    }, [assignments]);

    const renderPieLabel = ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`;

    if (!loaded) return null;

    return (
        <div className="mod-db-container">
            <div className="mod-db-top-bar">
                <p className="mod-db-subtitle">Building occupancy and room status — {rangeLabel}</p>
                <button className="mod-db-manage-btn" onClick={handleManage}>
                    <Settings size={16} /> Manage Hostel
                </button>
            </div>

            <div className="mod-db-stats-grid">
                <StatCard label="Total Rooms" value={stats.totalRooms} icon={<Building size={18} />} accent="blue" subtitle="All buildings" onClick={() => navigate('/admin/hostel/manage')} />
                <StatCard label="Total Beds" value={stats.totalBeds} icon={<BedDouble size={18} />} accent="purple" subtitle="Combined capacity" onClick={() => navigate('/admin/hostel/manage')} />
                <StatCard label="Occupied" value={stats.occupiedBeds} icon={<Users size={18} />} accent="green" subtitle="Active residents" onClick={() => navigate('/admin/user-management/manage/all-members?hostel=active')} />
                <StatCard label="Revenue" value={`रु ${stats.monthlyRevenue.toLocaleString()}`} icon={<TrendingDown size={18} />} accent="teal" subtitle="Monthly potential" onClick={() => navigate('/admin/transaction-statement?type=hostel')} />
            </div>

            <TimeRangeBar selected={range} onChange={setRange} />

            {/* Building Cards */}
            {buildingCards.length > 0 && (
                <>
                    <h3 className="mod-db-section-title">Buildings</h3>
                    <div className="mod-db-buildings-grid">
                        {buildingCards.map(b => (
                            <div key={b.name} className="mod-db-building-card">
                                <h4 className="mod-db-building-name">{b.name}</h4>
                                <div className="mod-db-building-stats">
                                    <div className="mod-db-building-stat">
                                        <span className="mod-db-building-stat-label">Rooms</span>
                                        <span className="mod-db-building-stat-value">{b.rooms}</span>
                                    </div>
                                    <div className="mod-db-building-stat">
                                        <span className="mod-db-building-stat-label">Fill Rate</span>
                                        <span className="mod-db-building-stat-value">{b.fillPercent}%</span>
                                    </div>
                                    <div className="mod-db-building-stat">
                                        <span className="mod-db-building-stat-label">Revenue</span>
                                        <span className="mod-db-building-stat-value">रु {b.revenue.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="mod-db-fill-bar">
                                    <div className="mod-db-fill-bar-inner" style={{ width: `${b.fillPercent}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Charts */}
            <div className="mod-db-charts-grid">
                <ChartCard title="Occupancy by Building" height={280}>
                    {buildingChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={buildingChartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="top" height={28} iconSize={10} />
                                <Bar dataKey="Occupied" fill="#007AFF" radius={[3, 3, 0, 0]} barSize={24} />
                                <Bar dataKey="Capacity" fill="#E5E5EA" radius={[3, 3, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No rooms configured." />}
                </ChartCard>

                <ChartCard title="Room Type Distribution" height={280}>
                    {roomTypeDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, bottom: 10, left: 10, right: 10 }}>
                                <Pie data={roomTypeDistribution} cx="50%" cy="45%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3} label={renderPieLabel} labelLine={true}>
                                    {roomTypeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="bottom" height={28} iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No rooms configured." />}
                </ChartCard>
            </div>

            <div className="mod-db-charts-grid">
                <ChartCard title="Room Type Fill Rate" height={280}>
                    {roomTypeFillRate.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={roomTypeFillRate} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="top" height={28} iconSize={10} />
                                <Bar dataKey="Filled" stackId="a" fill="#007AFF" barSize={20} />
                                <Bar dataKey="Empty" stackId="a" fill="#E5E5EA" radius={[3, 3, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No room data." />}
                </ChartCard>

                <ChartCard title="Payment Status" height={280}>
                    {paymentStatus.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, bottom: 10, left: 10, right: 10 }}>
                                <Pie data={paymentStatus} cx="50%" cy="45%" outerRadius={70} dataKey="value" label={renderPieLabel} labelLine={true}>
                                    {paymentStatus.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Pie>
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="bottom" height={28} iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No payment data." />}
                </ChartCard>
            </div>
        </div>
    );
}

export default HostelDashboard;

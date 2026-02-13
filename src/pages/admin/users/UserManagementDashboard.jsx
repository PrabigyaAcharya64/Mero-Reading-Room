import React, { useState, useEffect, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Users, UserPlus, UserCheck, AlertTriangle, Wallet, Settings, Clock, BadgeAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useLoading } from '../../../context/GlobalLoadingContext';
import {
    StatCard, ChartCard, EmptyState,
    TimeRangeBar, DashboardTooltip, getCutoffDate, buildTimeBuckets, getRangeLabel
} from '../../../components/DashboardWidgets';
import '../../../styles/ModuleDashboard.css';

const COLORS = ['#007AFF', '#34C759', '#FF9F0A', '#FF3B30', '#AF52DE', '#5AC8FA', '#FFCC00', '#8E8E93'];
const STATUS_COLORS = {
    Active: '#34C759',
    'Due Incoming': '#FF9F0A',
    Overdue: '#FF3B30',
    Old: '#8E8E93',
    'Never Joined': '#d1d5db'
};

function UserManagementDashboard({ onDataLoaded }) {
    const { setIsLoading } = useLoading();
    const navigate = useNavigate();
    const [range, setRange] = useState('1m');

    const [users, setUsers] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [seatAssignments, setSeatAssignments] = useState({});
    const [hostelAssignments, setHostelAssignments] = useState({});
    const [loaded, setLoaded] = useState(false);

    useEffect(() => { setIsLoading(true); }, []);

    // ── Helper: parse Firestore dates ──
    const parseDate = (val) => {
        if (!val) return null;
        if (typeof val?.toDate === 'function') return val.toDate();
        if (val instanceof Date) return val;
        if (typeof val === 'string') return new Date(val);
        if (typeof val === 'number') {
            if (val < 10000000000) return new Date(val * 1000);
            return new Date(val);
        }
        return null;
    };

    // ── Helper: get service status (same logic as AllMembersView) ──
    const getServiceStatus = (assignment, isReadingRoom, user) => {
        if (!assignment) {
            const hasHistory = isReadingRoom
                ? (user.registrationCompleted === true)
                : (user.hostelRegistrationPaid === true);
            return hasHistory ? 'Old' : 'Never Joined';
        }

        let dueDateVal = assignment.nextPaymentDue;
        if (isReadingRoom && !dueDateVal) dueDateVal = user.nextPaymentDue;
        const dueDate = parseDate(dueDateVal);

        if (!dueDate || isNaN(dueDate.getTime())) return 'Active';

        const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diffDays > 3) return 'Active';
        if (diffDays >= 0) return 'Due Incoming';
        return 'Overdue';
    };

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [usersSnap, pendingSnap, seatsSnap, hostelSnap] = await Promise.all([
                    getDocs(query(collection(db, 'users'), where('verified', '==', true))),
                    getDocs(query(collection(db, 'users'), orderBy('submittedAt', 'desc'))),
                    getDocs(collection(db, 'seatAssignments')),
                    getDocs(collection(db, 'hostelAssignments'))
                ]);

                setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                const pending = pendingSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(u => u.mrrNumber && u.submittedAt && u.verified !== true);
                setPendingUsers(pending);

                const seatMap = {};
                seatsSnap.docs.forEach(d => { const data = d.data(); if (data.userId) seatMap[data.userId] = data; });
                setSeatAssignments(seatMap);

                const hostelMap = {};
                hostelSnap.docs.forEach(d => { const data = d.data(); if (data.userId) hostelMap[data.userId] = data; });
                setHostelAssignments(hostelMap);

                setLoaded(true);
            } catch (error) {
                console.error('UserManagementDashboard:', error);
            } finally {
                onDataLoaded?.();
            }
        };
        fetchAll();
    }, []);

    const handleManage = () => {
        navigate('/admin/user-management/manage');
    };

    const rangeLabel = getRangeLabel(range);

    // ── Stat Cards ──
    const stats = useMemo(() => {
        const withLoans = users.filter(u => u.loan?.has_active_loan);
        const totalLoanAmt = withLoans.reduce((s, u) => s + (u.loan?.current_balance || 0), 0);
        const withDue = users.filter(u => (u.balance || 0) < 0);
        const totalDue = withDue.reduce((s, u) => s + Math.abs(u.balance || 0), 0);

        return {
            totalMembers: users.length,
            pendingVerification: pendingUsers.length,
            activeLoans: withLoans.length,
            totalLoanAmt,
            dueCount: withDue.length,
            totalDue
        };
    }, [users, pendingUsers]);

    // ── Registration Trend (members verified in range) ──
    const regTrend = useMemo(() => {
        const cutoff = getCutoffDate(range);
        const buckets = buildTimeBuckets(range);
        return buckets.map(b => {
            let count = 0;
            users.forEach(u => {
                const d = parseDate(u.verifiedAt || u.submittedAt);
                if (d && d >= cutoff && b.match(d)) count++;
            });
            return { name: b.label, members: count };
        });
    }, [users, range]);

    // ── Reading Room Status Distribution ──
    const rrDistribution = useMemo(() => {
        const counts = {};
        users.forEach(u => {
            const status = getServiceStatus(seatAssignments[u.id], true, u);
            counts[status] = (counts[status] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({
            name, value, fill: STATUS_COLORS[name] || '#8E8E93'
        }));
    }, [users, seatAssignments]);

    // ── Hostel Status Distribution ──
    const hostelDistribution = useMemo(() => {
        const counts = {};
        users.forEach(u => {
            const status = getServiceStatus(hostelAssignments[u.id], false, u);
            counts[status] = (counts[status] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({
            name, value, fill: STATUS_COLORS[name] || '#8E8E93'
        }));
    }, [users, hostelAssignments]);

    // ── Balance Distribution ──
    const balanceDistribution = useMemo(() => {
        let positive = 0, zero = 0, due = 0;
        users.forEach(u => {
            const b = u.balance || 0;
            if (b > 0) positive++;
            else if (b < 0) due++;
            else zero++;
        });
        return [
            { name: 'Positive', value: positive, fill: '#34C759' },
            { name: 'Zero', value: zero, fill: '#8E8E93' },
            { name: 'Due', value: due, fill: '#FF3B30' }
        ].filter(d => d.value > 0);
    }, [users]);

    // ── Interest Distribution ──
    const interestDistribution = useMemo(() => {
        const counts = {};
        users.forEach(u => {
            const interests = Array.isArray(u.interestedIn) ? u.interestedIn : (u.interestedIn ? [u.interestedIn] : []);
            interests.forEach(i => { counts[i] = (counts[i] || 0) + 1; });
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, value]) => ({ name, value }));
    }, [users]);

    const renderPieLabel = ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`;

    if (!loaded) return null;

    return (
        <div className="mod-db-container">
            <div className="mod-db-top-bar">
                <p className="mod-db-subtitle">Member overview, verifications, and service enrollment — {rangeLabel}</p>
                <button className="mod-db-manage-btn" onClick={handleManage}>
                    <Settings size={16} /> Manage Users
                </button>
            </div>

            <div className="mod-db-stats-grid">
                <StatCard label="Total Members" value={stats.totalMembers} icon={<Users size={18} />} accent="blue" subtitle="Verified" onClick={() => navigate('/admin/user-management/manage/all-members')} />
                <StatCard label="Pending" value={stats.pendingVerification} icon={<UserPlus size={18} />} accent={stats.pendingVerification > 0 ? 'orange' : 'green'} subtitle="Awaiting verification" onClick={() => navigate('/admin/user-management/manage/new-users')} />
                <StatCard label="Active Loans" value={stats.activeLoans} icon={<Wallet size={18} />} accent={stats.activeLoans > 0 ? 'red' : 'green'} subtitle={`रु ${stats.totalLoanAmt.toLocaleString()} outstanding`} onClick={() => navigate('/admin/user-management/manage/all-members?filter=loan')} />
                <StatCard label="Due Balances" value={stats.dueCount} icon={<AlertTriangle size={18} />} accent={stats.dueCount > 0 ? 'red' : 'green'} subtitle={`रु ${stats.totalDue.toLocaleString()} total due`} onClick={() => navigate('/admin/user-management/manage/all-members?filter=due')} />
            </div>

            <TimeRangeBar selected={range} onChange={setRange} />

            <div className="mod-db-charts-grid">
                <ChartCard title={`Registration Trend — ${rangeLabel}`} height={280}>
                    {regTrend.some(d => d.members > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={regTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="umRegGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#007AFF" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Area type="monotone" dataKey="members" name="New Members" stroke="#007AFF" fillOpacity={1} fill="url(#umRegGrad)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No registrations in this range." />}
                </ChartCard>

                <ChartCard title="Balance Distribution" height={280}>
                    {balanceDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, bottom: 10, left: 10, right: 10 }}>
                                <Pie data={balanceDistribution} cx="50%" cy="45%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3} label={renderPieLabel} labelLine={true}>
                                    {balanceDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Pie>
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="bottom" height={28} iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No balance data." />}
                </ChartCard>
            </div>

            <div className="mod-db-charts-grid">
                <ChartCard title="Reading Room Enrollment" height={280}>
                    {rrDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, bottom: 10, left: 10, right: 10 }}>
                                <Pie data={rrDistribution} cx="50%" cy="45%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3} label={renderPieLabel} labelLine={true}>
                                    {rrDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Pie>
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="bottom" height={28} iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No enrollment data." />}
                </ChartCard>

                <ChartCard title="Hostel Enrollment" height={280}>
                    {hostelDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, bottom: 10, left: 10, right: 10 }}>
                                <Pie data={hostelDistribution} cx="50%" cy="45%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3} label={renderPieLabel} labelLine={true}>
                                    {hostelDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                </Pie>
                                <Tooltip content={<DashboardTooltip />} />
                                <Legend verticalAlign="bottom" height={28} iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyState message="No hostel enrollment data." />}
                </ChartCard>
            </div>

            {interestDistribution.length > 0 && (
                <div className="mod-db-charts-grid">
                    <ChartCard title="Member Interests" height={280}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={interestDistribution} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 11 }} />
                                <Tooltip content={<DashboardTooltip />} />
                                <Bar dataKey="value" name="Members" fill="#AF52DE" radius={[0, 3, 3, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                    <div />
                </div>
            )}
        </div>
    );
}

export default UserManagementDashboard;

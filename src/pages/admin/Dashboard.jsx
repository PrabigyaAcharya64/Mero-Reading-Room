import React, { useState, useEffect } from 'react';
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
    ArrowRight
} from 'lucide-react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';

const userManagementIcon = new URL('../../assets/usermanagement.svg', import.meta.url).href;
const hostelIcon = new URL('../../assets/hostel.svg', import.meta.url).href;
const reportsIcon = new URL('../../assets/reports.svg', import.meta.url).href;
const canteenIcon = new URL('../../assets/canteen.svg', import.meta.url).href;
const orderPlaceIcon = new URL('../../assets/order_place.svg', import.meta.url).href;

function Dashboard({ onNavigate, isSidebarOpen, onToggleSidebar }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        readingRoomSales: 0,
        canteenSales: 0,
        totalEarnings: 0
    });
    const [chartData, setChartData] = useState([]);
    const [salesBreakdown, setSalesBreakdown] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            // 1. Fetch Canteen Orders
            const ordersRef = collection(db, 'orders');
            const ordersSnapshot = await getDocs(query(ordersRef, orderBy('createdAt', 'desc')));
            const orders = ordersSnapshot.docs.map(doc => ({
                ...doc.data(),
                date: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt),
                amount: doc.data().total || 0,
                type: 'canteen'
            }));

            // 2. Fetch Reading Room Transactions
            const transactionsRef = collection(db, 'transactions');
            const transactionsQuery = query(transactionsRef, orderBy('date', 'desc'));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            const transactions = transactionsSnapshot.docs.map(doc => {
                const data = doc.data();
                // Handle both ISO string and Firestore Timestamp
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

            console.log('📊 Dashboard: Fetched transactions:', transactions);

            // 3. Calculate Totals
            const totalCanteen = orders.reduce((sum, order) => sum + order.amount, 0);
            const totalReadingRoom = transactions.reduce((sum, txn) => sum + txn.amount, 0);

            console.log('💰 Dashboard: Canteen Sales:', totalCanteen);
            console.log('💰 Dashboard: Reading Room Sales:', totalReadingRoom);

            setStats({
                readingRoomSales: totalReadingRoom,
                canteenSales: totalCanteen,
                totalEarnings: totalCanteen + totalReadingRoom
            });

            // 4. Prepare Chart Data (Last 6 Months)
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentMonthIndex = new Date().getMonth();
            const last6Months = [];

            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                last6Months.push({
                    name: months[d.getMonth()],
                    rawDate: d,
                    readingRoom: 0,
                    canteen: 0
                });
            }

            // Aggregate data into months
            const allSales = [...orders, ...transactions];

            allSales.forEach(sale => {
                const saleMonthIndex = sale.date.getMonth();
                const saleYear = sale.date.getFullYear();

                // Find matching month in our last6Months array
                const monthData = last6Months.find(m =>
                    m.rawDate.getMonth() === saleMonthIndex &&
                    m.rawDate.getFullYear() === saleYear
                );

                if (monthData) {
                    if (sale.type === 'canteen') {
                        monthData.canteen += sale.amount;
                    } else {
                        monthData.readingRoom += sale.amount;
                    }
                }
            });

            setChartData(last6Months);

            // 5. Prepare Sales Breakdown
            setSalesBreakdown([
                { name: 'Reading Room', value: totalReadingRoom },
                { name: 'Canteen', value: totalCanteen }
            ]);

            setLoading(false);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <LoadingSpinner size="40" stroke="3" color="#333" />
            </div>
        );
    }

    return (
        <div style={{ padding: '0', maxWidth: '1600px', margin: '0 auto' }}>
            <PageHeader
                title="Overview"
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={onToggleSidebar}
            />
            <div style={{ padding: '32px' }}>
                <p style={{ color: '#6b7280', marginBottom: '32px' }}>Welcome back, Admin. Here's what's happening today.</p>

                {/* Top Stats Row */}
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
                            Active Memberships
                        </p>
                    </div>

                    {/* Card 2: Canteen Sales */}
                    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Canteen Sales</p>
                                <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                                    रु {stats.canteenSales.toLocaleString()}
                                </h3>
                            </div>
                            <div style={{ padding: '10px', backgroundColor: '#fef3c7', borderRadius: '12px', color: '#d97706' }}>
                                <ShoppingCart size={20} />
                            </div>
                        </div>
                        <p style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Updated recently
                        </p>
                    </div>

                    {/* Card 3: Total Earnings */}
                    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Total Earnings</p>
                                <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                                    रु {stats.totalEarnings.toLocaleString()}
                                </h3>
                            </div>
                            <div style={{ padding: '10px', backgroundColor: '#ecfdf5', borderRadius: '12px', color: '#059669' }}>
                                <CreditCard size={20} />
                            </div>
                        </div>
                        <p style={{ fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <TrendingUp size={14} /> +12.5% vs last month
                        </p>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px', marginBottom: '32px' }}>

                    {/* Main Chart */}
                    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', height: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>Statistics</h3>
                            <select style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none' }}>
                                <option>Last 6 months</option>
                            </select>
                        </div>
                        <ResponsiveContainer width="100%" height="85%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(value) => `k ${(value / 1000).toFixed(0)}`} />
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

                    {/* Breakdown Chart */}
                    <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', height: '400px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>Sales Breakdown</h3>
                        <ResponsiveContainer width="100%" height="60%">
                            <BarChart data={salesBreakdown} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 500 }} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
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

import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, orderBy, onSnapshot, limit } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import FullScreenLoader from '../../components/FullScreenLoader';
import Button from '../../components/Button';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import '../../styles/SalesDashboard.css';
import '../../styles/StandardLayout.css';



function SalesDashboard({ onBack, isSidebarOpen, onToggleSidebar }) {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [todaysSales, setTodaysSales] = useState(0);
  const [todaysOrders, setTodaysOrders] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSales();
  }, [selectedDate]);

  useEffect(() => {
    // Listen to all orders for real-time updates (simpler query without index)
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(1000));

    const unsubscribe = onSnapshot(q, () => {
      loadSales();
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const loadSales = async () => {
    setLoading(true);
    try {

      const ordersRef = collection(db, 'orders');

      const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(1000));
      const snapshot = await getDocs(q);
      const completedOrders = snapshot.docs
        .filter(doc => doc.data().status === 'completed')
        .map(doc => {
          const data = doc.data();
          const dateToParse = data.completedAt || data.createdAt;
          let dateStr = '';

          try {
            if (dateToParse) {
              const dateObj = new Date(dateToParse);
              if (!isNaN(dateObj.getTime())) {
                dateStr = dateObj.toISOString().split('T')[0];
              }
            }
          } catch (e) {
            console.error('Error parsing date for order', doc.id, e);
          }

          if (!dateStr) {
            dateStr = new Date().toISOString().split('T')[0];
          }

          return {
            id: doc.id,
            ...data,
            orderDate: dateStr
          };
        });

      // Filter by selected date
      const filteredSales = selectedDate
        ? completedOrders.filter(order => order.orderDate === selectedDate)
        : completedOrders;

      setSales(filteredSales);

      // Calculate today's totals
      const today = new Date().toISOString().split('T')[0];
      const todaysOrdersData = completedOrders.filter(order => order.orderDate === today);
      const todaysTotal = todaysOrdersData.reduce((sum, order) => sum + (order.total || 0), 0);

      setTodaysSales(todaysTotal);
      setTodaysOrders(todaysOrdersData.length);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };



  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';

      return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      // Split YYYY-MM-DD and create date locally to avoid timezone shifts
      const parts = dateString.split('-');
      if (parts.length !== 3) {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return 'Invalid Date';
        return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
      }

      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      if (isNaN(date.getTime())) return 'Invalid Date';

      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // Group sales by date for history view
  const salesByDate = sales.reduce((acc, sale) => {
    const date = sale.orderDate;
    if (!acc[date]) {
      acc[date] = {
        date,
        orders: [],
        total: 0,
        count: 0
      };
    }
    acc[date].orders.push(sale);
    acc[date].total += sale.total || 0;
    acc[date].count += 1;
    return acc;
  }, {});

  const salesHistory = Object.values(salesByDate).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="std-container">
      <PageHeader title="Sales Dashboard" onBack={onBack} isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />

      <main className="std-body">
        <section>
          {/* Summary Cards */}
          <div className="sd-stats-grid">
            {(!selectedDate || selectedDate === new Date().toISOString().split('T')[0]) ? (
              <>
                <div className="sd-stat-card green">
                  <div>
                    <p className="sd-stat-label">Today's Total Sales</p>
                    <p className="sd-stat-value">
                      रु {todaysSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="sd-stat-card blue">
                  <div>
                    <p className="sd-stat-label">Today's Total Orders</p>
                    <p className="sd-stat-value">{todaysOrders}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="sd-stat-card orange">
                <div>
                  <p className="sd-stat-label">Sales for {formatDateDisplay(selectedDate)}</p>
                  <p className="sd-stat-value">
                    रु {sales.reduce((sum, sale) => sum + (sale.total || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Date Filter */}
          <div className="sd-filter-section">
            <label className="sd-filter-label">Filter by Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="sd-date-input"
            />
            <Button
              onClick={() => setSelectedDate('')}
              variant="secondary"
              className="sd-btn"
            >
              Show All
            </Button>
            <Button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              variant="primary"
              className="sd-btn"
            >
              Today
            </Button>
          </div>

          {loading && <FullScreenLoader text="Loading sales data..." />}

          {!loading && selectedDate ? (
            // Show detailed sales for selected date
            <div>
              <div className="sd-section-header-group">
                <h2 className="sd-section-title" style={{ marginBottom: 0 }}>
                  Sales for {formatDateDisplay(selectedDate)}
                </h2>
                <div className="sd-search-container">
                  <input
                    type="text"
                    placeholder="Search by Order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="sd-search-input"
                  />
                </div>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                {sales.filter(s => s.id.toLowerCase().includes(searchQuery.toLowerCase())).length} orders
              </p>

              {sales.filter(s => s.id.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                <div className="sd-empty">
                  {searchQuery ? 'No orders match your search.' : 'No sales found for this date.'}
                </div>
              ) : (
                <div className="sd-list-grid">
                  {sales
                    .filter(sale => sale.id.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((sale) => (
                      <div key={sale.id} className={`sd-card ${selectedOrder?.id === sale.id ? 'active' : ''}`}>
                        {/* Surface View - Name, Location, Sales */}
                        <div
                          className="sd-card-summary"
                          onClick={() => setSelectedOrder(selectedOrder?.id === sale.id ? null : sale)}
                        >
                          <div>
                            <p className="sd-customer-name">
                              {sale.userName || sale.userEmail || 'Unknown Customer'}
                            </p>
                            <p className="sd-meta-text">
                              Order #{sale.id.substring(0, 8)} • {formatDate(sale.completedAt || sale.createdAt)}
                            </p>
                          </div>
                          <div>
                            <p className="sd-meta-text" style={{ fontWeight: 'bold' }}>
                              Location
                            </p>
                            <p className="sd-location-text">
                              {sale.location || 'Not specified'}
                            </p>
                          </div>
                          <div>
                            <p className="sd-meta-text" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                              Total Sales
                            </p>
                            <p className="sd-amount-text">
                              रु {sale.total?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>

                        {/* Expanded Bill Details */}
                        {selectedOrder?.id === sale.id && (
                          <div className="sd-details">
                            <div className="sd-bill-header">
                              <h3 className="sd-bill-title">
                                Bill Details
                              </h3>
                              <div className="sd-info-grid">
                                <div className="sd-info-item">
                                  <p>CUSTOMER NAME</p>
                                  <p>
                                    {sale.userName || sale.userEmail || 'Unknown Customer'}
                                  </p>
                                </div>
                                <div className="sd-info-item">
                                  <p>LOCATION</p>
                                  <p>
                                    {sale.location || 'Not specified'}
                                  </p>
                                </div>
                                <div className="sd-info-item">
                                  <p>ORDER DATE</p>
                                  <p>
                                    {formatDate(sale.completedAt || sale.createdAt)}
                                  </p>
                                </div>
                                <div className="sd-info-item">
                                  <p>ORDER ID</p>
                                  <p>
                                    {sale.id}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Items List */}
                            <div style={{ marginBottom: '1.5rem' }}>
                              <h4 style={{ margin: '0 0 1rem 0', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                                Items Purchased
                              </h4>
                              <div className="sd-items-container">
                                <table className="sd-table">
                                  <thead>
                                    <tr>
                                      <th>Item</th>
                                      <th className="sd-table-center">Quantity</th>
                                      <th className="sd-table-right">Unit Price</th>
                                      <th className="sd-table-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sale.items && sale.items.map((item, index) => (
                                      <tr key={index}>
                                        <td>{item.name}</td>
                                        <td className="sd-table-center">{item.quantity || 1}</td>
                                        <td className="sd-table-right">
                                          रु {item.price?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="sd-table-right" style={{ fontWeight: 'bold' }}>
                                          रु {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Note if exists */}
                            {sale.note && (
                              <div className="sd-bill-note">
                                <p className="sd-stat-label" style={{ color: '#bfa05aa8' }}>
                                  NOTE FROM CUSTOMER:
                                </p>
                                <p style={{ margin: 0 }}>{sale.note}</p>
                              </div>
                            )}

                            {/* Total */}
                            <div className="sd-bill-total">
                              <p className="sd-total-label">
                                GRAND TOTAL
                              </p>
                              <p className="sd-total-amount">
                                रु {sale.total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  {/* Daily Total */}
                  <div className="sd-bill-total" style={{ marginTop: '1.5rem', backgroundColor: 'var(--color-background)', border: '2px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <p className="sd-total-label">
                        Daily Total ({sales.length} orders)
                      </p>
                      <p className="sd-total-amount">
                        रु {sales.reduce((sum, sale) => sum + (sale.total || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : !loading && (
            // Show sales history grouped by date
            <div>
              <h2 className="sd-section-title">Sales History</h2>
              {salesHistory.length === 0 ? (
                <div className="sd-empty">No sales history found.</div>
              ) : (
                <div className="sd-list-grid">
                  {salesHistory.map((daySales) => (
                    <div
                      key={daySales.date}
                      className="sd-card"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedDate(daySales.date)}
                    >
                      <div className="sd-card-summary" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div>
                          <h3 className="sd-customer-name" style={{ fontSize: '1.25rem' }}>
                            {formatDateDisplay(daySales.date)}
                          </h3>
                          <p className="sd-meta-text">
                            {daySales.count} {daySales.count === 1 ? 'order' : 'orders'} • Click to view
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p className="sd-amount-text" style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>
                            रु {daySales.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default SalesDashboard;


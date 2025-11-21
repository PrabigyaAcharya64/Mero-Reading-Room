import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, orderBy, onSnapshot, limit } from 'firebase/firestore';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

function SalesDashboard({ onBack }) {
  const { user, signOutUser } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Canteen Staff';
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [todaysSales, setTodaysSales] = useState(0);
  const [todaysOrders, setTodaysOrders] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
      // Get all completed orders - using simpler query to avoid index requirement
      const ordersRef = collection(db, 'orders');
      // First get all orders, then filter in memory (for now, until index is created)
      // This is less efficient but works without index
      const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(1000));
      const snapshot = await getDocs(q);

      // Filter completed orders in memory
      const completedOrders = snapshot.docs
        .filter(doc => doc.data().status === 'completed')
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          orderDate: doc.data().completedAt
            ? new Date(doc.data().completedAt).toISOString().split('T')[0]
            : new Date(doc.data().createdAt).toISOString().split('T')[0]
        }));

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


  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
    <div className="landing-screen">
      <header className="landing-header">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="landing-signout"
            style={{
              border: '1px solid var(--color-text-primary)',
              padding: '0.5rem 0.85rem'
            }}
          >
            ← Back
          </button>
        )}
        <p className="landing-greeting" style={{ flex: 1, textAlign: onBack ? 'center' : 'left' }}>
          Hey <span>{displayName}</span>!
        </p>
        <div className="landing-status">
          <button type="button" className="landing-profile" aria-label="Profile">
            <img src={profileIcon} alt="" />
          </button>
          <button type="button" className="landing-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="landing-body" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>

        <section>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{
              padding: '20px',
              backgroundColor: '#4caf50',
              borderRadius: '8px',
              color: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', opacity: 0.9 }}>Today's Total Sales</p>
              <p style={{ margin: '0', fontSize: '32px', fontWeight: 'bold' }}>
                रु {todaysSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div style={{
              padding: '20px',
              backgroundColor: '#2196f3',
              borderRadius: '8px',
              color: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', opacity: 0.9 }}>Today's Total Orders</p>
              <p style={{ margin: '0', fontSize: '32px', fontWeight: 'bold' }}>
                {todaysOrders}
              </p>
            </div>
            {selectedDate && selectedDate !== new Date().toISOString().split('T')[0] && (
              <div style={{
                padding: '20px',
                backgroundColor: '#ff9800',
                borderRadius: '8px',
                color: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px', opacity: 0.9 }}>
                  Sales for {formatDateDisplay(selectedDate)}
                </p>
                <p style={{ margin: '0', fontSize: '32px', fontWeight: 'bold' }}>
                  रु {sales.reduce((sum, sale) => sum + (sale.total || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>

          {/* Date Filter */}
          <div style={{ marginBottom: '30px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              Filter by Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            />
            <button
              onClick={() => setSelectedDate('')}
              style={{
                padding: '10px 20px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Show All
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Today
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading sales data...</p>
          ) : selectedDate ? (
            // Show detailed sales for selected date
            <div>
              <h2 style={{ marginBottom: '20px' }}>
                Sales for {formatDateDisplay(selectedDate)} ({sales.length} orders)
              </h2>
              {sales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  No sales found for this date.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {sales.map((sale) => (
                    <div key={sale.id}>
                      {/* Surface View - Name, Location, Sales */}
                      <div
                        onClick={() => setSelectedOrder(selectedOrder?.id === sale.id ? null : sale)}
                        style={{
                          border: selectedOrder?.id === sale.id ? '2px solid #4caf50' : '1px solid #ddd',
                          borderRadius: '8px',
                          padding: '20px',
                          backgroundColor: selectedOrder?.id === sale.id ? '#f0fff0' : '#fff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1.5fr 1fr',
                          gap: '20px',
                          alignItems: 'center'
                        }}>
                          <div>
                            <p style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                              {sale.userName || sale.userEmail || 'Unknown Customer'}
                            </p>
                            <p style={{ margin: '0', color: '#666', fontSize: '12px' }}>
                              Order #{sale.id.substring(0, 8)} • {formatDate(sale.completedAt || sale.createdAt)}
                            </p>
                          </div>
                          <div>
                            <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                              Location
                            </p>
                            <p style={{ margin: '0', fontSize: '16px', color: '#333' }}>
                              {sale.location || 'Not specified'}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                              Total Sales
                            </p>
                            <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                              रु {sale.total?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Bill Details */}
                      {selectedOrder?.id === sale.id && (
                        <div style={{
                          border: '2px solid #4caf50',
                          borderTop: 'none',
                          borderRadius: '0 0 8px 8px',
                          padding: '25px',
                          backgroundColor: '#fff',
                          marginTop: '-8px',
                          marginBottom: '15px',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                        }}>
                          <div style={{
                            borderBottom: '2px solid #4caf50',
                            paddingBottom: '15px',
                            marginBottom: '20px'
                          }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#333' }}>
                              Bill Details
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                              <div>
                                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>CUSTOMER NAME</p>
                                <p style={{ margin: '0', fontSize: '16px', color: '#333' }}>
                                  {sale.userName || sale.userEmail || 'Unknown Customer'}
                                </p>
                              </div>
                              <div>
                                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>LOCATION</p>
                                <p style={{ margin: '0', fontSize: '16px', color: '#333' }}>
                                  {sale.location || 'Not specified'}
                                </p>
                              </div>
                              <div>
                                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>ORDER DATE</p>
                                <p style={{ margin: '0', fontSize: '16px', color: '#333' }}>
                                  {formatDate(sale.completedAt || sale.createdAt)}
                                </p>
                              </div>
                              <div>
                                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>ORDER ID</p>
                                <p style={{ margin: '0', fontSize: '16px', color: '#333' }}>
                                  {sale.id}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Items List */}
                          <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#333', fontWeight: 'bold' }}>
                              Items Purchased
                            </h4>
                            <div style={{
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold', color: '#666', borderBottom: '2px solid #ddd' }}>Item</th>
                                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#666', borderBottom: '2px solid #ddd' }}>Quantity</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: '#666', borderBottom: '2px solid #ddd' }}>Unit Price</th>
                                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: '#666', borderBottom: '2px solid #ddd' }}>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sale.items && sale.items.map((item, index) => (
                                    <tr key={index} style={{ borderBottom: index < sale.items.length - 1 ? '1px solid #eee' : 'none' }}>
                                      <td style={{ padding: '12px', fontSize: '14px', color: '#333' }}>{item.name}</td>
                                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: '#333' }}>{item.quantity || 1}</td>
                                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: '#333' }}>
                                        रु {item.price?.toFixed(2) || '0.00'}
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
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
                            <div style={{
                              padding: '15px',
                              backgroundColor: '#fff3cd',
                              borderRadius: '4px',
                              borderLeft: '4px solid #ffc107',
                              marginBottom: '20px'
                            }}>
                              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
                                NOTE FROM CUSTOMER:
                              </p>
                              <p style={{ margin: '0', fontSize: '14px', color: '#333' }}>{sale.note}</p>
                            </div>
                          )}

                          {/* Total */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '20px',
                            backgroundColor: '#f0fff0',
                            borderRadius: '4px',
                            border: '2px solid #4caf50'
                          }}>
                            <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                              GRAND TOTAL
                            </p>
                            <p style={{ margin: '0', fontSize: '28px', fontWeight: 'bold', color: '#4caf50' }}>
                              रु {sale.total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Daily Total */}
                  <div style={{
                    border: '2px solid #4caf50',
                    borderRadius: '8px',
                    padding: '20px',
                    backgroundColor: '#f0fff0',
                    marginTop: '20px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold' }}>
                        Daily Total ({sales.length} orders)
                      </p>
                      <p style={{ margin: '0', fontSize: '28px', fontWeight: 'bold', color: '#4caf50' }}>
                        रु {sales.reduce((sum, sale) => sum + (sale.total || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Show sales history grouped by date
            <div>
              <h2 style={{ marginBottom: '20px' }}>Sales History</h2>
              {salesHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  No sales history found.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {salesHistory.map((daySales) => (
                    <div
                      key={daySales.date}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        padding: '20px',
                        backgroundColor: '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedDate(daySales.date)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                            {formatDateDisplay(daySales.date)}
                          </h3>
                          <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                            {daySales.count} {daySales.count === 1 ? 'order' : 'orders'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                            रु {daySales.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '12px' }}>
                            Click to view details
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


import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

function ClientOrderHistory({ onBack }) {
  const { user, signOutUser, userBalance } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Reader';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'completed', 'cancelled'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10); // Show 10 orders per page

  useEffect(() => {
    if (!user) return;

    const ordersRef = collection(db, 'orders');
    // Query without orderBy to avoid index requirement - we'll sort client-side
    const q = query(ordersRef);

    // Set up real-time listener for orders
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filter orders by current user's ID and sort by createdAt descending
        const ordersData = snapshot.docs
          .filter(doc => doc.data().userId === user.uid)
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            // Sort by createdAt descending (newest first)
            const aTime = a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime();
            const bTime = b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
          });
        setOrders(ordersData);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to orders:', error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [user]);

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#ff9800';
      case 'completed':
        return '#4caf50';
      case 'cancelled':
        return '#f44336';
      default:
        return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status || 'Pending';
    }
  };

  const filteredOrders = filterStatus === 'all' 
    ? orders 
    : orders.filter(order => order.status === filterStatus);

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  return (
    <div className="landing-screen">
      <header className="landing-header">
        {/* Left: Back Button */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            {onBack && (
                <button
                    onClick={onBack}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        background: '#fff',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        color: '#000',
                        fontFamily: 'var(--brand-font-body)',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                        e.currentTarget.style.borderColor = '#d0d0d0';
                        e.currentTarget.style.transform = 'translateX(-2px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.transform = 'translateX(0)';
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back
                </button>
            )}
        </div>

        {/* Center: Greeting */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <p className="landing-greeting" style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Hey <span>{displayName}</span>!
            </p>
        </div>

        {/* Right: Status */}
        <div className="landing-status" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <div className="landing-balance" aria-label="Current balance">
            <div className="landing-balance__label">Balance</div>
            <div className="landing-balance__value">रु {userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <button type="button" className="landing-balance__add" aria-label="Add to balance">
              +
            </button>
          </div>
          <button type="button" className="landing-profile" aria-label="Profile">
            <img src={profileIcon} alt="" />
          </button>
          <button type="button" className="landing-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="landing-body" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <h2>My Orders ({filteredOrders.length})</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setFilterStatus('all')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: filterStatus === 'all' ? '#4a4' : '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: filterStatus === 'pending' ? '#ff9800' : '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Pending
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: filterStatus === 'completed' ? '#4caf50' : '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Completed
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading orders...</p>
          ) : filteredOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              No orders found.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: '20px' }}>
                {currentOrders.map((order) => (
                <div key={order.id}>
                  {/* Surface View - Order Summary */}
                  <div
                    onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                    style={{
                      border: selectedOrder?.id === order.id ? '2px solid #4caf50' : '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '20px',
                      backgroundColor: selectedOrder?.id === order.id ? '#f0fff0' : '#fff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 1fr 1fr',
                      gap: '20px',
                      alignItems: 'center'
                    }}>
                      <div>
                        <p style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                          Order #{order.id.substring(0, 8)}
                        </p>
                        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                          {formatDate(order.createdAt)}
                        </p>
                        <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '12px' }}>
                          {order.items?.length || 0} item(s)
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                          Status
                        </p>
                        <span
                          style={{
                            padding: '6px 12px',
                            backgroundColor: getStatusColor(order.status || 'pending'),
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            display: 'inline-block'
                          }}
                        >
                          {getStatusText(order.status || 'pending')}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                          Total
                        </p>
                        <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                          रु {order.total?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Order Details */}
                  {selectedOrder?.id === order.id && (
                    <div style={{
                      border: '2px solid #4caf50',
                      borderTop: 'none',
                      borderRadius: '0 0 8px 8px',
                      padding: '25px',
                      backgroundColor: '#fff',
                      marginTop: '-8px',
                      marginBottom: '20px',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ 
                        borderBottom: '2px solid #4caf50', 
                        paddingBottom: '15px', 
                        marginBottom: '20px' 
                      }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#333' }}>
                          Order Details
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                          <div>
                            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>ORDER ID</p>
                            <p style={{ margin: '0', fontSize: '16px', color: '#333' }}>{order.id}</p>
                          </div>
                          <div>
                            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>ORDER DATE</p>
                            <p style={{ margin: '0', fontSize: '16px', color: '#333' }}>{formatDate(order.createdAt)}</p>
                          </div>
                          <div>
                            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>STATUS</p>
                            <span
                              style={{
                                padding: '6px 12px',
                                backgroundColor: getStatusColor(order.status || 'pending'),
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                display: 'inline-block'
                              }}
                            >
                              {getStatusText(order.status || 'pending')}
                            </span>
                          </div>
                          {order.location && (
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>LOCATION</p>
                              <p style={{ margin: '0', fontSize: '16px', color: '#333' }}>{order.location}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Items List */}
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#333', fontWeight: 'bold' }}>
                          Items Ordered
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
                              {order.items && order.items.map((item, index) => (
                                <tr key={index} style={{ borderBottom: index < order.items.length - 1 ? '1px solid #eee' : 'none' }}>
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
                      {order.note && (
                        <div style={{
                          padding: '15px',
                          backgroundColor: '#fff3cd',
                          borderRadius: '4px',
                          borderLeft: '4px solid #ffc107',
                          marginBottom: '20px'
                        }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
                            YOUR NOTE:
                          </p>
                          <p style={{ margin: '0', fontSize: '14px', color: '#333' }}>{order.note}</p>
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
                          रु {order.total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '10px',
                marginTop: '30px',
                paddingTop: '20px',
                borderTop: '1px solid #ddd'
              }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: currentPage === 1 ? '#ccc' : '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ← Previous
                </button>
                
                <span style={{ fontSize: '14px', color: '#666' }}>
                  Page {currentPage} of {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: currentPage === totalPages ? '#ccc' : '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
          )}
        </section>
      </main>
    </div>
  );
}

export default ClientOrderHistory;

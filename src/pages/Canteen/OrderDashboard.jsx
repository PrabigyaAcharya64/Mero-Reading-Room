import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

function OrderDashboard({ onBack }) {
  const { user, signOutUser } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Canteen Staff';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'completed', 'cancelled'

  useEffect(() => {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    // Set up real-time listener for orders
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
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
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const updateData = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      // If marking as completed, add completedAt timestamp
      if (newStatus === 'completed') {
        updateData.completedAt = new Date().toISOString();

        // Get order data to create sales record
        const orderDoc = await getDoc(orderRef);
        if (orderDoc.exists()) {
          const orderData = orderDoc.data();
          const orderDate = new Date().toISOString().split('T')[0];

          // Create/update daily sales record
          const salesRef = doc(db, 'dailySales', orderDate);
          const salesDoc = await getDoc(salesRef);

          if (salesDoc.exists()) {
            const salesData = salesDoc.data();
            await updateDoc(salesRef, {
              totalSales: (salesData.totalSales || 0) + (orderData.total || 0),
              totalOrders: (salesData.totalOrders || 0) + 1,
              updatedAt: new Date().toISOString(),
            });
          } else {
            await setDoc(salesRef, {
              date: orderDate,
              totalSales: orderData.total || 0,
              totalOrders: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      await updateDoc(orderRef, updateData);
    } catch (error) {
      console.error('Error updating order status:', error);
      let errorMessage = 'Failed to update order status';

      if (error?.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check Firestore security rules.';
      } else if (error?.code === 'not-found') {
        errorMessage = 'Order not found. It may have been deleted.';
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }

      alert(errorMessage);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(order => order.status === filterStatus);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <h2>Orders Dashboard ({filteredOrders.length})</h2>
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
            <div style={{ display: 'grid', gap: '20px' }}>
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '20px',
                    backgroundColor: '#fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                        {order.userName || order.userEmail || 'Unknown User'}
                      </h3>
                      <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                        {order.userEmail && order.userEmail !== order.userName ? order.userEmail : ''}
                      </p>
                      <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
                        Order ID: {order.id.substring(0, 8)}...
                      </p>
                      <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '6px 12px',
                          backgroundColor: getStatusColor(order.status || 'pending'),
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}
                      >
                        {order.status || 'pending'}
                      </span>
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'completed')}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Mark Complete
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>Order Items:</h4>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {order.items && order.items.map((item, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px',
                            backgroundColor: '#f9f9f9',
                            borderRadius: '4px'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{item.name}</p>
                            <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                              Quantity: {item.quantity || 1}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: '0', fontSize: '16px', fontWeight: 'bold' }}>
                              रु {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                            </p>
                            <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '12px' }}>
                              रु {item.price?.toFixed(2) || '0.00'} each
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '15px',
                    marginBottom: '15px',
                    padding: '15px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px'
                  }}>
                    <div>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>TOTAL PRICE</p>
                      <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#111' }}>
                        रु {order.total?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>LOCATION</p>
                      <p style={{ margin: '0', fontSize: '16px', color: '#333' }}>
                        {order.location || 'Not specified'}
                      </p>
                    </div>
                  </div>

                  {order.note && (
                    <div style={{
                      padding: '15px',
                      backgroundColor: '#fff3cd',
                      borderRadius: '4px',
                      borderLeft: '4px solid #ffc107'
                    }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>NOTE FROM CUSTOMER:</p>
                      <p style={{ margin: '0', fontSize: '14px', color: '#333' }}>{order.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default OrderDashboard;


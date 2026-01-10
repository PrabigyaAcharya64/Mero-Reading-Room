import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import '../../styles/OrderDashboard.css';



function OrderDashboard({ onBack }) {
  const { user, userRole } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'completed', 'cancelled'
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    // Reset to first page when filter changes
    setCurrentPage(1);
  }, [filterStatus]);

  useEffect(() => {
    const ordersRef = collection(db, 'orders');
    // Determine valid role
    const isStaff = userRole === 'admin' || userRole === 'canteen';

    // Rule: allow list: if loggedIn() && (isStaff() || resource.data.userId == request.auth.uid)
    // Non-staff queries MUST include where('userId', '==', uid) to pass the rule.
    let q;
    if (isStaff) {
      q = query(ordersRef, orderBy('createdAt', 'desc'));
    } else {
      q = query(ordersRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

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


  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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
    <div className="od-container">
      <PageHeader title="Orders Dashboard" onBack={onBack} />

      <main className="od-body">
        <section>
          <div className="od-toolbar">
            <h2 className="od-section-title">Orders ({filteredOrders.length})</h2>
            <div className="od-filters">
              <input
                type="text"
                placeholder="Search by Order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="od-search-input"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-default)',
                  border: '1px solid #ddd',
                  fontFamily: 'var(--brand-font-sans)',
                  fontSize: '0.9rem',
                  width: '200px'
                }}
              />
              {['all', 'pending', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`od-filter-btn ${status} ${filterStatus === status ? 'active' : ''}`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <LoadingSpinner size="40" stroke="3" color="#666" />
              <p style={{ marginTop: '15px', color: '#666' }}>Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="od-empty">
              No orders found.
            </div>
          ) : (
            <div className="od-grid">
              {currentOrders.map((order) => (
                <div key={order.id} className="od-card">

                  {/* Card Header */}
                  <div className="od-card-header">
                    <div className="od-user-info">
                      <h3>{order.userName || order.userEmail || 'Unknown User'}</h3>
                      <p className="od-user-email">
                        {order.userEmail && order.userEmail !== order.userName ? order.userEmail : ''}
                      </p>
                      <p className="od-order-id">ID: {order.id}</p>
                      <p className="od-order-date">{formatDate(order.createdAt)}</p>
                    </div>

                    <div className="od-card-actions">
                      <span className="od-status-badge" style={{ backgroundColor: getStatusColor(order.status || 'pending') }}>
                        {order.status || 'pending'}
                      </span>

                      {order.status === 'pending' && (
                        <div className="od-action-btn-group">
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'completed')}
                            className="od-btn-icon od-btn-complete"
                            title="Mark as Completed"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                            className="od-btn-icon od-btn-cancel"
                            title="Cancel Order"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 className="od-items-title">Order Items:</h4>
                    <div className="od-items-grid">
                      {order.items && order.items.map((item, index) => (
                        <div key={index} className="od-item">
                          <div className="od-item-info">
                            <p className="od-item-name">{item.name}</p>
                            <p className="od-item-qty">Qty: {item.quantity || 1}</p>
                          </div>
                          <div className="od-item-price">
                            <p className="od-item-total">
                              रु {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                            </p>
                            <p className="od-item-unit">
                              {item.price?.toFixed(2) || '0.00'} ea
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="od-summary">
                    <div className="od-summary-item">
                      <p>TOTAL PRICE</p>
                      <p className="od-summary-total">
                        रु {order.total?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="od-summary-item">
                      <p>LOCATION</p>
                      <p className="od-summary-text">
                        {order.location || 'Not specified'}
                      </p>
                    </div>
                  </div>

                  {/* Notes */}
                  {order.note && (
                    <div className="od-note">
                      <p className="od-note-label">NOTE FROM CUSTOMER:</p>
                      <p className="od-note-text">{order.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {filteredOrders.length > itemsPerPage && (
            <div className="od-pagination">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="od-page-btn"
              >
                Previous
              </button>

              <span className="od-page-info">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="od-page-btn"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default OrderDashboard;


import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, getDoc, where } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import FullScreenLoader from '../../components/FullScreenLoader';
import Button from '../../components/Button';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import '../../styles/OrderDashboard.css';
import '../../styles/StandardLayout.css';

function OrderDashboard({ onBack, isSidebarOpen, onToggleSidebar }) {
  const { user, userRole } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('completed'); // Default to completed
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

  const filteredOrders = orders.filter(order => {
    const matchesStatus = order.status === filterStatus;
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Universal date formatter
  const formatDate = (val) => {
    if (!val) return 'N/A';
    try {
      let date;
      // Check if val is a Firestore timestamp (object with seconds)
      if (typeof val === 'object' && val.seconds) {
        date = new Date(val.seconds * 1000);
      } else {
        // Try parsing as string or Date object
        date = new Date(val);
      }

      if (isNaN(date.getTime())) return 'N/A';

      return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'N/A';
    }
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
    <div className="std-container">
      <PageHeader title="Orders History" onBack={onBack} isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />

      <main className="std-body">
        <section>
          <div className="od-toolbar">
            <h2 className="od-section-title">History ({filteredOrders.length})</h2>
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
              {['completed', 'cancelled'].map((status) => (
                <Button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  variant={filterStatus === status ? 'primary' : 'outline'}
                  className={`od-filter-btn ${status}`}
                  style={{
                    backgroundColor: filterStatus === status ? (status === 'completed' ? '#4caf50' : '#f44336') : 'transparent',
                    borderColor: filterStatus === status ? 'transparent' : '#ddd',
                    color: filterStatus === status ? 'white' : '#666'
                  }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {loading && <FullScreenLoader text="Loading orders history..." />}

          {!loading && filteredOrders.length === 0 ? (
            <div className="od-empty">
              No orders found.
            </div>
          ) : !loading && (
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
                              Rs. {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
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
                        Rs. {order.total?.toFixed(2) || '0.00'}
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
              <Button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                variant="outline"
              >
                Previous
              </Button>

              <span className="od-page-info">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default OrderDashboard;

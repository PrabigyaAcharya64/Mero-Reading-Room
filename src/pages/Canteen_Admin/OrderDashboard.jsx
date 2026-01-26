import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import FullScreenLoader from '../../components/FullScreenLoader';
import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import { Search, Package, MapPin, Receipt, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import '../../styles/OrderDashboard.css';
import '../../styles/StandardLayout.css';

function OrderDashboard({ onBack, isSidebarOpen, onToggleSidebar }) {
  const { user, userRole } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('completed');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    const ordersRef = collection(db, 'orders');
    const isStaff = userRole === 'admin' || userRole === 'canteen';

    let q;
    if (isStaff) {
      q = query(ordersRef, orderBy('createdAt', 'desc'));
    } else {
      q = query(ordersRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to orders:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userRole, user.uid]);

  const filteredOrders = orders.filter(order => {
    const matchesStatus = order.status === filterStatus;
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (order.userName && order.userName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const formatDate = (val) => {
    if (!val) return 'N/A';
    try {
      const date = val.seconds ? new Date(val.seconds * 1000) : new Date(val);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="std-container">
      <PageHeader title="Orders History" onBack={onBack} isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />

      <main className="od-body">
        <section>
          <div className="od-toolbar">
            <h2 className="od-section-title">History ({filteredOrders.length})</h2>
            <div className="od-filters">
              <div className="od-search-wrapper">
                <Search size={16} className="od-search-icon" />
                <input
                  type="text"
                  placeholder="ID or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="od-search-input"
                />
              </div>
              <div className="od-segments">
                {['completed', 'cancelled'].map((status) => (
                  <button
                    key={status}
                    className={`od-segment-btn ${filterStatus === status ? 'active' : ''}`}
                    onClick={() => setFilterStatus(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading && <FullScreenLoader text="Loading orders archive..." />}

          {!loading && filteredOrders.length === 0 ? (
            <div className="abl-empty" style={{ background: 'var(--color-surface)', padding: '60px' }}>
              <Package size={48} className="text-gray-300" style={{ marginBottom: '16px' }} />
              <h3>No Archive Data</h3>
              <p>Try matching with a different status or search term.</p>
            </div>
          ) : !loading && (
            <div className="od-grid">
              {currentOrders.map((order) => (
                <div key={order.id} className="od-card">
                  <div className="od-card-header">
                    <div className="od-user-info">
                      <h3>{order.userName || 'Guest User'}</h3>
                      <p className="od-user-email">{order.userEmail || 'no-email@provided'}</p>
                      <div className="od-order-meta">
                        <p className="od-order-id">ID: {order.id.toUpperCase()}</p>
                        <p className="od-order-date">
                          <Clock size={10} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span className={`od-status-badge ${order.status}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="od-items-section">
                    <label className="od-section-label">Ordered Items</label>
                    <div className="od-items-list">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="od-item-row">
                          <div>
                            <p className="od-item-name">{item.name}</p>
                            <p className="od-item-qty">Quantity: {item.quantity || 1}</p>
                          </div>
                          <div className="od-item-price-group">
                            <p className="od-item-total">रु {((item.price || 0) * (item.quantity || 1)).toFixed(0)}</p>
                            <p className="od-item-unit">रु {item.price?.toFixed(0)} ea</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="od-summary-box">
                    <div className="od-summary-item">
                      <label>Total Remittance</label>
                      <p className="od-summary-total">रु {order.total?.toFixed(0)}</p>
                    </div>
                    <div className="od-summary-item" style={{ textAlign: 'right' }}>
                      <label>Service Point</label>
                      <p className="od-summary-text">
                        <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 
                        {order.location || 'Reading Room'}
                      </p>
                    </div>
                  </div>

                  {order.note && (
                    <div className="od-note" style={{ marginTop: '16px', background: 'rgba(255, 204, 0, 0.05)', padding: '12px', borderLeft: '3px solid #FFCC00', borderRadius: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#8E6D00', display: 'block', marginBottom: '4px' }}>Instruction</label>
                      <p style={{ fontSize: '13px', margin: 0, fontStyle: 'italic' }}>{order.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {filteredOrders.length > itemsPerPage && (
            <div className="od-pagination">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                variant="ghost"
              >
                <ChevronLeft size={18} /> Previous
              </Button>
              <span className="od-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                variant="ghost"
              >
                Next <ChevronRight size={18} />
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default OrderDashboard;

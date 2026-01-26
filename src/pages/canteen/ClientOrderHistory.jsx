import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import '../../styles/ClientOrderHistory.css';
import '../../styles/StandardLayout.css';
import PageHeader from '../../components/PageHeader';
import { ShoppingBag, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, MapPin, ReceiptText } from 'lucide-react';

function ClientOrderHistory({ onBack }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  useEffect(() => {
    if (!user) return;
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime();
          const bTime = b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to orders:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock size={12} />;
      case 'completed': return <CheckCircle2 size={12} />;
      case 'cancelled': return <XCircle size={12} />;
      default: return <Clock size={12} />;
    }
  };

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(order => order.status === filterStatus);

  return (
    <div className="std-container">
      <PageHeader title="Order History" onBack={onBack} />

      <main className="coh-body">
        <div className="coh-filter-bar">
          <h2 className="coh-filter-title">My Orders</h2>
          <div className="coh-segments">
            {['all', 'pending', 'completed', 'cancelled'].map((status) => (
              <button
                key={status}
                className={`coh-segment-btn ${filterStatus === status ? 'active' : ''}`}
                onClick={() => setFilterStatus(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="abl-empty" style={{ padding: '60px' }}>
            <div className="abl-spinner"></div>
            <p style={{ marginTop: '16px', color: 'var(--color-text-secondary)' }}>Loading your history...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="abl-empty" style={{ padding: '60px' }}>
            <ShoppingBag size={48} className="text-gray-300" style={{ marginBottom: '16px' }} />
            <h3>No Orders Found</h3>
            <p>You haven't placed any orders matching this status yet.</p>
          </div>
        ) : (
          <div className="coh-grid">
            {filteredOrders.map((order) => {
              const isExpanded = selectedOrderId === order.id;
              return (
                <div key={order.id} className="coh-card-container">
                  <div
                    className={`coh-card ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => setSelectedOrderId(isExpanded ? null : order.id)}
                  >
                    <div className="coh-card-header">
                      <div>
                        <h3 className="coh-order-id">Order #{order.id.substring(0, 8).toUpperCase()}</h3>
                        <p className="coh-order-date">{formatDate(order.createdAt)}</p>
                        <p className="coh-item-count">{order.items?.length || 0} items</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                        <span className={`coh-status-badge ${order.status || 'pending'}`}>
                          {getStatusIcon(order.status)} {order.status || 'pending'}
                        </span>
                        <div className="coh-total-group">
                          <p className="coh-total-value">रु {order.total?.toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px', color: 'var(--color-text-tertiary)' }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="coh-expanded-view">
                      <div className="coh-details-section">
                        <h3>Order Details</h3>
                        <div className="coh-details-grid">
                          <div className="coh-detail-item">
                            <label>Order ID</label>
                            <span>{order.id}</span>
                          </div>
                          <div className="coh-detail-item">
                            <label>Location</label>
                            <span><MapPin size={10} style={{ marginRight: '4px' }} /> {order.location || 'Reading Room'}</span>
                          </div>
                          <div className="coh-detail-item">
                            <label>Items</label>
                            <span>{order.items?.length || 0} Total Items</span>
                          </div>
                        </div>
                      </div>

                      <div className="coh-details-section">
                        <h3><ReceiptText size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Subtotal</h3>
                        <table className="coh-item-table">
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th style={{ textAlign: 'center' }}>Qty</th>
                              <th style={{ textAlign: 'right' }}>Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items?.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.name}</td>
                                <td style={{ textAlign: 'center' }}>{item.quantity || 1}</td>
                                <td style={{ textAlign: 'right' }}>रु {(item.price * (item.quantity || 1)).toFixed(0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {order.note && (
                        <div className="coh-note-box">
                          <label>Special Instructions</label>
                          <p>{order.note}</p>
                        </div>
                      )}

                      <div className="coh-grand-total">
                        <label>Grand Total</label>
                        <span>रु {order.total?.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default ClientOrderHistory;

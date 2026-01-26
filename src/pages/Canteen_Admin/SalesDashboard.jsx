import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { useLoading } from '../../context/GlobalLoadingContext';
import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import { TrendingUp, Banknote, ShoppingCart, Calendar, Search, MapPin, ReceiptText, ChevronLeft, ChevronRight } from 'lucide-react';
import '../../styles/SalesDashboard.css';
import '../../styles/StandardLayout.css';

function SalesDashboard({ onBack }) {
  const { userRole } = useAuth();
  const { setIsLoading } = useLoading();
  const [sales, setSales] = useState([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewSales, setViewSales] = useState(0);
  const [viewOrdersCount, setViewOrdersCount] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');


  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useLayoutEffect(() => {
    loadSales();
  }, [selectedDate]);

  useEffect(() => {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(1000));
    const unsubscribe = onSnapshot(q, () => loadSales());
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setCurrentPage(1); // Reset pagination on date or search change
  }, [selectedDate, searchQuery]);

  const loadSales = async () => {
    setIsLoading(true);
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
              const dateObj = valToDate(dateToParse);
              if (dateObj) dateStr = dateObj.toISOString().split('T')[0];
            }
          } catch (e) { console.error(e); }

          if (!dateStr) dateStr = new Date().toISOString().split('T')[0];

          return { id: doc.id, ...data, orderDate: dateStr };
        });

      // Stats calculation for the context (selected date or all time)
      const filteredForStats = selectedDate
        ? completedOrders.filter(order => order.orderDate === selectedDate)
        : completedOrders;

      setViewSales(filteredForStats.reduce((sum, order) => sum + (order.total || 0), 0));
      setViewOrdersCount(filteredForStats.length);

      setSales(filteredForStats);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setIsLoading(false);
      setIsDataReady(true);
    }
  };

  const valToDate = (val) => {
    if (!val) return null;
    if (val.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return 'All Records';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (val) => {
    const date = valToDate(val);
    return date ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
  };

  const filteredSalesData = sales.filter(s =>
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.userName && s.userName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredSalesData.length / itemsPerPage);
  const currentOrders = filteredSalesData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const salesByDate = sales.reduce((acc, sale) => {
    const date = sale.orderDate;
    if (!acc[date]) acc[date] = { date, orders: [], total: 0, count: 0 };
    acc[date].orders.push(sale);
    acc[date].total += sale.total || 0;
    acc[date].count += 1;
    return acc;
  }, {});

  const salesHistory = Object.values(salesByDate).sort((a, b) => b.date.localeCompare(a.date));

  if (!isDataReady) return null;

  return (
    <div className="std-container">
      <PageHeader title="Sales Insights" onBack={onBack} />

      <main className="sd-body">
        <section>
          {/* Dashboard Summary Cards - Now Contextual */}
          <div className="sd-stats-grid">
            <div className="sd-stat-card green">
              <div>
                <label className="sd-stat-label">{selectedDate ? 'Selected Day Revenue' : 'Total Revenue'}</label>
                <p className="sd-stat-value">रु {viewSales.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
              </div>
              <Banknote size={48} className="sd-stat-icon-bg" />
            </div>
            <div className="sd-stat-card blue">
              <div>
                <label className="sd-stat-label">{selectedDate ? 'Selected Day Orders' : 'Total Orders'}</label>
                <p className="sd-stat-value">{viewOrdersCount}</p>
              </div>
              <ShoppingCart size={48} className="sd-stat-icon-bg" />
            </div>
            <div className="sd-stat-card orange">
              <div>
                <label className="sd-stat-label">Performance</label>
                <p className="sd-stat-value">Stable</p>
              </div>
              <TrendingUp size={48} className="sd-stat-icon-bg" />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="sd-filter-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={18} className="text-blue-500" />
              <label className="sd-filter-label">Historical View</label>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="sd-date-input"
            />
            <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
              <Button onClick={() => setSelectedDate('')} variant="outline" size="sm">Show All</Button>
              <Button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} variant="primary" size="sm">Today</Button>
            </div>
          </div>



          {selectedDate ? (
            <div>
              <div className="sd-header-controls">
                <h2 className="od-section-title">{formatDateDisplay(selectedDate)}</h2>
                <div className="sd-search-wrapper">
                  <Search size={16} className="sd-search-icon" />
                  <input
                    type="text"
                    placeholder="Search Order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="sd-search-input"
                  />
                </div>
              </div>

              {currentOrders.length === 0 ? (
                <div className="abl-empty" style={{ background: 'var(--color-surface)', padding: '60px' }}>
                  <ShoppingCart size={48} className="text-gray-300" style={{ marginBottom: '16px' }} />
                  <h3>No Snapshots</h3>
                  <p>Check your filters or try a different date.</p>
                </div>
              ) : (
                <div className="sd-list-grid">
                  {currentOrders.map((sale) => (
                    <div key={sale.id} className={`sd-card ${selectedOrderId === sale.id ? 'active' : ''}`}>
                      <div
                        className="sd-card-summary"
                        onClick={() => setSelectedOrderId(selectedOrderId === sale.id ? null : sale.id)}
                      >
                        <div>
                          <p className="sd-customer-name">{sale.userName || 'Verified User'}</p>
                          <p className="sd-meta-text">#{sale.id.substring(0, 10).toUpperCase()} • {formatTime(sale.completedAt || sale.createdAt)}</p>
                        </div>
                        <div className="sd-location-badge">
                          <MapPin size={12} /> {sale.location || 'RR'}
                        </div>
                        <p className="sd-amount-text">रु {sale.total?.toFixed(0)}</p>
                      </div>

                      {selectedOrderId === sale.id && (
                        <div className="sd-details">
                          <div className="sd-bill-header">
                            <h3 className="sd-bill-title">Transaction Receipt</h3>
                            <div className="sd-info-grid">
                              <div className="sd-info-item">
                                <label>Account</label>
                                <span>{sale.userEmail || 'registered@user.mrr'}</span>
                              </div>
                              <div className="sd-info-item">
                                <label>Service Mode</label>
                                <span>{sale.location || 'Standard Pickup'}</span>
                              </div>
                              <div className="sd-info-item">
                                <label>Timestamp</label>
                                <span>{formatDateDisplay(sale.orderDate)} {formatTime(sale.completedAt || sale.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ marginBottom: '1.5rem' }}>
                            <label className="sd-items-list-header"><ReceiptText size={12} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Breakdown</label>
                            <table className="sd-table">
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th>Qty</th>
                                  <th style={{ textAlign: 'right' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sale.items?.map((item, index) => (
                                  <tr key={index}>
                                    <td>{item.name}</td>
                                    <td>{item.quantity || 1}</td>
                                    <td style={{ textAlign: 'right', fontWeight: '600' }}>रु {((item.price || 0) * (item.quantity || 1)).toFixed(0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {sale.note && (
                            <div className="od-note" style={{ background: 'rgba(255, 204, 0, 0.05)', padding: '12px', borderLeft: '3px solid #FFCC00', borderRadius: '4px', marginBottom: '20px' }}>
                              <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#8E6D00', display: 'block', marginBottom: '4px' }}>Customer Note</label>
                              <p style={{ fontSize: '13px', margin: 0 }}>{sale.note}</p>
                            </div>
                          )}

                          <div className="sd-bill-total">
                            <span className="sd-total-label">Final Remittance</span>
                            <span className="sd-total-amount">रु {sale.total?.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="od-pagination" style={{ margin: '24px 0' }}>
                      <Button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        variant="ghost"
                        size="sm"
                      >
                        <ChevronLeft size={16} /> Prev
                      </Button>
                      <span className="od-page-info">Page {currentPage} of {totalPages}</span>
                      <Button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        variant="ghost"
                        size="sm"
                      >
                        Next <ChevronRight size={16} />
                      </Button>
                    </div>
                  )}

                  <div className="sd-bill-total" style={{ borderStyle: 'dashed', borderColor: 'var(--color-border)' }}>
                    <span className="sd-total-label">Aggregate Collection ({filteredSalesData.length} records)</span>
                    <span className="sd-total-amount">रु {filteredSalesData.reduce((sum, s) => sum + (s.total || 0), 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2 className="od-section-title" style={{ marginBottom: '24px' }}>Historical Archive</h2>
              <div className="sd-list-grid">
                {salesHistory.map((day) => (
                  <div
                    key={day.date}
                    className="sd-card"
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <div className="sd-card-summary" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div>
                        <h3 className="sd-customer-name">{formatDateDisplay(day.date)}</h3>
                        <p className="sd-meta-text">{day.count} Operations Totaled</p>
                      </div>
                      <p className="sd-amount-text" style={{ color: 'var(--color-primary)' }}>रु {day.total.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default SalesDashboard;

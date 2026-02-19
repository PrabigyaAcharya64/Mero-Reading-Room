import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { LogOut } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useLoading } from '../../context/GlobalLoadingContext';
import MenuManagement from './MenuManagement';
import OrderDashboard from './OrderDashboard';
import SalesDashboard from './SalesDashboard';
import NewOrders from './NewOrders';
import ProxyOrder from './ProxyOrder';
import PageHeader from '../../components/PageHeader';
import InventoryLanding from '../inventory/InventoryLanding';
import RawInventory from '../inventory/RawInventory';
import DryInventory from '../inventory/DryInventory';
import '../../../styles/StandardLayout.css';

const foodIcon = new URL('../../assets/food.svg', import.meta.url).href;
const reportIcon = new URL('../../assets/reports.svg', import.meta.url).href;
const inventoryIcon = new URL('../../assets/inventory.svg', import.meta.url).href;
const orderIcon = new URL('../../assets/order.svg', import.meta.url).href;
const orderPlaceIcon = new URL('../../assets/order_place.svg', import.meta.url).href;

function CanteenAdminLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, signOutUser } = useAuth();
  const { setIsLoading } = useLoading();
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const previousOrderCount = useRef(0);
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const baseUrl = location.pathname.includes('/admin/canteen') ? '/admin/canteen' : '/canteen-admin';




  useEffect(() => {
    const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      setNewOrdersCount(count);

      if (count > previousOrderCount.current && previousOrderCount.current !== 0) {
        audioRef.current.play().catch(e => console.log('Audio error:', e));
      }
      previousOrderCount.current = count;
    });
    return () => unsubscribe();
  }, []);

  // Clear loading state when on landing page (not a child route)
  useEffect(() => {
    const isLandingPage = location.pathname === baseUrl || location.pathname === `${baseUrl}/`;
    if (isLandingPage) {
      setIsLoading(false);
    }
  }, [location.pathname, baseUrl, setIsLoading]);

  // Navigation handler that sets loading BEFORE navigating (prevents flash)
  const handleNavigation = (path) => {
    setIsLoading(true);
    navigate(path);
  };

  // Callback for child pages to signal data is loaded
  const handlePageReady = useCallback(() => {
    setIsLoading(false);
  }, [setIsLoading]);



  const LandingHome = () => (
    <div className="std-container">
      {/* Only show PageHeader for standalone canteen role, not when accessed from admin panel */}
      {userRole === 'canteen' && (
        <PageHeader
          title="Canteen Administration"
          rightElement={
            <button
              onClick={signOutUser}
              className="std-header-back-btn"
              style={{ color: '#ef4444', borderColor: '#ef4444' }}
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          }
        />
      )}

      <main className="std-body">
        <section className="landing-services">
          <div className="landing-services__grid">

            <button
              type="button"
              className="landing-service-card"
              onClick={() => handleNavigation('new-orders')}
              style={{ position: 'relative' }}
            >
              <span className="landing-service-card__icon">
                <img src={orderPlaceIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">New Orders</span>
              {newOrdersCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  backgroundColor: '#d93025',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}>
                  {newOrdersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              className="landing-service-card"
              onClick={() => handleNavigation('proxy-order')}
            >
              <span className="landing-service-card__icon">
                <img src={orderPlaceIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Proxy Order</span>
            </button>

            <button
              type="button"
              className="landing-service-card"
              onClick={() => handleNavigation('menu-management')}
            >
              <span className="landing-service-card__icon">
                <img src={foodIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Menu Management</span>
            </button>
            <button
              type="button"
              className="landing-service-card"
              onClick={() => handleNavigation('order-dashboard')}
            >
              <span className="landing-service-card__icon">
                <img src={orderIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Order History</span>
            </button>
            {(userRole === 'admin' || userRole === 'canteen') && (
              <button
                type="button"
                className="landing-service-card"
                onClick={() => handleNavigation('sales-dashboard')}
              >
                <span className="landing-service-card__icon">
                  <img src={reportIcon} alt="" aria-hidden="true" />
                </span>
                <span className="landing-service-card__label">Sales</span>
              </button>
            )}
            <button
              type="button"
              className="landing-service-card"
              onClick={() => handleNavigation('inventory')}
            >
              <span className="landing-service-card__icon">
                <img src={inventoryIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Inventory</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<LandingHome />} />
      <Route path="/menu-management" element={<MenuManagement onBack={() => navigate(baseUrl)} onDataLoaded={handlePageReady} />} />
      <Route path="/order-dashboard" element={<OrderDashboard onBack={() => navigate(baseUrl)} onDataLoaded={handlePageReady} />} />
      <Route path="/new-orders" element={<NewOrders onBack={() => navigate(baseUrl)} onDataLoaded={handlePageReady} />} />
      <Route path="/sales-dashboard" element={<SalesDashboard onBack={() => navigate(baseUrl)} onDataLoaded={handlePageReady} />} />
      <Route path="/proxy-order" element={<ProxyOrder onBack={() => navigate(baseUrl)} onDataLoaded={handlePageReady} />} />
      <Route path="/inventory" element={<InventoryLanding onBack={() => navigate(baseUrl)} onNavigate={(view) => handleNavigation(`${baseUrl}/${view}`)} onDataLoaded={handlePageReady} />} />
      <Route path="/raw-inventory" element={<RawInventory onBack={() => navigate(`${baseUrl}/inventory`)} onDataLoaded={handlePageReady} />} />
      <Route path="/dry-inventory" element={<DryInventory onBack={() => navigate(`${baseUrl}/inventory`)} onDataLoaded={handlePageReady} />} />
    </Routes>
  );
}

export default CanteenAdminLanding;
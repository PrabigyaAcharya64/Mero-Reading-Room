import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import MenuManagement from './MenuManagement';
import OrderDashboard from './OrderDashboard';
import SalesDashboard from './SalesDashboard';
import NewOrders from './NewOrders';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import InventoryLanding from '../inventory/InventoryLanding';
import RawInventory from '../inventory/RawInventory';
import DryInventory from '../inventory/DryInventory';

const foodIcon = new URL('../../assets/food.svg', import.meta.url).href;
const reportIcon = new URL('../../assets/reports.svg', import.meta.url).href;
const inventoryIcon = new URL('../../assets/inventory.svg', import.meta.url).href;
const orderIcon = new URL('../../assets/order.svg', import.meta.url).href;
const orderPlaceIcon = new URL('../../assets/order_place.svg', import.meta.url).href;

function CanteenAdminLanding({ onBack }) {
  const { user, userRole } = useAuth();
  const [currentView, setCurrentView] = useState('landing');
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const previousOrderCount = useRef(0);
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

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

  if (currentView === 'menu-management') {
    return <MenuManagement onBack={() => setCurrentView('landing')} />;
  }

  if (currentView === 'order-dashboard') {
    return <OrderDashboard onBack={() => setCurrentView('landing')} />;
  }

  if (currentView === 'new-orders') {
    return <NewOrders onBack={() => setCurrentView('landing')} />;
  }

  if (currentView === 'sales-dashboard') {
    return <SalesDashboard onBack={() => setCurrentView('landing')} />;
  }

  if (currentView === 'inventory') {
    return <InventoryLanding onBack={() => setCurrentView('landing')} onNavigate={(view) => setCurrentView(view)} />;
  }

  if (currentView === 'raw-inventory') {
    return <RawInventory onBack={() => setCurrentView('inventory')} />;
  }

  if (currentView === 'dry-inventory') {
    return <DryInventory onBack={() => setCurrentView('inventory')} />;
  }

  return (
    <div className="landing-screen">
      <PageHeader title="Canteen Administration" onBack={onBack} />

      <main className="landing-body">
        <section className="landing-services">
          <div className="landing-services__grid">

            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('new-orders')}
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
              onClick={() => setCurrentView('menu-management')}
            >
              <span className="landing-service-card__icon">
                <img src={foodIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Menu Management</span>
            </button>
            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('order-dashboard')}
            >
              <span className="landing-service-card__icon">
                <img src={orderIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Order History</span>
            </button>
            {userRole === 'admin' && (
              <button
                type="button"
                className="landing-service-card"
                onClick={() => setCurrentView('sales-dashboard')}
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
              onClick={() => setCurrentView('inventory')}
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
}

export default CanteenAdminLanding;
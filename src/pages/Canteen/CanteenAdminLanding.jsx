import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import MenuManagement from './MenuManagement';
import OrderDashboard from './OrderDashboard';
import SalesDashboard from './SalesDashboard';
import EnhancedBackButton from '../../components/EnhancedBackButton';

const foodIcon = new URL('../../assets/food.svg', import.meta.url).href;
const reportIcon = new URL('../../assets/reports.svg', import.meta.url).href;
const inventoryIcon = new URL('../../assets/inventory.svg', import.meta.url).href;
const orderIcon = new URL('../../assets/order.svg', import.meta.url).href;

function CanteenAdminLanding({ onBack }) {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState('landing');


  if (currentView === 'menu-management') {
    return <MenuManagement onBack={() => setCurrentView('landing')} />;
  }

  if (currentView === 'order-dashboard') {
    return <OrderDashboard onBack={() => setCurrentView('landing')} />;
  }

  if (currentView === 'sales-dashboard') {
    return <SalesDashboard onBack={() => setCurrentView('landing')} />;
  }

  return (
    <div className="landing-screen">
      {onBack && <EnhancedBackButton onBack={onBack} />}
      <header className="landing-header">
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        </div>
      </header>

      <main className="landing-body">
        <section className="landing-services">
          <h2>Canteen Administration</h2>
          <div className="landing-services__grid">
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
            <button 
              type="button" 
              className="landing-service-card" 
              onClick={() => alert('Inventory feature coming soon')}
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
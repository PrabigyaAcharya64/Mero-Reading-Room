import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import MenuManagement from './MenuManagement';
import OrderDashboard from './OrderDashboard';
import SalesDashboard from './SalesDashboard';
import EnhancedBackButton from '../../components/EnhancedBackButton';

const settingsIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDE1QzEzLjY1NjkgMTUgMTUgMTMuNjU2OSAxNSAxMkMxNSAxMC4zNDMxIDEzLjY1NjkgOSAxMiA5QzEwLjM0MzEgOSA5IDEwLjM0MzEgOSAxMkM5IDEzLjY1NjkgMTAuMzQzMSAxNSAxMiAxNVoiIHN0cm9rZT0iIzExMSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTE5LjQgMTVBMi41IDIuNSAwIDAgMCAyMC4wMiAxMmEyLjUgMi41IDAgMCAwLS42Mi0zTDIyIDdMMjAgNUwxNi4wNiA2QTIuNSAyLjUgMCAwIDAgMTIgNS4wMiAyLjUgMi41IDAgMCAwIDcuOTQgNkw0IDVMMiA3TDUuMzggOUEyLjUgMi41IDAgMCAwIDQuNzYgMTIgMi41IDIuNSAwIDAgMCA1LjM4IDE1TDIgMTdMNCAxOUw3Ljk0IDE4QTIuNSAyLjUgMCAwIDAgMTIgMTguOTggMi41IDIuNSAwIDAgMCAxNi4wNiAxOEwyMCAxOUwyMiAxN0wxOS40IDE1WiIgc3Ryb2tlPSIjMTExIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K';

const foodIcon = new URL('../../assets/food.svg', import.meta.url).href;
const reportIcon = new URL('../../assets/reports.svg', import.meta.url).href;
const inventoryIcon = new URL('../../assets/inventory.svg', import.meta.url).href;

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
      <header className="landing-header">
        {onBack && <EnhancedBackButton onBack={onBack} />}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <p style={{ fontWeight: 'bold', fontSize: '18px', fontFamily: 'var(--brand-font-serif)' }}>Canteen Admin</p>
        </div>
        <div style={{ flex: 1 }}></div>
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
                <img src={settingsIcon} alt="" aria-hidden="true" />
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
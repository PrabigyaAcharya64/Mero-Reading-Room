import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import MenuManagement from './MenuManagement';
import OrderDashboard from './OrderDashboard';
import SalesDashboard from './SalesDashboard';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';
const foodIcon = new URL('../assets/food.svg', import.meta.url).href;

function CanteenLanding({ onBack }) {
  const { user, signOutUser } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Canteen Staff';
  const [currentView, setCurrentView] = useState('dashboard');
  
  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (currentView === 'menu-management') {
    return <MenuManagement onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'orders') {
    return <OrderDashboard onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'sales') {
    return <SalesDashboard onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="landing-screen">
      <header className="landing-header">
        <p className="landing-greeting">
          {onBack && (
            <button 
              type="button" 
              onClick={onBack}
              style={{ 
                marginRight: '1rem', 
                padding: '0.5rem 1rem', 
                background: '#f0f0f0', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ← Back to Admin
            </button>
          )}
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

      <main className="landing-body">
        <section className="landing-services">
          <h2>Canteen Management</h2>
          <div className="landing-services__grid">
            <button type="button" className="landing-service-card" onClick={() => setCurrentView('menu-management')}>
              <span className="landing-service-card__icon">
                <img src={foodIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Menu Management</span>
            </button>
            <button type="button" className="landing-service-card" onClick={() => setCurrentView('orders')}>
              <span className="landing-service-card__label">Orders</span>
            </button>
            <button type="button" className="landing-service-card">
              <span className="landing-service-card__label">Inventory</span>
            </button>
            <button type="button" className="landing-service-card" onClick={() => setCurrentView('sales')}>
              <span className="landing-service-card__label">Sales Report</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default CanteenLanding;


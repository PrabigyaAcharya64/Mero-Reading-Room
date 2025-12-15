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
        {onBack && (
          <button
            type="button"
            onClick={onBack}
<<<<<<< HEAD
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              background: '#fff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              color: '#000',
              fontFamily: 'var(--brand-font-body)',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
              e.currentTarget.style.borderColor = '#d0d0d0';
              e.currentTarget.style.transform = 'translateX(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff';
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
=======
            className="landing-signout"
            style={{
              border: '1px solid var(--color-text-primary)',
              padding: '0.5rem 0.85rem'
            }}
          >
            ← Back
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
          </button>
        )}
        <p className="landing-greeting" style={{ flex: 1, textAlign: onBack ? 'center' : 'left' }}>
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


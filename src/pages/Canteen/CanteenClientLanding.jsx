import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import CanteenClient from './CanteenClient';
import ClientOrderHistory from './ClientOrderHistory';
import IDCard from '../IDCard';
import EnhancedBackButton from '../../components/EnhancedBackButton';

const profileIcon = new URL('../../assets/profile.svg', import.meta.url).href;
const foodIcon = new URL('../../assets/food.svg', import.meta.url).href;
const orderIcon = new URL('../../assets/order.svg', import.meta.url).href;

function CanteenClientLanding({ onBack }) {
  const { user, userBalance } = useAuth();
  const [currentView, setCurrentView] = useState('landing');


  if (currentView === 'idcard') {
    return <IDCard onBack={() => setCurrentView('landing')} />;
  }

  if (currentView === 'menu') {
    return <CanteenClient onBack={() => setCurrentView('landing')} />;
  }

  if (currentView === 'orders') {
    return <ClientOrderHistory onBack={() => setCurrentView('landing')} />;
  }

  return (
    <div className="landing-screen">
      <header className="landing-header">
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '12px' }}>
          {onBack && <EnhancedBackButton onBack={onBack} />}
          <div className="landing-balance" aria-label="Current balance">
            <div className="landing-balance__label">Balance</div>
            <div className="landing-balance__value">रु {(userBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <button type="button" className="landing-balance__add" aria-label="Add to balance">
              +
            </button>
          </div>
        </div>
        
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <p style={{ fontWeight: 'bold', fontSize: '18px', fontFamily: 'var(--brand-font-serif)' }}>Canteen</p>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="button" 
            className="landing-profile" 
            aria-label="Profile"
            onClick={() => setCurrentView('idcard')}
          >
            <img src={profileIcon} alt="" />
          </button>
        </div>
      </header>

      <main className="landing-body">

        <section className="landing-services">
          <h2 style={{ textAlign: 'center' }}>Canteen Services</h2>
          <div className="landing-services__grid">
            <button 
              type="button" 
              className="landing-service-card" 
              onClick={() => setCurrentView('menu')}
            >
              <span className="landing-service-card__icon">
                <img src={foodIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Menu</span>
            </button>
            <button 
              type="button" 
              className="landing-service-card" 
              onClick={() => setCurrentView('orders')}
            >
              <span className="landing-service-card__icon">
                <img src={orderIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">My Orders</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default CanteenClientLanding;
import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import CanteenClient from '../CanteenClient';
import ClientOrderHistory from './ClientOrderHistory';
import IDCard from '../IDCard';
import EnhancedBackButton from '../../components/EnhancedBackButton';

const profileIcon = new URL('../../assets/profile.svg', import.meta.url).href;
const foodIcon = new URL('../assets/food.svg', import.meta.url).href;
const orderIcon = new URL('../assets/order.svg', import.meta.url).href;

function CanteenClientLanding({ onBack }) {
  const { user, signOutUser, userBalance } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Reader';
  const [currentView, setCurrentView] = useState('landing');

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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
        <p className="landing-greeting" style={{ flex: 1, textAlign: 'center' }}>
          Hey <span>{displayName}</span>!
        </p>
        <div className="landing-status">
          <div className="landing-balance" aria-label="Current balance">
            <div className="landing-balance__label">Balance</div>
            <div className="landing-balance__value">रु {userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <button type="button" className="landing-balance__add" aria-label="Add to balance">
              +
            </button>
          </div>
          <button 
            type="button" 
            className="landing-profile" 
            aria-label="Profile"
            onClick={() => setCurrentView('idcard')}
          >
            <img src={profileIcon} alt="" />
          </button>
          <button type="button" className="landing-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="landing-body">
        {onBack && (
          <div style={{ marginBottom: '20px' }}>
            <EnhancedBackButton onBack={onBack} />
          </div>
        )}

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
import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import CanteenClient from './CanteenClient';
import ClientOrderHistory from './ClientOrderHistory';
import IDCard from '../IDCard';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import '../../styles/StandardLayout.css';

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
    <div className="std-container">
      <PageHeader title="Canteen" onBack={onBack} rightElement={
        <button
          type="button"
          className="landing-profile"
          aria-label="Profile"
          onClick={() => setCurrentView('idcard')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <img src={profileIcon} alt="" style={{ width: '24px', height: '24px' }} />
        </button>
      } />

      <main className="std-body">

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
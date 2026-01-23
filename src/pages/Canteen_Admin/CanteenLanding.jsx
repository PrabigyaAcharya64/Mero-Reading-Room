import React from 'react';
import PageHeader from '../../components/PageHeader';
import '../../styles/CanteenLanding.css';
import '../../styles/StandardLayout.css';

const foodIcon = new URL('../../assets/food.svg', import.meta.url).href;
const orderIcon = new URL('../../assets/order.svg', import.meta.url).href;

const CanteenLanding = ({ onBack, onNavigate, userBalance }) => {

  return (
    <div className="std-container">
      <PageHeader title="Canteen" onBack={onBack} rightElement={
        <div className="landing-balance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#888', letterSpacing: '0.5px' }}>Balance</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            Rs. {(userBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      } />

      <main className="std-body">
        <div className="canteen-buttons-wrapper">
          <button
            className="canteen-main-button"
            onClick={() => onNavigate('menu')}
          >
            <div className="button-icon-wrapper">
              <img src={foodIcon} alt="Menu" style={{ width: 48, height: 48, objectFit: 'contain' }} />
            </div>
            <span className="button-text">Menu</span>
          </button>

          <button
            className="canteen-main-button"
            onClick={() => onNavigate('orders')}
          >
            <div className="button-icon-wrapper">
              <img src={orderIcon} alt="Orders" style={{ width: 48, height: 48, objectFit: 'contain' }} />
            </div>
            <span className="button-text">Orders</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default CanteenLanding;
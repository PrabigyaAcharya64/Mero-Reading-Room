import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import CanteenClient from './CanteenClient';
import ClientOrderHistory from './ClientOrderHistory';
import IDCard from '../IDCard';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';
const foodIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMTExIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMyAydjdjMCAxLjEuOSAyIDIgMmg0YTIgMiAwIDAgMCAyLTJWMiIgLz4KICA8cGF0aCBkPSJNNyAydjIwIiAvPgogIDxwYXRoIGQ9Ik0yMSAxNVYydjBhNSA1IDAgMCAwLTUgNXY2YzAgMS4xLjkgMiAyIDJoM1ptMCAwdjciIC8+Cjwvc3ZnPgo=';

const ordersIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEwIDZIMjJDMjMuMTA0NiA2IDI0IDYuODk1NDMgMjQgOFYyNkMyNCAyNy4xMDQ2IDIzLjEwNDYgMjggMjIgMjhIMTBDOC44OTU0MyAyOCA4IDI3LjEwNDYgOCAyNlY4QzggNi44OTU0MyA4Ljg5NTQzIDYgMTAgNloiIHN0cm9rZT0iIzExMSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik0xMiAxMkgxOCIgc3Ryb2tlPSIjMTExIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTEyIDE4SDE4IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMTIgMjRIMTgiIHN0cm9rZT0iIzExMSIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPgo=';

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
        {/* Left: Back Button */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            {onBack && (
                <button
                    onClick={onBack}
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
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
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
                </button>
            )}
        </div>

        {/* Center: Greeting */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <p className="landing-greeting" style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Hey <span>{displayName}</span>!
            </p>
        </div>

        {/* Right: Status */}
        <div className="landing-status" style={{ flex: 1, justifyContent: 'flex-end' }}>
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
        <section className="landing-services">
          <h2>Canteen Services</h2>
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
                <img src={ordersIcon} alt="" aria-hidden="true" />
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


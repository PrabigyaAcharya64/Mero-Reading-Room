import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import NewUsers from './NewUsers';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

function AdminLanding() {
  const { user, signOutUser } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
  const [currentView, setCurrentView] = useState('dashboard');
  
  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (currentView === 'new-users') {
    return <NewUsers onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="landing-screen">
      <header className="landing-header">
        <p className="landing-greeting">
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
          <h2>Admin Panel</h2>
          <div className="landing-services__grid">
            <button type="button" className="landing-service-card">
              <span className="landing-service-card__label">User Management</span>
            </button>
            <button 
              type="button" 
              className="landing-service-card"
              onClick={() => setCurrentView('new-users')}
            >
              <span className="landing-service-card__label">New Users</span>
            </button>
            <button type="button" className="landing-service-card">
              <span className="landing-service-card__label">Reports</span>
            </button>
            <button type="button" className="landing-service-card">
              <span className="landing-service-card__label">Analytics</span>
            </button>
          </div>
        </section>

        <section className="landing-announcements">
          <h2>Admin Announcements</h2>
          <div className="landing-announcements__empty">
            No announcements at this time.
          </div>
        </section>
      </main>
    </div>
  );
}

export default AdminLanding;


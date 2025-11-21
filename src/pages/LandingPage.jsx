import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import CanteenClientLanding from './Canteen/CanteenClientLanding';
import IDCard from './IDCard';
import Contact from './Contact';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';
const readingRoomIcon = new URL('../assets/readingroom.svg', import.meta.url).href;
const hostelIcon = new URL('../assets/hostel.svg', import.meta.url).href;
const foodIcon = new URL('../assets/food.svg', import.meta.url).href;
const contactIcon = new URL('../assets/contact.svg', import.meta.url).href;

function LandingPage() {
  const { user, signOutUser, userBalance } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Reader';
  const [currentView, setCurrentView] = useState('landing');
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'announcements'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'asc') // Needed for compound query with range filter
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by createdAt desc in memory since we can't easily do it in query with expiresAt range
      msgs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setAnnouncements(msgs);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Show ID Card when profile is clicked
  if (currentView === 'idcard') {
    return <IDCard onBack={() => setCurrentView('landing')} />;
  }

  // Show CanteenClientLanding when canteen is clicked
  if (currentView === 'canteen') {
    return <CanteenClientLanding onBack={() => setCurrentView('landing')} />;
  }

  // Show Contact page when contact is clicked
  if (currentView === 'contact') {
    return <Contact onBack={() => setCurrentView('landing')} />;
  }

  return (
    <div className="landing-screen">
      <header className="landing-header">
        <p className="landing-greeting">
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
        <section className="landing-services">
          <h2>Quick Services</h2>
          <div className="landing-services__grid">
            <button type="button" className="landing-service-card">
              <span className="landing-service-card__icon">
                <img src={readingRoomIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Reading Room</span>
            </button>
            <button type="button" className="landing-service-card">
              <span className="landing-service-card__icon">
                <img src={hostelIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Hostel</span>
            </button>
            <button type="button" className="landing-service-card" onClick={() => setCurrentView('canteen')}>
              <span className="landing-service-card__icon">
                <img src={foodIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Canteen</span>
            </button>
            <button type="button" className="landing-service-card" onClick={() => setCurrentView('contact')}>
              <span className="landing-service-card__icon">
                <img src={contactIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Contact</span>
            </button>
          </div>
        </section>

        <section className="landing-announcements">
          <h2>Notices</h2>
          {announcements.length === 0 ? (
            <div className="landing-announcements__empty">
              No notices at this time.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {announcements.map(announcement => (
                <div
                  key={announcement.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--color-border)',
                    backgroundColor: '#fff',
                    textAlign: 'left'
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {announcement.text}
                  </p>
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    color: 'var(--color-text-secondary)'
                  }}>
                    Posted: {announcement.createdAt?.toDate().toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default LandingPage;


import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import UserManagement from './UserManagement';
import HostelManagement from './HostelManagement';
import NewUsers from './NewUsers';
import CanteenAdminLanding from '../Canteen_Admin/CanteenAdminLanding';
import NewOrders from '../Canteen_Admin/NewOrders';
import AdminMessages from './AdminMessages';
import CreateAnnouncement from './CreateAnnouncement';
import ReadingRoomManagement from '../readingroom/ReadingRoomManagement';
import IDCard from '../IDCard';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const profileIcon = new URL('../../assets/profile.svg', import.meta.url).href;
const contactIcon = new URL('../../assets/contact.svg', import.meta.url).href;
const userManagementIcon = new URL('../../assets/usermanagement.svg', import.meta.url).href;
const hostelIcon = new URL('../../assets/hostel.svg', import.meta.url).href;
const reportsIcon = new URL('../../assets/reports.svg', import.meta.url).href;
const canteenIcon = new URL('../../assets/canteen.svg', import.meta.url).href;
const readingRoomIcon = new URL('../../assets/readingroom.svg', import.meta.url).href;
const orderPlaceIcon = new URL('../../assets/order_place.svg', import.meta.url).href;

function AdminLanding() {
  const { user, signOutUser } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
  const [currentView, setCurrentView] = useState('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Filter announcements
  const displayedAnnouncements = announcements.filter(a => {
    const expiresAt = a.expiresAt?.toDate ? a.expiresAt.toDate() : new Date(a.expiresAt);
    const now = new Date();
    // Reset time part for comparison if needed or just compare timestamps
    const isExpired = expiresAt < now;
    return showHistory ? isExpired : !isExpired;
  });

  useEffect(() => {
    const q = query(collection(db, 'messages'), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

  const previousOrderCount = useRef(0);
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  useEffect(() => {
    // Listen for all 'pending' orders count
    const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      setNewOrdersCount(count);

      // Play sound if new order comes (count increases)
      // Check if count > previous to avoid playing on initial load if desired, 
      // or just play. Usually we don't play on initial load.
      if (count > previousOrderCount.current && previousOrderCount.current !== 0) {
        audioRef.current.play().catch(e => console.log('Audio error:', e));
      }

      // If it's the very first load (0 -> N), we might optionally play or not.
      // Let's play if > 0 and it's not strictly just init (checking against current 0 implies init if starting at 0).
      // But standard interaction policy blocks auto-play sometimes. 
      // Safe bet: count > previous.

      previousOrderCount.current = count;
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAnnouncements(msgs);
    });
    return () => unsubscribe();
  }, []);

  const fetchUserData = async () => {
    // ... logic if needed, but fetchUserRole is in Provider
  };

  const handleDeleteAnnouncement = async (id) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteDoc(doc(db, 'announcements', id));
      } catch (error) {
        console.error('Error deleting announcement:', error);
      }
    }
  };

  if (currentView === 'user-management') {
    return <UserManagement onBack={() => setCurrentView('dashboard')} onNavigate={setCurrentView} />;
  }

  if (currentView === 'hostel') {
    return <HostelManagement onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'new-users') {
    return <NewUsers onBack={() => setCurrentView('user-management')} />;
  }

  if (currentView === 'canteen') {
    return <CanteenAdminLanding onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'new-orders') {
    return <NewOrders onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'messages') {
    return <AdminMessages onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'create-announcement') {
    return <CreateAnnouncement onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'reading-rooms') {
    return <ReadingRoomManagement onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'idcard') {
    return <IDCard onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="landing-screen">
      <header className="landing-header">
        <p className="landing-greeting">
          Hey <span>{displayName}</span>!
        </p>
        <div className="landing-status">
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
          <h2>Admin Panel</h2>
          <div className="landing-services__grid">
            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('user-management')}
            >
              <span className="landing-service-card__icon">
                <img src={userManagementIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">User Management</span>
            </button>
            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('hostel')}
            >
              <span className="landing-service-card__icon">
                <img src={hostelIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Hostel</span>
            </button>
            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('canteen')}
            >
              <span className="landing-service-card__icon">
                <img src={canteenIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Canteen</span>
            </button>

            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('new-orders')}
              style={{ position: 'relative' }}
            >
              <span className="landing-service-card__icon">
                <img src={orderPlaceIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">New Orders</span>
              {newOrdersCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  backgroundColor: '#d93025',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}>
                  {newOrdersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('reading-rooms')}
            >
              <span className="landing-service-card__icon">
                <img src={readingRoomIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Reading Rooms</span>
            </button>
            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('messages')}
              style={{ position: 'relative' }}
            >
              <span className="landing-service-card__icon">
                <img src={contactIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Messages</span>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  backgroundColor: '#d93025',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button type="button" className="landing-service-card">
              <span className="landing-service-card__icon">
                <img src={reportsIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Reports</span>
            </button>
          </div>
        </section>

        <section className="landing-announcements">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0 }}>{showHistory ? 'Announcement History' : 'Active Announcements'}</h2>
              <button
                onClick={() => setShowHistory(!showHistory)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: showHistory ? 'var(--color-primary)' : 'var(--color-text-secondary)'
                }}
                title={showHistory ? "Show Active" : "Show History"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                  <line x1="2" y1="8" x2="22" y2="8" />
                  <line x1="2" y1="2" x2="22" y2="2" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => setCurrentView('create-announcement')}
              style={{
                background: 'none',
                border: '1px solid var(--color-text-primary)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: 'var(--color-text-primary)'
              }}
              aria-label="Create Announcement"
            >
              +
            </button>
          </div>
          {displayedAnnouncements.length === 0 ? (
            <div className="landing-announcements__empty">
              {showHistory ? 'No expired announcements found.' : 'No active announcements at this time.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {displayedAnnouncements.map(announcement => (
                <div
                  key={announcement.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--color-border)',
                    backgroundColor: showHistory ? '#f5f5f5' : '#fff',
                    textAlign: 'left',
                    position: 'relative',
                    opacity: showHistory ? 0.8 : 1
                  }}
                >
                  <button
                    onClick={() => handleDeleteAnnouncement(announcement.id)}
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      background: 'none',
                      border: 'none',
                      color: '#d93025',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      padding: '0.25rem'
                    }}
                    aria-label="Delete announcement"
                  >
                    ×
                  </button>
                  <p style={{ margin: '0 0 0.5rem 0', whiteSpace: 'pre-wrap', lineHeight: '1.5', paddingRight: '1.5rem' }}>
                    {announcement.text}
                  </p>
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>Posted: {announcement.createdAt?.toDate().toLocaleDateString()}</span>
                    <span>Expires: {announcement.expiresAt?.toDate().toLocaleDateString()}</span>
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

export default AdminLanding;
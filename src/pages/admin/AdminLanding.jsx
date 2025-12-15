import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import NewUsers from './NewUsers';
import CanteenLanding from '../Canteen/CanteenLanding';
import AdminMessages from './AdminMessages';
import CreateAnnouncement from './CreateAnnouncement';
import ReadingRoomManagement from './ReadingRoomManagement';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';
const foodIcon = new URL('../assets/food.svg', import.meta.url).href;
const contactIcon = new URL('../../assets/contact.svg', import.meta.url).href;
const userManagementIcon = new URL('../../assets/usermanagement.svg', import.meta.url).href;
const newUserIcon = new URL('../../assets/newuser.svg', import.meta.url).href;
const reportsIcon = new URL('../../assets/reports.svg', import.meta.url).href;
const canteenIcon = new URL('../../assets/canteen.svg', import.meta.url).href;
const readingRoomIcon = new URL('../../assets/readingroom.svg', import.meta.url).href;

function AdminLanding() {
  const { user, signOutUser } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
  const [currentView, setCurrentView] = useState('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'messages'), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
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

  const handleDeleteAnnouncement = async (id) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteDoc(doc(db, 'announcements', id));
      } catch (error) {
        console.error('Error deleting announcement:', error);
      }
    }
  };

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

  if (currentView === 'canteen') {
    return <CanteenLanding onBack={() => setCurrentView('dashboard')} />;
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
              <span className="landing-service-card__icon">
                <img src={userManagementIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">User Management</span>
            </button>
            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('new-users')}
            >
              <span className="landing-service-card__icon">
                <img src={newUserIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">New Users</span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Admin Announcements</h2>
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
          {announcements.length === 0 ? (
            <div className="landing-announcements__empty">
              No announcements at this time.
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
                    textAlign: 'left',
                    position: 'relative'
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


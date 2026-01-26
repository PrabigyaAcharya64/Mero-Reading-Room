import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import UserManagement from './UserManagement';
import HostelManagement from './HostelManagement';
import NewUsers from './NewUsers';
import AllMembersView from './AllMembersView';
import CanteenAdminLanding from '../Canteen_Admin/CanteenAdminLanding';
import AdminMessages from './AdminMessages';
import CreateAnnouncement from './CreateAnnouncement';
import ReadingRoomManagement from '../readingroom/ReadingRoomManagement';
import AdminBalanceLoad from './AdminBalanceLoad';
import Sidebar from '../../components/Sidebar';
import Dashboard from './Dashboard';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import '../../styles/StandardLayout.css';

function AdminLanding({ onNavigateRoot }) {
  const { user, signOutUser } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');

  const [unreadCount, setUnreadCount] = useState(0);
  // ... (keep other states)

  // Navigate and manage sidebar state
  const handleNavigate = (view, data = null) => {
    setCurrentView(view);
    // Navigation doesn't need to force close anymore since it auto-collapses on mouse leave
  };
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Filter announcements
  const displayedAnnouncements = announcements.filter(a => {
    const expiresAt = a.expiresAt?.toDate ? a.expiresAt.toDate() : new Date(a.expiresAt);
    const now = new Date();
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
    const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      setNewOrdersCount(count);
      if (count > previousOrderCount.current && previousOrderCount.current !== 0) {
        audioRef.current.play().catch(e => console.log('Audio error:', e));
      }
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

  const handleDeleteAnnouncement = async (id) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteDoc(doc(db, 'announcements', id));
      } catch (error) {
        console.error('Error deleting announcement:', error);
      }
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'user-management':
        return <UserManagement onNavigate={handleNavigate} />;
      case 'hostel':
        return <HostelManagement />;
      case 'new-users':
        return <NewUsers onBack={() => handleNavigate('user-management')} />;
      case 'all-members':
        return <AllMembersView onBack={() => handleNavigate('user-management')} />;
      case 'canteen':
        return <CanteenAdminLanding />;
      case 'messages':
        return <AdminMessages />;
      case 'create-announcement':
        return <CreateAnnouncement />;
      case 'reading-rooms':
        return <ReadingRoomManagement />;
      case 'balance-requests':
        return <AdminBalanceLoad />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb', position: 'relative' }}>

      {/* Sidebar Wrapper for Hover Detection */}
      <div
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        style={{
          zIndex: 1000,
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          width: isSidebarHovered ? '260px' : '72px', // Match Sidebar transition
          transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          isOpen={isSidebarHovered}
        />
      </div>

      <main style={{
        marginLeft: '72px', // Fixed marginLeft to mini-sidebar width
        flex: 1,
        width: 'calc(100% - 72px)',
        overflowX: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative'
      }}>
        {renderContent()}
      </main>
    </div>
  );
}

export default AdminLanding;
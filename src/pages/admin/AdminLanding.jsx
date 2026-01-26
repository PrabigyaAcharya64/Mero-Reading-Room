import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { Menu, X } from 'lucide-react';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open for dashboard
  const [currentView, setCurrentView] = useState('dashboard');

  const [unreadCount, setUnreadCount] = useState(0);
  // ... (keep other states)

  // Navigate and manage sidebar state
  const handleNavigate = (view, data = null) => {
    setCurrentView(view);

    // Keep sidebar open on dashboard, close on other pages
    if (view === 'dashboard') {
      setIsSidebarOpen(true);
    } else {
      setIsSidebarOpen(false);
    }
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
        return <Dashboard onNavigate={handleNavigate} isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />;
      case 'user-management':
        return <UserManagement onNavigate={handleNavigate} isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />;
      case 'hostel':
        return <HostelManagement isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />;
      case 'new-users':
        return <NewUsers onBack={() => handleNavigate('user-management')} />;
      case 'all-members':
        return <AllMembersView onBack={() => handleNavigate('user-management')} isSidebarOpen={isSidebarOpen} />;
      case 'canteen':
        return <CanteenAdminLanding isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />;
      case 'messages':
        return <AdminMessages isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />;
      case 'create-announcement':
        return <CreateAnnouncement isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />;
      case 'reading-rooms':
        return <ReadingRoomManagement isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />;
      case 'balance-requests':
        return <AdminBalanceLoad isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />;
      default:
        return <Dashboard onNavigate={handleNavigate} isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb', position: 'relative' }}>

      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main style={{
        marginLeft: isSidebarOpen ? '260px' : '0',
        flex: 1,
        width: isSidebarOpen ? 'calc(100% - 260px)' : '100%',
        overflowX: 'hidden',
        transition: 'margin-left 0.4s cubic-bezier(0.16, 1, 0.3, 1), width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative'
      }}>
        {renderContent()}
      </main>
    </div>
  );
}

export default AdminLanding;
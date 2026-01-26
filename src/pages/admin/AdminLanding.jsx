import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);


  const [unreadCount, setUnreadCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Navigate using React Router
  const handleNavigate = (view, data = null) => {
    navigate(`/admin/${view}`);
  };

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


  // Get current route to determine active sidebar item
  const getCurrentView = () => {
    const path = window.location.pathname;
    if (path === '/admin' || path === '/admin/dashboard') return 'dashboard';
    if (path.includes('/admin/user-management')) return 'user-management';
    if (path.includes('/admin/hostel')) return 'hostel';
    if (path.includes('/admin/canteen')) return 'canteen';
    if (path.includes('/admin/messages')) return 'messages';
    if (path.includes('/admin/create-announcement')) return 'create-announcement';
    if (path.includes('/admin/reading-rooms')) return 'reading-rooms';
    if (path.includes('/admin/balance-requests')) return 'balance-requests';
    return 'dashboard';
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
          currentView={getCurrentView()}
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
        <Routes>
          <Route path="/" element={<Dashboard onNavigate={handleNavigate} />} />
          <Route path="/dashboard" element={<Dashboard onNavigate={handleNavigate} />} />
          <Route path="/user-management" element={<UserManagement onNavigate={handleNavigate} />} />
          <Route path="/hostel" element={<HostelManagement />} />
          <Route path="/new-users" element={<NewUsers onBack={() => navigate('/admin/user-management')} />} />
          <Route path="/all-members" element={<AllMembersView onBack={() => navigate('/admin/user-management')} />} />
          <Route path="/canteen" element={<CanteenAdminLanding />} />
          <Route path="/messages" element={<AdminMessages />} />
          <Route path="/create-announcement" element={<CreateAnnouncement />} />
          <Route path="/reading-rooms" element={<ReadingRoomManagement />} />
          <Route path="/balance-requests" element={<AdminBalanceLoad />} />
        </Routes>
      </main>
    </div>
  );
}

export default AdminLanding;
import { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
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

function AdminLanding() {
  const { user, signOutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Navigate using React Router
  const handleNavigate = (view) => {
    navigate(view === 'dashboard' ? '/admin' : `/admin/${view}`);
  };

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

  // Determine active sidebar item from location
  const currentView = useMemo(() => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/dashboard') return 'dashboard';
    if (path.includes('/admin/user-management')) return 'user-management';
    if (path.includes('/admin/hostel')) return 'hostel';
    if (path.includes('/admin/canteen')) return 'canteen';
    if (path.includes('/admin/messages')) return 'messages';
    if (path.includes('/admin/create-announcement')) return 'create-announcement';
    if (path.includes('/admin/reading-rooms')) return 'reading-rooms';
    if (path.includes('/admin/balance-requests')) return 'balance-requests';
    return 'dashboard';
  }, [location.pathname]);

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
          width: isSidebarHovered ? '260px' : '72px',
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
        marginLeft: '72px',
        flex: 1,
        width: 'calc(100% - 72px)',
        overflowX: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative'
      }}>
        <Routes>
          <Route path="/" element={<Dashboard onNavigate={handleNavigate} />} />
          <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="/user-management" element={<UserManagement onNavigate={handleNavigate} />} />
          <Route path="/hostel" element={<HostelManagement />} />
          <Route path="/new-users" element={<NewUsers onBack={() => navigate('/admin/user-management')} />} />
          <Route path="/all-members" element={<AllMembersView onBack={() => navigate('/admin/user-management')} />} />
          <Route path="/canteen/*" element={<CanteenAdminLanding />} />
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
<<<<<<< Updated upstream
import { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
=======
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
>>>>>>> Stashed changes
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
import AdminTransactionStatement from './AdminTransactionStatement';
import Sidebar from '../../components/Sidebar';
import Dashboard from './Dashboard';
import { useLoading } from '../../context/GlobalLoadingContext';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
<<<<<<< Updated upstream

function AdminLanding() {
  const { user, signOutUser } = useAuth();
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
=======
import '../../styles/StandardLayout.css';
import '../../styles/AdminSidebar.css';

function AdminLanding({ onNavigateRoot }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
>>>>>>> Stashed changes
  const [unreadCount, setUnreadCount] = useState(0);

<<<<<<< Updated upstream
  // Navigate using React Router with loading state
  const handleNavigate = (view) => {
    setIsLoading(true);
    navigate(view === 'dashboard' ? '/admin' : `/admin/${view}`);
  };

  const handlePageReady = () => {
    setIsLoading(false);
  };
=======
  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(false); // Reset mobile drawer on resize to desktop
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on navigation (for all screens to keep it "clean")
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);
>>>>>>> Stashed changes

  useEffect(() => {
    const q = query(collection(db, 'messages'), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

<<<<<<< Updated upstream
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
=======
  // Navigate using React Router
  const handleNavigate = (view) => {
    navigate(`/admin/${view}`);
  };

  const getCurrentView = () => {
>>>>>>> Stashed changes
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/dashboard') return 'dashboard';
    if (path.includes('/admin/user-management')) return 'user-management';
    if (path.includes('/admin/hostel')) return 'hostel';
    if (path.includes('/admin/canteen')) return 'canteen';
    if (path.includes('/admin/messages')) return 'messages';
    if (path.includes('/admin/create-announcement')) return 'create-announcement';
    if (path.includes('/admin/reading-rooms')) return 'reading-rooms';
    if (path.includes('/admin/balance-requests')) return 'balance-requests';
    if (path.includes('/admin/transaction-statement')) return 'transaction-statement';
    return 'dashboard';
  }, [location.pathname]);


  const getPageTitle = () => {
    const view = getCurrentView();
    const titles = {
      'dashboard': 'Dashboard Overview',
      'user-management': 'User Management',
      'hostel': 'Hostel Management',
      'canteen': 'Canteen Admin',
      'messages': 'Admin Messages',
      'create-announcement': 'Announcements',
      'reading-rooms': 'Reading Room',
      'balance-requests': 'Balance Requests'
    };
    return titles[view] || 'Admin Panel';
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="admin-layout">
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen && isMobile ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

<<<<<<< Updated upstream
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
          <Route path="/" element={<Dashboard onNavigate={handleNavigate} onDataLoaded={handlePageReady} />} />
          <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="/user-management" element={<UserManagement onNavigate={handleNavigate} onDataLoaded={handlePageReady} />} />
          <Route path="/hostel" element={<HostelManagement onBack={() => handleNavigate('dashboard')} onDataLoaded={handlePageReady} />} />
          <Route path="/new-users" element={<NewUsers onBack={() => handleNavigate('user-management')} onDataLoaded={handlePageReady} />} />
          <Route path="/all-members" element={<AllMembersView onBack={() => handleNavigate('user-management')} onDataLoaded={handlePageReady} />} />
          <Route path="/canteen/*" element={<CanteenAdminLanding onDataLoaded={handlePageReady} />} />
          <Route path="/messages" element={<AdminMessages onDataLoaded={handlePageReady} />} />
          <Route path="/create-announcement" element={<CreateAnnouncement onDataLoaded={handlePageReady} />} />
          <Route path="/reading-rooms" element={<ReadingRoomManagement onDataLoaded={handlePageReady} />} />
          <Route path="/balance-requests" element={<AdminBalanceLoad onDataLoaded={handlePageReady} />} />
          <Route path="/transaction-statement" element={<AdminTransactionStatement onDataLoaded={handlePageReady} />} />
        </Routes>
      </main>
=======
      <Sidebar
        currentView={getCurrentView()}
        onNavigate={handleNavigate}
        isOpen={isSidebarOpen}
        isMobile={isMobile}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className={`admin-main-content ${isSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
        <header className="admin-header">
          <button className="sidebar-toggle-btn" onClick={toggleSidebar} aria-label="Toggle Sidebar">
            {isSidebarOpen && isMobile ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="admin-header-title">{getPageTitle()}</h1>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
              Welcome, {displayName}
            </span>
          </div>
        </header>

        <main style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
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
>>>>>>> Stashed changes
    </div>
  );
}

export default AdminLanding;

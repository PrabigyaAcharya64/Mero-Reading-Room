import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
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
import AccountDashboard from './AccountDashboard';
import Sidebar from '../../components/Sidebar';
import Dashboard from './Dashboard';
import { useLoading } from '../../context/GlobalLoadingContext';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import '../../styles/StandardLayout.css';
import '../../styles/AdminSidebar.css';

function AdminLanding() {
  const { user } = useAuth();
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();
  const location = useLocation();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on navigation for mobile
  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
  }, [location.pathname, isMobile]);

  // Navigate using React Router with loading state
  const handleNavigate = (view) => {
    if (view === '__hover_expand') {
      setIsSidebarHovered(true);
      return;
    }
    if (view === '__hover_collapse') {
      setIsSidebarHovered(false);
      return;
    }
    setIsLoading(true);
    navigate(view === 'dashboard' ? '/admin' : `/admin/${view}`);
  };

  const handlePageReady = useCallback(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  // Queries for unread messages and new orders
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
    if (path.includes('/admin/transaction-statement')) return 'transaction-statement';
    if (path.includes('/admin/account-dashboard')) return 'account-dashboard';
    return 'dashboard';
  }, [location.pathname]);

  const getPageTitle = () => {
    const titles = {
      'dashboard': 'Dashboard Overview',
      'user-management': 'User Management',
      'hostel': 'Hostel Management',
      'canteen': 'Canteen Admin',
      'messages': 'Admin Messages',
      'create-announcement': 'Announcements',
      'reading-rooms': 'Reading Room',
      'balance-requests': 'Balance Requests',
      'transaction-statement': 'Transaction Statement',
      'account-dashboard': 'Account'
    };
    return titles[currentView] || 'Admin Panel';
  };

  const isExpanded = isMobile ? isSidebarOpen : isSidebarHovered;

  return (
    <div className="admin-layout">
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        isOpen={isExpanded}
        isMobile={isMobile}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`admin-main-content ${!isMobile && isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
        onMouseEnter={() => !isMobile && setIsSidebarHovered(false)} // Close if mouse enters content
      >
        <header className="admin-header">
          {isMobile && (
            <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle Sidebar">
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
          <h1 className="admin-header-title" style={{ textAlign: 'center', flex: 1 }}>{getPageTitle()}</h1>
        </header>

        <main style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', width: '100%', flex: 1 }}>
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
            <Route path="/account-dashboard" element={<AccountDashboard onDataLoaded={handlePageReady} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default AdminLanding;

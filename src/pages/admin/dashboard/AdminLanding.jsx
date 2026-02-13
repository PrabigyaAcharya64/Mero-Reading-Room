import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Menu, X, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../../auth/AuthProvider';
import UserManagementModule from '../users/UserManagementModule';
import HostelManagement from '../hostel/HostelManagement';
import CanteenAdminLanding from '../../Canteen_Admin/CanteenAdminLanding';
import AdminMessages from './AdminMessages';
import CreateAnnouncement from './CreateAnnouncement';
import ReadingRoomManagement from '../reading_room/ReadingRoomManagement';
import AdminBalanceLoad from '../finance/AdminBalanceLoad';
import AdminTransactionStatement from '../finance/AdminTransactionStatement';
import AccountDashboard from '../finance/AccountDashboard';
import RefundRequests from '../finance/RefundRequests';
import ExpenseEarningManagement from '../finance/ExpenseEarningManagement';
import Sidebar from '../../../components/Sidebar';
import Dashboard from './Dashboard';
import ReadingRoomDashboard from '../reading_room/ReadingRoomDashboard';
import HostelDashboard from '../hostel/HostelDashboard';
import CanteenDashboard from '../canteen/CanteenDashboard';
import UserManagementDashboard from '../users/UserManagementDashboard';
import Settings from '../settings/Settings';
import DiscountManagement from '../finance/DiscountManagement';
import { useLoading } from '../../../context/GlobalLoadingContext';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import '../../../styles/StandardLayout.css';
import '../../../styles/AdminSidebar.css';
import { AdminHeaderProvider, useAdminHeader } from '../../../context/AdminHeaderContext';

function AdminLandingContent() {
  const { user } = useAuth();
  const { setIsLoading } = useLoading();
  const navigate = useNavigate();
  const location = useLocation();
  const { headerProps, resetHeader } = useAdminHeader();

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
  const handleNavigate = useCallback((view) => {
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
  }, [navigate, setIsLoading]);

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

  // Reset header when view changes
  // useEffect(() => {
  //   resetHeader();
  // }, [location.pathname, resetHeader]);

  // Determine active sidebar item from location
  const currentView = useMemo(() => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/dashboard') return 'dashboard';
    if (path.includes('/admin/user-management')) return 'user-management';
    if (path.includes('/admin/reading-rooms')) return 'reading-rooms';
    if (path.includes('/admin/hostel')) return 'hostel';
    if (path.includes('/admin/canteen')) return 'canteen';
    if (path.includes('/admin/messages')) return 'messages';
    if (path.includes('/admin/create-announcement')) return 'create-announcement';
    if (path.includes('/admin/balance-requests')) return 'balance-requests';
    if (path.includes('/admin/refund-requests')) return 'refund-requests';
    if (path.includes('/admin/transaction-statement')) return 'transaction-statement';
    if (path.includes('/admin/account-dashboard')) return 'account-dashboard';
    if (path.includes('/admin/settings')) return 'settings';
    if (path.includes('/admin/discounts')) return 'discounts';
    return 'dashboard';
  }, [location.pathname]);

  const getPageTitle = () => {
    if (headerProps.title) return headerProps.title;

    const titles = {
      'dashboard': 'Dashboard Overview',
      'user-management': 'User Management',
      'reading-rooms': 'Reading Room',
      'hostel': 'Hostel',
      'canteen': 'Canteen',
      'messages': 'Admin Messages',
      'create-announcement': 'Announcements',
      'balance-requests': 'Balance Requests',
      'refund-requests': 'Refund Requests',
      'transaction-statement': 'Transaction Statement',
      'account-dashboard': 'Accounts',
      'settings': 'System Settings',
      'discounts': 'Discount & Coupons'
    };
    return titles[currentView] || 'Admin Panel';
  };

  const isExpanded = isMobile ? isSidebarOpen : isSidebarHovered;

  const handleDashboardBack = useCallback(() => handleNavigate('dashboard'), [handleNavigate]);

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
          <div className="admin-header-content">
            <div className="admin-header-top-row">
              <div className="admin-header-left">
                {isMobile && (
                  <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle Sidebar">
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                  </button>
                )}

                {((location.pathname.split('/').filter(Boolean).length > 2) || headerProps.onBack) && (
                  <button
                    className="admin-header-back-btn"
                    onClick={headerProps.onBack || (() => navigate(-1))}
                    aria-label="Go back"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                <h1 className="admin-header-title">{getPageTitle()}</h1>
              </div>
              <div className="admin-header-right">
                {headerProps.rightElement}
              </div>
            </div>
          </div>
        </header>

        <main className="std-body" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', flex: 1 }}>
          {headerProps.actionBar && (
            <div className="admin-header-action-bar">
              {headerProps.actionBar}
            </div>
          )}
          <Routes>
            <Route path="/" element={<Dashboard onNavigate={handleNavigate} onDataLoaded={handlePageReady} />} />
            <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="/user-management" element={<UserManagementDashboard onDataLoaded={handlePageReady} />} />
            <Route path="/user-management/manage/*" element={<UserManagementModule onDataLoaded={handlePageReady} />} />
            <Route path="/hostel" element={<HostelDashboard onDataLoaded={handlePageReady} />} />
            <Route path="/hostel/manage" element={<HostelManagement onBack={handleDashboardBack} onDataLoaded={handlePageReady} />} />
            <Route path="/canteen" element={<CanteenDashboard onDataLoaded={handlePageReady} />} />
            <Route path="/canteen/manage/*" element={<CanteenAdminLanding onDataLoaded={handlePageReady} />} />
            <Route path="/messages" element={<AdminMessages onDataLoaded={handlePageReady} />} />
            <Route path="/create-announcement" element={<CreateAnnouncement onDataLoaded={handlePageReady} />} />
            <Route path="/reading-rooms" element={<ReadingRoomDashboard onDataLoaded={handlePageReady} />} />
            <Route path="/reading-rooms/manage" element={<ReadingRoomManagement onDataLoaded={handlePageReady} />} />
            <Route path="/balance-requests" element={<AdminBalanceLoad onDataLoaded={handlePageReady} />} />
            <Route path="/refund-requests" element={<RefundRequests onDataLoaded={handlePageReady} />} />
            <Route path="/transaction-statement" element={<AdminTransactionStatement onDataLoaded={handlePageReady} />} />
            <Route path="/account-dashboard" element={<AccountDashboard onDataLoaded={handlePageReady} />} />
            <Route path="/expense-earning-management" element={<ExpenseEarningManagement onDataLoaded={handlePageReady} />} />
            <Route path="/discounts" element={<DiscountManagement onDataLoaded={handlePageReady} />} />
            <Route path="/settings" element={<Settings onBack={handleDashboardBack} onDataLoaded={handlePageReady} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function AdminLanding() {
  return (
    <AdminHeaderProvider>
      <AdminLandingContent />
    </AdminHeaderProvider>
  );
}

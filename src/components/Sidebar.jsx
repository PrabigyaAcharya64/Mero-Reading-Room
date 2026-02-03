import React, { useState, useEffect } from 'react';
import {
    LogOut,
    Bell,
    CreditCard,
    Receipt,
    Calculator,
    X,
    RotateCcw,
    Settings as SettingsIcon
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import '../styles/AdminSidebar.css'; // Import the CSS file

const profileIcon = new URL('../assets/profile.svg', import.meta.url).href;
const contactIcon = new URL('../assets/contact.svg', import.meta.url).href;
const userManagementIcon = new URL('../assets/usermanagement.svg', import.meta.url).href;
const hostelIcon = new URL('../assets/hostel.svg', import.meta.url).href;
const canteenIcon = new URL('../assets/canteen.svg', import.meta.url).href;
const readingRoomIcon = new URL('../assets/readingroom.svg', import.meta.url).href;
const statementIcon = new URL('../assets/statement.jpg', import.meta.url).href;

function Sidebar({ currentView, onNavigate, isOpen, isMobile, onClose }) {


    const { signOutUser, userRole } = useAuth(); // Destructure userRole
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [pendingUsers, setPendingUsers] = useState(0);
    const [pendingRefunds, setPendingRefunds] = useState(0);

    // Fetch Counts
    useEffect(() => {
        // Only run listeners if user is admin or canteen
        if (!userRole || (userRole !== 'admin' && userRole !== 'canteen')) {
            setUnreadMessages(0);
            setPendingUsers(0);
            setPendingRefunds(0);
            return;
        }

        const unsubscribers = [];

        // 1. Unread Messages (Admin/Canteen may see messages)
        // Adjust rule if messages are strictly admin. Rules say 'isStaff()'.
        const msgQ = query(collection(db, 'messages'), where('read', '==', false));
        const unsubMsg = onSnapshot(msgQ, (snap) => {
            setUnreadMessages(snap.size);
        }, (err) => console.log("Sidebar: Msg listener restricted.", err.code));
        unsubscribers.push(unsubMsg);


        if (userRole === 'admin') {
            // 2. Pending Users (Admin Only)
            const userQ = query(collection(db, 'users'), orderBy('submittedAt', 'desc'));
            const unsubUser = onSnapshot(userQ, (snap) => {
                const count = snap.docs.filter(doc => {
                    const data = doc.data();
                    return data.mrrNumber && data.submittedAt && data.verified !== true;
                }).length;
                setPendingUsers(count);
            }, (err) => console.log("Sidebar: User listener restricted.", err.code));
            unsubscribers.push(unsubUser);

            // 3. Pending Refunds (Admin Only)
            const refundQ = query(collection(db, 'refunds'), where('status', '==', 'pending'));
            const unsubRefund = onSnapshot(refundQ, (snap) => {
                setPendingRefunds(snap.size);
            }, (err) => console.log("Sidebar: Refund listener restricted.", err.code));
            unsubscribers.push(unsubRefund);
        }

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [userRole]);

    const menuItems = [
        { id: 'dashboard', label: 'Overview', icon: profileIcon },
        {
            id: 'user-management',
            label: 'User Management',
            icon: userManagementIcon,
            badge: pendingUsers > 0 ? pendingUsers : null
        },
        { id: 'hostel', label: 'Hostel', icon: hostelIcon },
        { id: 'canteen', label: 'Canteen', icon: canteenIcon },
        { id: 'reading-rooms', label: 'Reading Rooms', icon: readingRoomIcon },
        {
            id: 'messages',
            label: 'Messages',
            icon: contactIcon,
            badge: unreadMessages > 0 ? unreadMessages : null
        },
        { id: 'create-announcement', label: 'Announcements', icon: null, isLucide: true, lucideIcon: Bell },
        { id: 'balance-requests', label: 'Balance Requests', icon: null, isLucide: true, lucideIcon: CreditCard },
        {
            id: 'refund-requests',
            label: 'Refund Requests',
            icon: null,
            isLucide: true,
            lucideIcon: RotateCcw,
            badge: pendingRefunds > 0 ? pendingRefunds : null
        },
        {
            id: 'transaction-statement',
            label: 'Transaction Statement',
            icon: statementIcon,
            isLucide: false,
            lucideIcon: null
        },
        { id: 'account-dashboard', label: 'Accounts', icon: null, isLucide: true, lucideIcon: Calculator },
        { id: 'discounts', label: 'Discounts', icon: null, isLucide: true, lucideIcon: Receipt }, // Using Receipt as icon placeholder
        { id: 'settings', label: 'Settings', icon: null, isLucide: true, lucideIcon: SettingsIcon },
    ];

    // On mobile, the sidebar is always "expanded" when open
    const isExpanded = isMobile ? true : isOpen;

    return (
        <>
            {/* Mobile Overlay */}
            {isMobile && isOpen && (
                <div className="mobile-sidebar-overlay" onClick={onClose}></div>
            )}

            <aside
                className={`sidebar-container ${isExpanded ? 'expanded' : 'collapsed'} ${isMobile ? 'mobile-drawer' : ''} ${isMobile && isOpen ? 'mobile-drawer-open' : ''}`}
                onMouseEnter={() => !isMobile && onNavigate && onNavigate('__hover_expand')}
                onMouseLeave={() => !isMobile && onNavigate && onNavigate('__hover_collapse')}
            >
                {/* Sidebar Header (Mobile only) */}
                {isMobile && (
                    <div className="sidebar-header-mobile">
                        <span className="sidebar-header-title">ADMIN MENU</span>
                        <button onClick={onClose} className="sidebar-close-button">
                            <X size={24} />
                        </button>
                    </div>
                )}

                {/* Menu Container */}
                <div className="sidebar-menu-container">
                    <nav className="sidebar-nav">
                        {menuItems.map((item) => {
                            const isActive = currentView === item.id;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id)}
                                    title={!isExpanded ? item.label : ''}
                                    className={`sidebar-item ${isActive ? 'active' : ''} ${!isExpanded ? 'collapsed-item-center' : ''}`}
                                >
                                    {isActive && (
                                        <div className={`sidebar-active-indicator ${isExpanded ? 'expanded' : ''}`} />
                                    )}

                                    <div className={`sidebar-item-icon ${isExpanded ? '' : 'collapsed-icon'}`}>
                                        {item.isLucide ? (
                                            <item.lucideIcon size={20} color={isActive ? '#000' : '#6b7280'} />
                                        ) : (
                                            <img
                                                src={item.icon}
                                                alt={item.label}
                                                className={`sidebar-icon-img ${isActive ? '' : 'grayscale'}`}
                                            />
                                        )}
                                    </div>

                                    <span className={`sidebar-item-label ${isExpanded ? 'visible' : 'hidden'}`}>
                                        {item.label}
                                    </span>

                                    {item.badge && (
                                        <span className={`sidebar-badge ${isExpanded ? 'expanded' : 'collapsed'}`}>
                                            {isExpanded ? item.badge : ''}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Logout Section */}
                <div className="sidebar-footer">
                    <button
                        onClick={signOutUser}
                        className={`logout-button ${!isExpanded ? 'collapsed-item-center' : ''}`}
                        title="Sign Out"
                    >
                        <LogOut size={20} />
                        {isExpanded && <span className="logout-label">Sign Out</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;

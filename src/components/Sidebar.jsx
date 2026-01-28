import React, { useState, useEffect } from 'react';
import {
    LogOut,
    Bell,
    CreditCard,
    Receipt,
    X
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

function Sidebar({ currentView, onNavigate, isOpen, isMobile, onClose }) {
    const { signOutUser } = useAuth();
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [pendingUsers, setPendingUsers] = useState(0);

    // Fetch Counts
    useEffect(() => {
        // 1. Unread Messages
        const msgQ = query(collection(db, 'messages'), where('read', '==', false));
        const unsubMsg = onSnapshot(msgQ, (snap) => {
            setUnreadMessages(snap.size);
        }, (err) => console.error("Error fetching unread messages:", err));


        const userQ = query(collection(db, 'users'), orderBy('submittedAt', 'desc'));

        const unsubUser = onSnapshot(userQ, (snap) => {
            const count = snap.docs.filter(doc => {
                const data = doc.data();
                return data.mrrNumber && data.submittedAt && data.verified !== true;
            }).length;
            setPendingUsers(count);
        }, (err) => console.error("Error fetching pending users:", err));

        return () => {
            unsubMsg();
            unsubUser();
        };
    }, []);

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
        { id: 'transaction-statement', label: 'Transaction Statement', icon: null, isLucide: true, lucideIcon: Receipt },
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

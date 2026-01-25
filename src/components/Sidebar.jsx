import React, { useState, useEffect } from 'react';
import {
    LogOut,
    Bell,
    CreditCard
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const profileIcon = new URL('../assets/profile.svg', import.meta.url).href;
const contactIcon = new URL('../assets/contact.svg', import.meta.url).href;
const userManagementIcon = new URL('../assets/usermanagement.svg', import.meta.url).href;
const hostelIcon = new URL('../assets/hostel.svg', import.meta.url).href;
const reportsIcon = new URL('../assets/reports.svg', import.meta.url).href;
const canteenIcon = new URL('../assets/canteen.svg', import.meta.url).href;
const readingRoomIcon = new URL('../assets/readingroom.svg', import.meta.url).href;
const orderPlaceIcon = new URL('../assets/order_place.svg', import.meta.url).href;
const inventoryIcon = new URL('../assets/inventory.svg', import.meta.url).href;
const idCardIcon = new URL(/* @vite-ignore */ '../assets/idcard.svg', import.meta.url).href;

function Sidebar({ currentView, onNavigate, isOpen, onClose }) {
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
    ];

    return (
        <aside style={{
            width: '260px',
            height: '100vh',
            backgroundColor: '#ffffff',
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 1000,
            transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.1)' : 'none'
        }}>

            {/* Menu */}
            <div style={{ flex: 1, padding: '24px 16px', overflowY: 'auto' }}>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {menuItems.map((item) => {
                        const isActive = currentView === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    backgroundColor: isActive ? '#f3f4f6' : 'transparent',
                                    color: isActive ? '#111827' : '#6b7280',
                                    fontSize: '14px',
                                    fontWeight: isActive ? '600' : '500',
                                    cursor: 'pointer',
                                    width: '100%',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                }}
                            >
                                {isActive && (
                                    <div style={{
                                        position: 'absolute',
                                        left: '0',
                                        width: '4px',
                                        height: '20px',
                                        backgroundColor: '#000',
                                        borderTopRightRadius: '4px',
                                        borderBottomRightRadius: '4px'
                                    }} />
                                )}
                                {item.isLucide ? (
                                    <item.lucideIcon size={20} color={isActive ? '#000' : '#6b7280'} />
                                ) : (
                                    <img
                                        src={item.icon}
                                        alt={item.label}
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            objectFit: 'contain',
                                            filter: isActive ? 'none' : 'grayscale(100%) opacity(0.7)'
                                        }}
                                    />
                                )}
                                <span style={{ flex: 1 }}>{item.label}</span>

                                {item.badge && (
                                    <span style={{
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        minWidth: '20px',
                                        textAlign: 'center',
                                        lineHeight: '1.4'
                                    }}>
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* User / Logout */}
            <div style={{
                padding: '24px',
                borderTop: '1px solid #f3f4f6'
            }}>
                <button
                    onClick={signOutUser}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        width: '100%',
                        border: 'none',
                        background: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                    }}
                >
                    <LogOut size={20} />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;

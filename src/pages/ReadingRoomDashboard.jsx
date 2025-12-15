import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import LoadingSpinner from '../components/LoadingSpinner';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

// SVG Icon Components
const SeatIcon = ({ occupied, isMySeat, size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M10 35 L10 40 Q10 42 12 42 L18 42 L18 38 L32 38 L32 42 L38 42 Q40 42 40 40 L40 35 Z"
            fill={isMySeat ? '#1976d2' : (occupied ? '#e0e0e0' : '#fff')}
            stroke={isMySeat ? '#1565c0' : '#ccc'}
            strokeWidth="1"
        />
        <path
            d="M8 25 Q8 20 12 20 L38 20 Q42 20 42 25 L42 35 L8 35 Z"
            fill={isMySeat ? '#2196f3' : (occupied ? '#eeeeee' : '#fff')}
            stroke={isMySeat ? '#1565c0' : '#ccc'}
            strokeWidth="1"
        />
        <rect x="7" y="20" width="3" height="15" rx="1.5" fill={isMySeat ? '#1565c0' : (occupied ? '#bdbdbd' : '#ccc')} />
        <rect x="40" y="20" width="3" height="15" rx="1.5" fill={isMySeat ? '#1565c0' : (occupied ? '#bdbdbd' : '#ccc')} />
    </svg>
);

const DoorIcon = ({ size = 40 }) => (
    <svg width={size} height={size * 1.5} viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="5" width="24" height="50" rx="2" fill="#d7ccc8" stroke="#8d6e63" strokeWidth="1.5" />
        <rect x="10" y="8" width="20" height="44" rx="1" fill="#efebe9" stroke="#a1887f" strokeWidth="1" />
        <circle cx="26" cy="30" r="2" fill="#5d4037" />
    </svg>
);

const WindowIcon = ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="34" height="34" rx="2" fill="#e1f5fe" stroke="#b3e5fc" strokeWidth="2" />
        <line x1="25" y1="8" x2="25" y2="42" stroke="#b3e5fc" strokeWidth="2" />
        <line x1="8" y1="25" x2="42" y2="25" stroke="#b3e5fc" strokeWidth="2" />
        <rect x="6" y="6" width="38" height="38" rx="2" fill="none" stroke="#81d4fa" strokeWidth="2.5" />
    </svg>
);

const ToiletIcon = ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="30" height="30" rx="4" fill="#f5f5f5" stroke="#bdbdbd" strokeWidth="2" />
        <circle cx="25" cy="20" r="4" fill="#757575" />
        <path d="M25 25 L25 35 M20 30 L30 30" stroke="#757575" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

function ReadingRoomDashboard({ onBack }) {
    const { user, signOutUser } = useAuth();
    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Reader';
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [roomData, setRoomData] = useState(null);
    const [assignments, setAssignments] = useState([]);

    useEffect(() => {
        loadDashboardData();
    }, [user]);

    const loadDashboardData = async () => {
        try {
            if (!user) return;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) return;

            const data = userDoc.data();
            setUserData(data);

            if (data.currentSeat?.roomId) {
                const roomDoc = await getDoc(doc(db, 'readingRooms', data.currentSeat.roomId));
                if (roomDoc.exists()) {
                    setRoomData({ id: roomDoc.id, ...roomDoc.data() });
                }

                const assignmentsRef = collection(db, 'seatAssignments');
                const assignmentsSnapshot = await getDocs(assignmentsRef);
                const roomAssignments = assignmentsSnapshot.docs
                    .map(doc => doc.data())
                    .filter(a => a.roomId === data.currentSeat.roomId);
                setAssignments(roomAssignments);
            }
        } catch (err) {
            console.error('Error loading dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOutUser();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#fff' }}>
                <LoadingSpinner size="40" stroke="3" color="#333" />
            </div>
        );
    }

    const isExpired = userData?.nextPaymentDue && new Date(userData.nextPaymentDue) < new Date();
    const hasNoMembership = !userData?.currentSeat || isExpired;

    if (hasNoMembership) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', maxWidth: '500px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', fontFamily: 'var(--brand-font-serif)' }}>
                        {isExpired ? 'Membership Expired' : 'No Active Membership'}
                    </h2>
                    <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px', lineHeight: '1.6' }}>
                        {isExpired
                            ? 'Your reading room membership has expired. Please renew to continue accessing the reading room.'
                            : 'You don\'t have an active reading room membership.'}
                    </p>
                    <button
                        onClick={onBack}
                        style={{
                            backgroundColor: '#000',
                            color: '#fff',
                            padding: '16px 32px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontFamily: 'var(--brand-font-body)'
                        }}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const expiryDateShort = userData?.nextPaymentDue ? new Date(userData.nextPaymentDue).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    }) : '';

    const daysLeft = userData?.nextPaymentDue ? Math.ceil((new Date(userData.nextPaymentDue).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return (
        <div className="landing-screen">
            <header className="landing-header">
                {/* Left: Back Button */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                    {onBack && (
                        <button
                            onClick={onBack}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                background: '#fff',
                                fontSize: '15px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                color: '#000',
                                fontFamily: 'var(--brand-font-body)',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                                e.currentTarget.style.borderColor = '#d0d0d0';
                                e.currentTarget.style.transform = 'translateX(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fff';
                                e.currentTarget.style.borderColor = '#e0e0e0';
                                e.currentTarget.style.transform = 'translateX(0)';
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Back
                        </button>
                    )}
                </div>

                {/* Center: Greeting */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <p className="landing-greeting" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                        Hey <span>{displayName}</span>!
                    </p>
                </div>

                {/* Right: Status/Profile/Signout */}
                <div className="landing-status" style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <button type="button" className="landing-profile" aria-label="Profile">
                        <img src={profileIcon} alt="" />
                    </button>
                    <button type="button" className="landing-signout" onClick={handleSignOut}>
                        Sign out
                    </button>
                </div>
            </header>

            <main className="landing-body">
                {/* Main Content Card */}
                <div style={{
                    maxWidth: '900px',
                    margin: '0 auto',
                    backgroundColor: '#fff',
                    padding: '24px',
                    borderRadius: '20px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    width: '100%'
                }}>
                    {/* Top Info Section */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '24px',
                        paddingBottom: '20px',
                        borderBottom: '1px solid #f5f5f5'
                    }}>
                        <div>
                            <div style={{
                                fontSize: '12px',
                                color: '#888',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginBottom: '4px',
                                fontFamily: 'var(--brand-font-body)'
                            }}>
                                Assigned Seat
                            </div>
                            <div style={{
                                fontSize: '18px',
                                color: '#000',
                                fontWeight: '600',
                                fontFamily: 'var(--brand-font-serif)'
                            }}>
                                {userData.currentSeat.seatLabel}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{
                                fontSize: '12px',
                                color: '#888',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginBottom: '4px',
                                fontFamily: 'var(--brand-font-body)'
                            }}>
                                Room Name
                            </div>
                            <div style={{
                                fontSize: '18px',
                                color: '#000',
                                fontWeight: '600',
                                fontFamily: 'var(--brand-font-serif)'
                            }}>
                                {userData.currentSeat.roomName}
                            </div>
                        </div>
                    </div>

                    {/* Room Layout Title */}
                    <div style={{
                        fontSize: '14px',
                        color: '#444',
                        marginBottom: '16px',
                        fontFamily: 'var(--brand-font-body)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        textAlign: 'center'
                    }}>
                        Room Layout
                    </div>

                    {/* Room Layout */}
                    {roomData ? (
                        <div style={{
                            backgroundColor: '#fafafa',
                            borderRadius: '12px',
                            padding: '20px',
                            marginBottom: '20px',
                            overflow: 'auto',
                            maxHeight: '500px'
                        }}>
                            <div style={{
                                position: 'relative',
                                width: roomData.width,
                                height: roomData.height,
                                margin: '0 auto'
                            }}>
                                {(roomData.elements || roomData.seats || []).map(element => {
                                    const isSeat = !element.type || element.type === 'seat';
                                    const isMySeat = isSeat && element.id === userData.currentSeat.seatId;
                                    const isOccupied = isSeat && assignments.some(a => a.seatId === element.id);
                                    const type = String(element.type || '').toLowerCase();

                                    return (
                                        <div
                                            key={element.id}
                                            style={{
                                                position: 'absolute',
                                                left: element.x,
                                                top: element.y,
                                                width: element.width,
                                                height: element.height,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {isSeat && (
                                                <>
                                                    <SeatIcon
                                                        size={Math.min(element.width, element.height)}
                                                        occupied={isOccupied}
                                                        isMySeat={isMySeat}
                                                    />
                                                    <span style={{
                                                        fontSize: '10px',
                                                        marginTop: '2px',
                                                        fontWeight: isMySeat ? 'bold' : 'normal',
                                                        color: isMySeat ? '#1565c0' : '#666'
                                                    }}>
                                                        {element.label}
                                                    </span>
                                                </>
                                            )}
                                            {type === 'door' && (
                                                <>
                                                    <DoorIcon size={element.width} />
                                                    <span style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                                                        {element.label || 'Door'}
                                                    </span>
                                                </>
                                            )}
                                            {type === 'window' && (
                                                <>
                                                    <WindowIcon size={element.width} />
                                                    <span style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                                                        {element.label || 'Window'}
                                                    </span>
                                                </>
                                            )}
                                            {type === 'toilet' && (
                                                <>
                                                    <ToiletIcon size={element.width} />
                                                    <span style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                                                        {element.label || 'Toilet'}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: '60px',
                            textAlign: 'center',
                            backgroundColor: '#f9f9f9',
                            borderRadius: '12px',
                            marginBottom: '20px'
                        }}>
                            <span style={{ color: '#888', fontFamily: 'var(--brand-font-body)' }}>
                                Room layout not available
                            </span>
                        </div>
                    )}

                    {/* Legend */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '16px',
                        marginTop: '20px',
                        marginBottom: '10px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '3px',
                                backgroundColor: '#2196f3',
                                border: '1px solid #1565c0'
                            }} />
                            <span style={{ fontSize: '12px', color: '#666', fontFamily: 'var(--brand-font-body)' }}>
                                Your Seat
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '3px',
                                backgroundColor: '#eeeeee',
                                border: '1px solid #ccc'
                            }} />
                            <span style={{ fontSize: '12px', color: '#666', fontFamily: 'var(--brand-font-body)' }}>
                                Occupied
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '3px',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc'
                            }} />
                            <span style={{ fontSize: '12px', color: '#666', fontFamily: 'var(--brand-font-body)' }}>
                                Available
                            </span>
                        </div>
                    </div>

                    {/* Bottom Info Section */}
                    <div style={{
                        marginTop: '24px',
                        paddingTop: '20px',
                        borderTop: '1px solid #f5f5f5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                            <div style={{
                                fontSize: '12px',
                                color: '#888',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                fontFamily: 'var(--brand-font-body)'
                            }}>
                                Status
                            </div>
                            <div style={{
                                paddingTop: '6px',
                                paddingBottom: '6px',
                                paddingLeft: '12px',
                                paddingRight: '12px',
                                backgroundColor: '#e6f4ea',
                                borderRadius: '20px'
                            }}>
                                <span style={{
                                    color: '#1e8e3e',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    letterSpacing: '0.3px'
                                }}>
                                    Active
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                            <div style={{
                                fontSize: '12px',
                                color: '#888',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                fontFamily: 'var(--brand-font-body)'
                            }}>
                                Expires on
                            </div>
                            <div style={{
                                fontSize: '16px',
                                color: daysLeft < 5 ? '#d32f2f' : '#000',
                                fontWeight: '600',
                                fontFamily: 'var(--brand-font-serif)'
                            }}>
                                {expiryDateShort}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ReadingRoomDashboard;

import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import '../../styles/StandardLayout.css';



// SVG Icon Components
const SeatIcon = ({ occupied, isMySeat, size = 40 }) => (
    <svg viewBox="0 0 50 50" width={size} height={size}>
        <path
            d="M10 35 L10 40 Q10 42 12 42 L18 42 L18 38 L32 38 L32 42 L38 42 Q40 42 40 40 L40 35 Z"
            fill={isMySeat ? "#1976d2" : occupied ? "#e0e0e0" : "#fff"}
            stroke={isMySeat ? "#1565c0" : "#ccc"}
            strokeWidth="1"
        />
        <path
            d="M8 25 Q8 20 12 20 L38 20 Q42 20 42 25 L42 35 L8 35 Z"
            fill={isMySeat ? "#2196f3" : occupied ? "#eeeeee" : "#fff"}
            stroke={isMySeat ? "#1565c0" : "#ccc"}
            strokeWidth="1"
        />
        <rect
            x="7"
            y="20"
            width="3"
            height="15"
            rx="1.5"
            fill={isMySeat ? "#1565c0" : occupied ? "#bdbdbd" : "#ccc"}
        />
        <rect
            x="40"
            y="20"
            width="3"
            height="15"
            rx="1.5"
            fill={isMySeat ? "#1565c0" : occupied ? "#bdbdbd" : "#ccc"}
        />
    </svg>
);

const DoorIcon = ({ size = 40 }) => (
    <svg viewBox="0 0 40 60" width={size} height={size * 1.5}>
        <rect x="8" y="5" width="24" height="50" rx="2" fill="#d7ccc8" stroke="#8d6e63" strokeWidth="1.5" />
        <rect x="10" y="8" width="20" height="44" rx="1" fill="#efebe9" stroke="#a1887f" strokeWidth="1" />
        <circle cx="26" cy="30" r="2" fill="#5d4037" />
    </svg>
);

const WindowIcon = ({ size = 40 }) => (
    <svg viewBox="0 0 50 50" width={size} height={size}>
        <rect x="8" y="8" width="34" height="34" rx="2" fill="#e1f5fe" stroke="#b3e5fc" strokeWidth="2" />
        <line x1="25" y1="8" x2="25" y2="42" stroke="#b3e5fc" strokeWidth="2" />
        <line x1="8" y1="25" x2="42" y2="25" stroke="#b3e5fc" strokeWidth="2" />
        <rect x="6" y="6" width="38" height="38" rx="2" fill="none" stroke="#81d4fa" strokeWidth="2.5" />
    </svg>
);

const ToiletIcon = ({ size = 40 }) => (
    <svg viewBox="0 0 50 50" width={size} height={size}>
        <rect x="10" y="10" width="30" height="30" rx="4" fill="#f5f5f5" stroke="#bdbdbd" strokeWidth="2" />
        <circle cx="25" cy="20" r="4" fill="#757575" />
        <path d="M25 25 L25 35 M20 30 L30 30" stroke="#757575" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

function ReadingRoomDashboard({ onBack }) {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [roomData, setRoomData] = useState(null);
    const [assignments, setAssignments] = useState([]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        }

        const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setUserData(data);

                if (!data.currentSeat) {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });

        return () => unsubUser();
    }, [user, authLoading]);

    useEffect(() => {
        if (!userData) return;

        const roomId = userData?.currentSeat?.roomId;
        // If we have user data but no room ID (and we passed the !currentSeat check in previous effect),
        // it means we have a seat object but no ID, or something inconsistent. 
        // We should stop loading and let the UI handle the missing data state (or show "Layout not available").
        if (!roomId) {
            setLoading(false);
            return;
        }

        let unsubAssignments = () => { };

        const loadRoomData = async () => {
            try {
                const roomDoc = await getDoc(doc(db, 'readingRooms', roomId));
                if (roomDoc.exists()) {
                    setRoomData({ id: roomDoc.id, ...roomDoc.data() });
                }

                const q = query(
                    collection(db, 'seatAssignments'),
                    where('roomId', '==', roomId)
                );
                unsubAssignments = onSnapshot(q, (snap) => {
                    const roomAssignments = snap.docs.map(doc => doc.data());
                    setAssignments(roomAssignments);
                    setLoading(false);
                });
            } catch (err) {
                console.error('Error loading room data:', err);
                setLoading(false);
            }
        };

        loadRoomData();
        return () => unsubAssignments();
    }, [userData]);


    if (loading) {
        return (
            <div className="std-container">
                <PageHeader title="My Dashboard" onBack={onBack} />
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    const nextDue = userData?.nextPaymentDue;
    const expiryDate = nextDue?.toDate
        ? nextDue.toDate()
        : typeof nextDue === 'number'
            ? new Date(nextDue * 1000)
            : new Date(nextDue);
    const isExpired = expiryDate < new Date();
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
                    <EnhancedBackButton onBack={onBack} />
                </div>
            </div>
        );
    }

    const expiryDateShort = expiryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });

    const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    return (
        <div className="std-container">
            <PageHeader title="Reading Room" onBack={onBack} />

            <main className="std-body">
                <div style={{
                    maxWidth: '900px',
                    margin: '0 auto',
                    backgroundColor: '#fff',
                    padding: '24px',
                    borderRadius: '20px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    width: '100%',
                    boxSizing: 'border-box'
                }}>
                    {/* Top Info Section: Normal Responsive HTML */}
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
                            <div id="assigned-seat-display" style={{
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
                            <div id="room-name-display" style={{
                                fontSize: '18px',
                                color: '#000',
                                fontWeight: '600',
                                fontFamily: 'var(--brand-font-serif)'
                            }}>
                                {userData.currentSeat.roomName}
                            </div>
                        </div>
                    </div>

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

                    {/* Room Layout: SVG Element Only */}
                    {roomData ? (
                        <div style={{
                            backgroundColor: '#fafafa',
                            borderRadius: '12px',
                            padding: '20px',
                            marginBottom: '20px',
                            overflow: 'auto', // Important for mobile scrolling if map is large
                            display: 'flex',
                            justifyContent: 'center',
                            minHeight: '300px'
                        }}>
                            <svg
                                viewBox={`0 0 ${roomData.width} ${roomData.height}`}
                                width={roomData.width}
                                height={roomData.height}
                                style={{
                                    maxWidth: '100%',
                                    height: 'auto'
                                }}
                            >
                                {(roomData.elements || roomData.seats || []).map(element => {
                                    const isSeat = !element.type || element.type === 'seat';
                                    const isMySeat = isSeat && element.id === userData.currentSeat.seatId;
                                    const isOccupied = isSeat && assignments.some(a => a.seatId === element.id);
                                    const type = String(element.type || '').toLowerCase();

                                    return (
                                        <g key={element.id} transform={`translate(${element.x}, ${element.y})`}>
                                            {isSeat && (
                                                <>
                                                    <SeatIcon
                                                        occupied={isOccupied}
                                                        isMySeat={isMySeat}
                                                        size={element.width}
                                                    />
                                                    <text
                                                        x={element.width / 2}
                                                        y={element.height + 10}
                                                        textAnchor="middle"
                                                        fontSize="10"
                                                        fontWeight={isMySeat ? 'bold' : 'normal'}
                                                        fill={isMySeat ? '#1976d2' : '#666'}
                                                        fontFamily="var(--brand-font-body)"
                                                    >
                                                        {element.label}
                                                    </text>
                                                    {isMySeat && (
                                                        <circle cx={element.width / 2} cy={-5} r="4" fill="#1976d2">
                                                            <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
                                                        </circle>
                                                    )}
                                                </>
                                            )}
                                            {type === 'door' && (
                                                <>
                                                    <DoorIcon size={element.width} />
                                                    <text
                                                        x={element.width / 2}
                                                        y={element.height + 12}
                                                        textAnchor="middle"
                                                        fontSize="10"
                                                        fontWeight="bold"
                                                        fill="#8d6e63"
                                                    >
                                                        {element.label || 'Door'}
                                                    </text>
                                                </>
                                            )}
                                            {type === 'window' && (
                                                <>
                                                    <WindowIcon size={element.width} />
                                                    <text
                                                        x={element.width / 2}
                                                        y={element.height + 12}
                                                        textAnchor="middle"
                                                        fontSize="10"
                                                        fontWeight="bold"
                                                        fill="#81d4fa"
                                                    >
                                                        {element.label || 'Window'}
                                                    </text>
                                                </>
                                            )}
                                            {type === 'toilet' && (
                                                <>
                                                    <ToiletIcon size={element.width} />
                                                    <text
                                                        x={element.width / 2}
                                                        y={element.height + 12}
                                                        textAnchor="middle"
                                                        fontSize="10"
                                                        fontWeight="bold"
                                                        fill="#757575"
                                                    >
                                                        {element.label || 'Toilet'}
                                                    </text>
                                                </>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
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

                    {/* Legend: Normal Responsive HTML */}
                    <div id="dashboard-legend" style={{
                        display: 'flex',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
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

                    {/* Bottom Info Section: Normal Responsive HTML */}
                    <div style={{
                        marginTop: '24px',
                        paddingTop: '20px',
                        borderTop: '1px solid #f5f5f5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                    }}>
                        <div id="status-section" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
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
                                paddingTop: '4px',
                                paddingBottom: '4px',
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
                        <div id="expiry-section" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
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

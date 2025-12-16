import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EnhancedBackButton from '../../components/EnhancedBackButton';

// SVG Icon Components (Reused from ReadingRoomManagement)
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

function ReadingRoomDashboard({ onBack }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [roomData, setRoomData] = useState(null);
    const [assignments, setAssignments] = useState([]);

    // 1. Listen for User Data Changes
    useEffect(() => {
        if (!user) return;

        const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                console.log('User data updated:', data);
                setUserData(data);

                // If user has no seat or is not fully enrolled, stop loading immediately
                // so the "No Active Membership" screen can show if appropriate
                if (!data.currentSeat || !data.enrollmentCompleted) {
                    console.log('Clearing room data: No seat or not enrolled');
                    setLoading(false);
                    setRoomData(null);
                    setAssignments([]);
                }
            } else {
                setUserData(null);
                setLoading(false);
            }
        }, (error) => {
            console.error('Error listening to user data:', error);
            setLoading(false);
        });

        return () => unsubscribeUser();
    }, [user]);

    // 2. Listen for Room and Assignment Changes (dependent on userData)
    useEffect(() => {
        const roomId = userData?.currentSeat?.roomId;
        console.log('Room/Assignment effect triggered. RoomID:', roomId);

        if (!roomId) return;

        let unsubscribeAssignments = () => { };

        const fetchRoomAndListenToAssignments = async () => {
            try {
                // Get Room Data (One-time fetch usually sufficient for layout)
                const roomDoc = await getDoc(doc(db, 'readingRooms', userData.currentSeat.roomId));
                if (roomDoc.exists()) {
                    setRoomData({ id: roomDoc.id, ...roomDoc.data() });
                }

                // Listen to Assignments for this room
                const assignmentsRef = collection(db, 'seatAssignments');
                const q = query(assignmentsRef, where('roomId', '==', userData.currentSeat.roomId));

                unsubscribeAssignments = onSnapshot(q, (snapshot) => {
                    const roomAssignments = snapshot.docs.map(doc => doc.data());
                    console.log('Assignments updated:', roomAssignments.length);
                    setAssignments(roomAssignments);
                    setLoading(false); // Data is fully ready now
                }, (error) => {
                    console.error('Error listening to assignments:', error);
                    setLoading(false);
                });

            } catch (err) {
                console.error('Error fetching room/assignments:', err);
                setLoading(false);
            }
        };

        fetchRoomAndListenToAssignments();

        return () => unsubscribeAssignments();
    }, [userData?.currentSeat?.roomId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <LoadingSpinner size="40" stroke="3" color="#333" />
            </div>
        );
    }

    // Check if membership has expired
    const isExpired = userData?.nextPaymentDue && new Date(userData.nextPaymentDue) < new Date();

    // If no active membership or expired membership, show appropriate message
    if (!userData?.currentSeat || isExpired) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h2>{isExpired ? 'Membership Expired' : 'No Active Membership'}</h2>
                <p>
                    {isExpired
                        ? 'Your reading room membership has expired. Please renew to continue accessing the reading room.'
                        : 'You don\'t have an active reading room membership.'}
                </p>
                <EnhancedBackButton onBack={onBack} />
            </div>
        );
    }

    const expiryDate = new Date(userData.nextPaymentDue).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const daysLeft = Math.ceil((new Date(userData.nextPaymentDue) - new Date()) / (1000 * 60 * 60 * 24));

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
            {/* Standard Header */}
            <header className="landing-header" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                    {onBack && <EnhancedBackButton onBack={onBack} />}
                </div>
                
                <p className="landing-greeting" style={{ flex: 1, textAlign: 'center', margin: 0 }}>Reading Room</p>
                
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                     {/* Placeholder for SignOut if needed, or empty to balance */}
                </div>
            </header>

            <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden', padding: '24px' }}>
                
                {/* Top Info Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--brand-font-body)' }}>Assigned Seat</span>
                        <span style={{ fontSize: '18px', color: '#000', fontFamily: 'var(--brand-font-serif)', fontWeight: 'bold' }}>{userData.currentSeat.seatLabel}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                         <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--brand-font-body)' }}>Room Name</span>
                         <span style={{ fontSize: '18px', color: '#000', fontFamily: 'var(--brand-font-serif)', fontWeight: 'bold' }}>{userData.currentSeat.roomName}</span>
                    </div>
                </div>

                {/* Room Layout Title */}
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '14px', color: '#444', fontFamily: 'var(--brand-font-body)', textTransform: 'uppercase', letterSpacing: '1px' }}>Room Layout</span>
                </div>

                {/* Room Map Container */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {roomData ? (
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: 'auto',
                            aspectRatio: `${roomData.width} / ${roomData.height}`,
                            backgroundColor: '#fafafa',
                            borderRadius: '12px',
                            border: '1px solid #eee',
                            overflow: 'hidden',
                            marginBottom: '20px'
                        }}>
                             {/* Scaling Container: We use CSS transform to scale the map to fit the container width */}
                             <div style={{
                                width: roomData.width,
                                height: roomData.height,
                                transform: `scale(${Math.min(1, 550 / roomData.width)})`, // Basic fallback scaling, ideally we'd use useResizeObserver
                                transformOrigin: 'top left',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                            }}>
                                <div style={{ position: 'relative', width: roomData.width, height: roomData.height }}>
                                    {(roomData.elements || roomData.seats || []).map(element => {
                                        const isSeat = !element.type || element.type === 'seat';
                                        const isMySeat = isSeat && element.id === userData.currentSeat.seatId;
                                        const isOccupied = isSeat && assignments.some(a => a.seatId === element.id);

                                        // Calculate scale factor for responsive web:
                                        // On web, we might just let it be absolute pixels if user has space, or scale it. 
                                        // For simplicity in this text-replace, we assume the map fits or scrolls if huge, 
                                        // but the styles above try to contain it. 
                                        // Actually, for a robust "like mobile" view, let's use percentage inputs if possible or SVG viewBox.
                                        // Since data is in pixels, we'll map directly but ensure container handles overflow or scaling.
                                        
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
                                                    justifyContent: 'center',
                                                    pointerEvents: 'none'
                                                }}
                                            >
                                                {(!element.type || element.type === 'seat') && (
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
                                                            color: isMySeat ? '#1976d2' : '#666',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {element.label}
                                                        </span>
                                                    </>
                                                )}
                                                {element.type === 'door' && <DoorIcon size={element.width} />}
                                                {element.type === 'window' && <WindowIcon size={element.width} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#666', backgroundColor: '#f9f9f9', borderRadius: '12px', width: '100%', marginBottom: '20px' }}>
                            Room layout not available
                        </div>
                    )}

                    {/* Legend */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                             <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#2196f3', border: '1px solid #1565c0' }}></div>
                             <span style={{ fontSize: '12px', color: '#666', fontFamily: 'var(--brand-font-body)' }}>Your Seat</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                             <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#eeeeee', border: '1px solid #ccc' }}></div>
                             <span style={{ fontSize: '12px', color: '#666', fontFamily: 'var(--brand-font-body)' }}>Occupied</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                             <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#fff', border: '1px solid #ccc' }}></div>
                             <span style={{ fontSize: '12px', color: '#666', fontFamily: 'var(--brand-font-body)' }}>Available</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Info Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: '20px', borderTop: '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                         <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--brand-font-body)' }}>Status</span>
                         <div style={{ padding: '6px 12px', backgroundColor: '#e6f4ea', borderRadius: '20px', width: 'fit-content' }}>
                             <span style={{ color: '#1e8e3e', fontSize: '13px', fontWeight: '600', letterSpacing: '0.3px' }}>Active</span>
                         </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                         <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--brand-font-body)' }}>Expires on</span>
                         <span style={{ fontSize: '16px', color: '#000', fontFamily: 'var(--brand-font-serif)', fontWeight: 'bold' }}>{expiryDate}</span>
                         <span style={{ fontSize: '13px', color: daysLeft < 5 ? '#d32f2f' : '#666' }}>({daysLeft} days remaining)</span>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default ReadingRoomDashboard;

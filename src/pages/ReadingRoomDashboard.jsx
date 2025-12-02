import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import LoadingSpinner from '../components/LoadingSpinner';

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

    useEffect(() => {
        loadDashboardData();
    }, [user]);

    const loadDashboardData = async () => {
        try {
            if (!user) return;

            // 1. Get User Data
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) return;

            const data = userDoc.data();
            setUserData(data);

            if (data.currentSeat?.roomId) {
                // 2. Get Room Data
                const roomDoc = await getDoc(doc(db, 'readingRooms', data.currentSeat.roomId));
                if (roomDoc.exists()) {
                    setRoomData({ id: roomDoc.id, ...roomDoc.data() });
                }

                // 3. Get All Assignments for this room (to show occupied seats)
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
                <button onClick={onBack} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>
                    Go Back
                </button>
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
            {/* Back Button */}
            {onBack && (
                <button
                    onClick={onBack}
                    style={{
                        marginBottom: '20px',
                        padding: '8px 16px',
                        backgroundColor: '#333',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'block',
                        maxWidth: '1200px',
                        margin: '0 auto 20px auto'
                    }}
                >
                    ← Back to Home
                </button>
            )}

            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
                {/* Sidebar Info */}
                <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', height: 'fit-content', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                        My Membership
                    </h2>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Assigned Seat</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                            {userData.currentSeat.seatLabel}
                        </div>
                        <div style={{ fontSize: '14px', color: '#333' }}>
                            {userData.currentSeat.roomName}
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Membership Status</div>
                        <div style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            backgroundColor: '#e8f5e9',
                            color: '#2e7d32',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '600'
                        }}>
                            Active
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Expires On</div>
                        <div style={{ fontSize: '16px', fontWeight: '600' }}>
                            {expiryDate}
                        </div>
                        <div style={{ fontSize: '13px', color: daysLeft < 5 ? '#c62828' : '#666', marginTop: '5px' }}>
                            ({daysLeft} days remaining)
                        </div>
                    </div>

                    <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>Rules</h3>
                        <ul style={{ fontSize: '13px', color: '#666', paddingLeft: '20px', lineHeight: '1.6' }}>
                            <li>Keep mobile on silent</li>
                            <li>No food at study table</li>
                            <li>Maintain silence</li>
                        </ul>
                    </div>
                </div>

                {/* Room Layout */}
                <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>
                        Room Layout
                    </h2>

                    {roomData ? (
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '600px',
                            backgroundColor: '#fafafa',
                            border: '1px solid #eee',
                            borderRadius: '4px',
                            overflow: 'auto'
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
                                                pointerEvents: 'none' // Read-only
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
                                                        fontSize: '12px',
                                                        marginTop: '2px',
                                                        fontWeight: isMySeat ? 'bold' : 'normal',
                                                        color: isMySeat ? '#1976d2' : '#666'
                                                    }}>
                                                        {element.label}
                                                    </span>
                                                    {isMySeat && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: -25,
                                                            backgroundColor: '#1976d2',
                                                            color: 'white',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            You are here
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {element.type === 'door' && <DoorIcon size={element.width} />}
                                            {element.type === 'window' && <WindowIcon size={element.width} />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                            Room layout not available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ReadingRoomDashboard;

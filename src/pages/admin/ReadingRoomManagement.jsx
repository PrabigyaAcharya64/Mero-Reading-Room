import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

const profileIcon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

// SVG Icon Components
const SeatIcon = ({ occupied, size = 50 }) => (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Theater-style seat */}
        <path
            d="M10 35 L10 40 Q10 42 12 42 L18 42 L18 38 L32 38 L32 42 L38 42 Q40 42 40 40 L40 35 Z"
            fill={occupied ? '#f44336' : '#4caf50'}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1"
        />
        <path
            d="M8 25 Q8 20 12 20 L38 20 Q42 20 42 25 L42 35 L8 35 Z"
            fill={occupied ? '#ef5350' : '#66bb6a'}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1"
        />
        <rect x="7" y="20" width="3" height="15" rx="1.5" fill={occupied ? '#c62828' : '#2e7d32'} />
        <rect x="40" y="20" width="3" height="15" rx="1.5" fill={occupied ? '#c62828' : '#2e7d32'} />
    </svg>
);

const ToiletIcon = ({ size = 45 }) => (
    <svg width={size} height={size} viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="25" width="21" height="15" rx="2" fill="#90caf9" stroke="#1976d2" strokeWidth="1.5" />
        <ellipse cx="22.5" cy="25" rx="8" ry="4" fill="#bbdefb" stroke="#1976d2" strokeWidth="1" />
        <circle cx="22.5" cy="12" r="5" fill="#64b5f6" stroke="#1976d2" strokeWidth="1.5" />
        <line x1="22.5" y1="17" x2="22.5" y2="25" stroke="#1976d2" strokeWidth="2" />
    </svg>
);

const KitchenIcon = ({ size = 45 }) => (
    <svg width={size} height={size} viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="15" width="25" height="20" rx="2" fill="#ffb74d" stroke="#f57c00" strokeWidth="1.5" />
        <circle cx="17" cy="23" r="3" fill="#fff3e0" stroke="#e65100" strokeWidth="1" />
        <circle cx="28" cy="23" r="3" fill="#fff3e0" stroke="#e65100" strokeWidth="1" />
        <rect x="15" y="32" width="15" height="2" fill="#f57c00" />
        <path d="M22.5 8 L26 15 L19 15 Z" fill="#ff9800" stroke="#e65100" strokeWidth="1" />
    </svg>
);

const DoorIcon = ({ size = 40 }) => (
    <svg width={size} height={size * 1.5} viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="5" width="24" height="50" rx="2" fill="#8d6e63" stroke="#5d4037" strokeWidth="1.5" />
        <rect x="10" y="8" width="20" height="44" rx="1" fill="#a1887f" stroke="#6d4c41" strokeWidth="1" />
        <circle cx="26" cy="30" r="2" fill="#5d4037" />
        <line x1="6" y1="55" x2="34" y2="55" stroke="#5d4037" strokeWidth="2" />
    </svg>
);

const WindowIcon = ({ size = 50 }) => (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="34" height="34" rx="2" fill="#e1f5fe" stroke="#0277bd" strokeWidth="2" />
        <line x1="25" y1="8" x2="25" y2="42" stroke="#0277bd" strokeWidth="2" />
        <line x1="8" y1="25" x2="42" y2="25" stroke="#0277bd" strokeWidth="2" />
        <rect x="6" y="6" width="38" height="38" rx="2" fill="none" stroke="#01579b" strokeWidth="2.5" />
    </svg>
);

// Element size configuration
const ELEMENT_CONFIG = {
    seat: { width: 70, height: 70 },
    toilet: { width: 55, height: 55 },
    kitchen: { width: 55, height: 55 },
    door: { width: 50, height: 75 },
    window: { width: 60, height: 60 }
};

function ReadingRoomManagement({ onBack }) {
    const { user, signOutUser } = useAuth();
    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';

    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [roomForm, setRoomForm] = useState({
        name: '',
        type: 'ac',
        width: 800,
        height: 600
    });
    const [elementForm, setElementForm] = useState({
        type: 'seat',
        label: '',
        x: 50,
        y: 50,
        scale: 2.0
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isDragging, setIsDragging] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Student management states
    const [verifiedUsers, setVerifiedUsers] = useState([]);
    const [seatAssignments, setSeatAssignments] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [assignmentMode, setAssignmentMode] = useState(false);

    useEffect(() => {
        loadRooms();
        loadVerifiedUsers();
        loadSeatAssignments();
    }, []);

    const loadVerifiedUsers = async () => {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('verified', '==', true));
            const snapshot = await getDocs(q);
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setVerifiedUsers(users);
        } catch (error) {
            console.error('Error loading verified users:', error);
        }
    };

    const loadSeatAssignments = async () => {
        try {
            const assignmentsRef = collection(db, 'seatAssignments');
            const snapshot = await getDocs(assignmentsRef);
            const assignments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSeatAssignments(assignments);
        } catch (error) {
            console.error('Error loading seat assignments:', error);
        }
    };

    const loadRooms = async () => {
        try {
            const roomsRef = collection(db, 'readingRooms');
            const snapshot = await getDocs(roomsRef);
            const roomsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRooms(roomsData);
        } catch (error) {
            console.error('Error loading rooms:', error);
            setMessage('Error loading rooms');
        }
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            await addDoc(collection(db, 'readingRooms'), {
                name: roomForm.name,
                type: roomForm.type,
                width: roomForm.width,
                height: roomForm.height,
                elements: [],
                isLocked: false,
                createdAt: new Date().toISOString()
            });

            setRoomForm({ name: '', type: 'ac', width: 800, height: 600 });
            setMessage('Room created successfully!');
            loadRooms();
        } catch (error) {
            console.error('Error creating room:', error);
            setMessage('Error creating room');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleLock = async (roomId) => {
        try {
            const room = rooms.find(r => r.id === roomId);
            const roomRef = doc(db, 'readingRooms', roomId);
            const newLockState = !room.isLocked;

            await updateDoc(roomRef, {
                isLocked: newLockState,
                lockedAt: newLockState ? new Date().toISOString() : null
            });

            setMessage(newLockState ? 'Layout locked' : 'Layout unlocked for editing');
            loadRooms();
        } catch (error) {
            console.error('Error toggling lock:', error);
            setMessage('Error toggling lock status');
        }
    };

    const handleAssignStudent = async (userId, seatId) => {
        if (!selectedRoom) return;

        try {
            const room = rooms.find(r => r.id === selectedRoom);
            const student = verifiedUsers.find(u => u.id === userId);
            const elements = room.elements || room.seats || [];
            const seat = elements.find(e => e.id === seatId);

            if (!student || !seat) return;

            const existingAssignment = seatAssignments.find(a => a.userId === userId);
            if (existingAssignment) {
                if (!confirm(`${student.name} is already assigned to ${existingAssignment.seatLabel} in ${existingAssignment.roomName}. Move them here?`)) {
                    return;
                }
                await deleteDoc(doc(db, 'seatAssignments', existingAssignment.id));
            }

            await addDoc(collection(db, 'seatAssignments'), {
                userId: userId,
                userName: student.name,
                userMrrNumber: student.mrrNumber,
                roomId: selectedRoom,
                roomName: room.name,
                seatId: seatId,
                seatLabel: seat.label,
                assignedAt: new Date().toISOString(),
                assignedBy: user?.uid || 'admin'
            });

            setMessage(`Assigned ${student.name} to ${seat.label}`);
            loadSeatAssignments();
            setAssignmentMode(false);
            setSelectedStudent(null);
        } catch (error) {
            console.error('Error assigning student:', error);
            setMessage('Error assigning student');
        }
    };

    const handleUnassignStudent = async (assignmentId) => {
        if (!confirm('Are you sure you want to unassign this student?')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'seatAssignments', assignmentId));
            setMessage('Student unassigned successfully');
            loadSeatAssignments();
            setShowStudentModal(false);
        } catch (error) {
            console.error('Error unassigning student:', error);
            setMessage('Error unassigning student');
        }
    };

    const handleAddElement = async (e) => {
        e.preventDefault();
        if (!selectedRoom) {
            setMessage('Please select a room first');
            return;
        }

        if (elementForm.type === 'seat' && !elementForm.label.trim()) {
            setMessage('Seat label is required');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const room = rooms.find(r => r.id === selectedRoom);
            const config = ELEMENT_CONFIG[elementForm.type];

            const newElement = {
                id: `${elementForm.type}-${Date.now()}`,
                type: elementForm.type,
                label: elementForm.label || '',
                x: elementForm.x,
                y: elementForm.y,
                width: config.width * elementForm.scale,
                height: config.height * elementForm.scale,
                scale: elementForm.scale,
                ...(elementForm.type === 'seat' && { occupied: false })
            };

            const currentElements = room.elements || room.seats || [];
            const updatedElements = [...currentElements, newElement];
            const roomRef = doc(db, 'readingRooms', selectedRoom);
            await updateDoc(roomRef, { elements: updatedElements });

            setElementForm({ type: 'seat', label: '', x: 50, y: 50, scale: 2.0 });
            setMessage(`${elementForm.type.charAt(0).toUpperCase() + elementForm.type.slice(1)} added successfully!`);
            loadRooms();
        } catch (error) {
            console.error('Error adding element:', error);
            setMessage('Error adding element');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRoom = async (roomId) => {
        if (!confirm('Are you sure you want to delete this room?')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'readingRooms', roomId));
            setMessage('Room deleted successfully!');
            if (selectedRoom === roomId) {
                setSelectedRoom(null);
                setShowRoomModal(false);
            }
            loadRooms();
        } catch (error) {
            console.error('Error deleting room:', error);
            setMessage('Error deleting room');
        }
    };

    const handleDeleteElement = async (elementId) => {
        if (!selectedRoom) return;

        try {
            const room = rooms.find(r => r.id === selectedRoom);
            const currentElements = room.elements || room.seats || [];
            const updatedElements = currentElements.filter(e => e.id !== elementId);
            const roomRef = doc(db, 'readingRooms', selectedRoom);
            await updateDoc(roomRef, { elements: updatedElements });
            setMessage('Element deleted successfully!');
            loadRooms();
        } catch (error) {
            console.error('Error deleting element:', error);
            setMessage('Error deleting element');
        }
    };

    const handleMouseDown = (e, elementId) => {
        if (e.button !== 0) return;

        const room = rooms.find(r => r.id === selectedRoom);
        if (room?.isLocked) return;

        const currentElements = room.elements || room.seats || [];
        const element = currentElements.find(el => el.id === elementId);

        const rect = e.currentTarget.parentElement.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left - element.x,
            y: e.clientY - rect.top - element.y
        });
        setIsDragging(elementId);
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !selectedRoom) return;

        const room = rooms.find(r => r.id === selectedRoom);
        const currentElements = room.elements || room.seats || [];
        const element = currentElements.find(el => el.id === isDragging);
        if (!element) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const elementWidth = element.width || 40;
        const elementHeight = element.height || 40;
        const newX = Math.max(0, Math.min(room.width - elementWidth, e.clientX - rect.left - dragOffset.x));
        const newY = Math.max(0, Math.min(room.height - elementHeight, e.clientY - rect.top - dragOffset.y));

        setRooms(prevRooms => prevRooms.map(r => {
            if (r.id === selectedRoom) {
                const updatedElements = (r.elements || r.seats || []).map(el =>
                    el.id === isDragging ? { ...el, x: newX, y: newY } : el
                );
                return { ...r, elements: updatedElements };
            }
            return r;
        }));
    };

    const handleMouseUp = async () => {
        if (!isDragging || !selectedRoom) return;

        try {
            const room = rooms.find(r => r.id === selectedRoom);
            const currentElements = room.elements || room.seats || [];
            const roomRef = doc(db, 'readingRooms', selectedRoom);
            await updateDoc(roomRef, { elements: currentElements });
        } catch (error) {
            console.error('Error updating element position:', error);
            setMessage('Error updating element position');
        }

        setIsDragging(null);
    };

    const handleSignOut = async () => {
        try {
            await signOutUser();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    const openRoomModal = (roomId) => {
        setSelectedRoom(roomId);
        setShowRoomModal(true);
        setAssignmentMode(false);
        setSelectedStudent(null);
    };

    const closeRoomModal = () => {
        setShowRoomModal(false);
        setSelectedRoom(null);
        setAssignmentMode(false);
        setSelectedStudent(null);
        setMessage('');
    };

    const getSelectedRoomData = () => {
        if (!selectedRoom) return null;
        return rooms.find(r => r.id === selectedRoom);
    };

    const selectedRoomData = getSelectedRoomData();

    return (
        <div className="landing-screen">
            <header className="landing-header">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="landing-signout"
                        style={{
                            border: '1px solid var(--color-text-primary)',
                            padding: '0.5rem 0.85rem'
                        }}
                    >
                        Back
                    </button>
                )}
                <p className="landing-greeting" style={{ flex: 1, textAlign: onBack ? 'center' : 'left' }}>
                    Hey <span>{displayName}</span>!
                </p>
                <div className="landing-status">
                    <button type="button" className="landing-profile" aria-label="Profile">
                        <img src={profileIcon} alt="" />
                    </button>
                    <button type="button" className="landing-signout" onClick={handleSignOut}>
                        Sign out
                    </button>
                </div>
            </header>

            <main className="landing-body" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
                <h1 style={{ marginBottom: '30px', fontSize: '2rem' }}>Reading Room Management</h1>

                {message && (
                    <p style={{
                        padding: '10px',
                        backgroundColor: message.includes('Error') ? '#fee' : '#efe',
                        borderRadius: '4px',
                        marginBottom: '20px'
                    }}>
                        {message}
                    </p>
                )}

                {/* Create New Room Form */}
                <section style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff' }}>
                    <h2 style={{ marginBottom: '20px' }}>Create New Room</h2>
                    <form onSubmit={handleCreateRoom} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
                        <label className="input-field">
                            <span className="input-field__label">Room Name</span>
                            <input
                                type="text"
                                value={roomForm.name}
                                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                                placeholder="e.g., Study Hall A"
                                required
                            />
                        </label>

                        <label className="input-field">
                            <span className="input-field__label">Room Type</span>
                            <select
                                value={roomForm.type}
                                onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value })}
                                style={{ width: '100%', padding: '10px', fontFamily: 'inherit', fontSize: 'inherit' }}
                            >
                                <option value="ac">AC</option>
                                <option value="non-ac">Non-AC</option>
                            </select>
                        </label>

                        <button type="submit" className="cta-button cta-button--primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Room'}
                        </button>
                    </form>
                </section>

                {/* All Rooms List */}
                <section style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff' }}>
                    <h2 style={{ marginBottom: '20px' }}>All Rooms ({rooms.length})</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                        {rooms.map(room => {
                            const elements = room.elements || room.seats || [];
                            const seats = elements.filter(e => !e.type || e.type === 'seat');
                            const roomAssignments = seatAssignments.filter(a => a.roomId === room.id);
                            const assignedCount = roomAssignments.length;
                            const unassignedCount = seats.length - assignedCount;

                            return (
                                <div
                                    key={room.id}
                                    style={{
                                        padding: '15px',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        backgroundColor: '#fafafa',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => openRoomModal(room.id)}
                                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                                >
                                    <div style={{ marginBottom: '10px' }}>
                                        <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{room.name}</h3>
                                        <p style={{ margin: '0', fontSize: '13px', color: '#666', textTransform: 'uppercase' }}>
                                            {room.type === 'ac' ? 'AC' : 'Non-AC'} {room.isLocked && '• Locked'}
                                        </p>
                                    </div>
                                    <div style={{ fontSize: '14px', display: 'grid', gap: '5px' }}>
                                        <div>Total Seats: {seats.length}</div>
                                        <div style={{ color: '#4caf50' }}>Assigned: {assignedCount}</div>
                                        <div style={{ color: '#90caf9' }}>Available: {unassignedCount}</div>
                                    </div>
                                </div>
                            );
                        })}

                        {rooms.length === 0 && (
                            <p style={{ textAlign: 'center', color: '#666', padding: '20px', gridColumn: '1 / -1' }}>
                                No rooms yet. Create your first room above.
                            </p>
                        )}
                    </div>
                </section>
            </main>

            {/* Room Details Modal */}
            {showRoomModal && selectedRoomData && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        maxWidth: '95vw',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        position: 'relative',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            position: 'sticky',
                            top: 0,
                            backgroundColor: '#fff',
                            borderBottom: '1px solid #ddd',
                            padding: '20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            zIndex: 10
                        }}>
                            <div>
                                <h2 style={{ margin: '0 0 5px 0' }}>{selectedRoomData.name}</h2>
                                <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                                    {selectedRoomData.type === 'ac' ? 'AC Room' : 'Non-AC Room'}
                                    {selectedRoomData.isLocked ? ' • Layout Locked' : ' • Edit Mode'}
                                </p>
                            </div>
                            <button
                                onClick={closeRoomModal}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '32px',
                                    cursor: 'pointer',
                                    lineHeight: '1',
                                    padding: '0',
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div style={{ padding: '20px' }}>
                            {message && (
                                <p style={{
                                    padding: '10px',
                                    backgroundColor: message.includes('Error') ? '#fee' : '#efe',
                                    borderRadius: '4px',
                                    marginBottom: '20px'
                                }}>
                                    {message}
                                </p>
                            )}

                            {/* Controls */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => handleToggleLock(selectedRoom)}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: selectedRoomData.isLocked ? '#4caf50' : '#ff9800',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {selectedRoomData.isLocked ? 'Unlock Layout' : 'Lock Layout'}
                                </button>
                                <button
                                    onClick={() => handleDeleteRoom(selectedRoom)}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#f44',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    Delete Room
                                </button>
                            </div>

                            {/* Add Element Form (only when unlocked) */}
                            {!selectedRoomData.isLocked && (
                                <section style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                                    <h3 style={{ marginTop: 0 }}>Add Element</h3>
                                    <form onSubmit={handleAddElement} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '15px', alignItems: 'end' }}>
                                        <label className="input-field">
                                            <span className="input-field__label">Type</span>
                                            <select
                                                value={elementForm.type}
                                                onChange={(e) => setElementForm({ ...elementForm, type: e.target.value })}
                                                style={{ padding: '10px', fontFamily: 'inherit', fontSize: 'inherit' }}
                                            >
                                                <option value="seat">Seat</option>
                                                <option value="toilet">Toilet</option>
                                                <option value="kitchen">Kitchen</option>
                                                <option value="door">Door</option>
                                                <option value="window">Window</option>
                                            </select>
                                        </label>
                                        <label className="input-field">
                                            <span className="input-field__label">Label {elementForm.type === 'seat' && '*'}</span>
                                            <input
                                                type="text"
                                                value={elementForm.label}
                                                onChange={(e) => setElementForm({ ...elementForm, label: e.target.value })}
                                                placeholder={elementForm.type === 'seat' ? 'e.g., A1' : 'Optional'}
                                                required={elementForm.type === 'seat'}
                                            />
                                        </label>
                                        <button type="submit" className="cta-button cta-button--primary" disabled={loading}>
                                            Add
                                        </button>
                                    </form>
                                </section>
                            )}

                            {/* Assignment Mode Panel */}
                            {selectedRoomData.isLocked && assignmentMode && (
                                <section style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <h3 style={{ margin: 0 }}>Select Student to Assign</h3>
                                        <button
                                            onClick={() => {
                                                setAssignmentMode(false);
                                                setSelectedStudent(null);
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#999',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '13px'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '10px' }}>
                                        {verifiedUsers
                                            .filter(u => !seatAssignments.some(a => a.userId === u.id))
                                            .map(student => (
                                                <div
                                                    key={student.id}
                                                    onClick={() => handleAssignStudent(student.id, assignmentMode)}
                                                    style={{
                                                        padding: '10px',
                                                        border: '1px solid #ddd',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        backgroundColor: 'white',
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fff0'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                >
                                                    <div style={{ fontWeight: 'bold' }}>{student.name}</div>
                                                    <div style={{ fontSize: '12px', color: '#666' }}>MRR: {student.mrrNumber}</div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </section>
                            )}

                            {/* Room Canvas */}
                            <section>
                                <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                                    {(() => {
                                        const elements = selectedRoomData.elements || selectedRoomData.seats || [];
                                        const seats = elements.filter(e => !e.type || e.type === 'seat');
                                        const assigned = seatAssignments.filter(a => a.roomId === selectedRoom).length;
                                        return `Total Seats: ${seats.length} | Assigned: ${assigned} | Available: ${seats.length - assigned}`;
                                    })()}
                                </div>
                                <p style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
                                    {selectedRoomData.isLocked
                                        ? 'Click on vacant seats to assign students. Click assigned seats to view details.'
                                        : 'Drag elements to reposition. Double-click to delete.'}
                                </p>

                                <div
                                    style={{
                                        position: 'relative',
                                        width: `${selectedRoomData.width}px`,
                                        height: `${selectedRoomData.height}px`,
                                        border: '2px solid #333',
                                        backgroundColor: '#f9f9f9',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        cursor: isDragging ? 'grabbing' : 'default',
                                        margin: '0 auto'
                                    }}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                >
                                    {(() => {
                                        const elements = selectedRoomData.elements || selectedRoomData.seats || [];
                                        const normalizedElements = elements.map(el => ({
                                            ...el,
                                            type: el.type || 'seat',
                                            label: el.label || el.number || '',
                                            width: el.width || ELEMENT_CONFIG[el.type || 'seat'].width,
                                            height: el.height || ELEMENT_CONFIG[el.type || 'seat'].height
                                        }));

                                        return normalizedElements.map(element => {
                                            const assignment = element.type === 'seat'
                                                ? seatAssignments.find(a => a.seatId === element.id && a.roomId === selectedRoom)
                                                : null;
                                            const isAssigned = !!assignment;

                                            const renderIcon = () => {
                                                switch (element.type) {
                                                    case 'seat':
                                                        return <SeatIcon occupied={isAssigned} size={element.width} />;
                                                    case 'toilet':
                                                        return <ToiletIcon size={element.width} />;
                                                    case 'kitchen':
                                                        return <KitchenIcon size={element.width} />;
                                                    case 'door':
                                                        return <DoorIcon size={element.width} />;
                                                    case 'window':
                                                        return <WindowIcon size={element.width} />;
                                                    default:
                                                        return <SeatIcon occupied={isAssigned} size={element.width} />;
                                                }
                                            };

                                            const handleElementClick = () => {
                                                if (isDragging) return;

                                                if (element.type === 'seat') {
                                                    if (selectedRoomData.isLocked) {
                                                        if (isAssigned) {
                                                            const student = verifiedUsers.find(u => u.id === assignment.userId);
                                                            if (student) {
                                                                setSelectedStudent({ ...student, assignment });
                                                                setShowStudentModal(true);
                                                            }
                                                        } else {
                                                            setAssignmentMode(element.id);
                                                            setSelectedStudent(null);
                                                        }
                                                    }
                                                }
                                            };

                                            return (
                                                <div
                                                    key={element.id}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${element.x}px`,
                                                        top: `${element.y}px`,
                                                        width: `${element.width}px`,
                                                        height: `${element.height + (element.type === 'seat' && isAssigned ? 20 : 0)}px`,
                                                        cursor: selectedRoomData.isLocked
                                                            ? (element.type === 'seat' ? 'pointer' : 'default')
                                                            : (isDragging === element.id ? 'grabbing' : 'grab'),
                                                        userSelect: 'none',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'flex-start'
                                                    }}
                                                    onMouseDown={(e) => handleMouseDown(e, element.id)}
                                                    onClick={handleElementClick}
                                                    onDoubleClick={() => {
                                                        if (!selectedRoomData.isLocked) {
                                                            if (confirm(`Delete ${element.type} ${element.label || ''}?`)) {
                                                                handleDeleteElement(element.id);
                                                            }
                                                        }
                                                    }}
                                                    title={
                                                        element.type === 'seat'
                                                            ? (isAssigned
                                                                ? `${element.label} - ${assignment.userName}`
                                                                : `${element.label} - Available`)
                                                            : `${element.type} ${element.label || ''}`
                                                    }
                                                >
                                                    {renderIcon()}
                                                    {element.type === 'seat' && element.label && (
                                                        <div style={{
                                                            marginTop: '2px',
                                                            fontSize: '11px',
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            backgroundColor: isAssigned ? '#4caf50' : '#90caf9',
                                                            color: 'white',
                                                            padding: '2px 6px',
                                                            borderRadius: '3px'
                                                        }}>
                                                            {element.label}
                                                        </div>
                                                    )}
                                                    {element.type === 'seat' && isAssigned && (
                                                        <div style={{
                                                            marginTop: '2px',
                                                            fontSize: '9px',
                                                            textAlign: 'center',
                                                            color: '#333',
                                                            maxWidth: '100px',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {assignment.userName}
                                                        </div>
                                                    )}
                                                    {element.label && element.type !== 'seat' && (
                                                        <div style={{
                                                            marginTop: '2px',
                                                            fontSize: '10px',
                                                            textAlign: 'center',
                                                            color: '#666'
                                                        }}>
                                                            {element.label}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {/* Student Details Modal */}
            {showStudentModal && selectedStudent && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        padding: '20px',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ marginTop: 0 }}>Student Details</h3>
                        <div style={{ marginBottom: '15px' }}>
                            <div style={{ fontSize: '14px', marginBottom: '8px' }}><strong>Name:</strong> {selectedStudent.name}</div>
                            <div style={{ fontSize: '14px', marginBottom: '8px' }}><strong>MRR Number:</strong> {selectedStudent.mrrNumber}</div>
                            <div style={{ fontSize: '14px', marginBottom: '8px' }}><strong>Email:</strong> {selectedStudent.email}</div>
                            <div style={{ fontSize: '14px', marginBottom: '8px' }}><strong>Seat:</strong> {selectedStudent.assignment?.seatLabel}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => handleUnassignStudent(selectedStudent.assignment?.id)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    backgroundColor: '#f44',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Unassign
                            </button>
                            <button
                                onClick={() => setShowStudentModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    backgroundColor: '#999',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReadingRoomManagement;

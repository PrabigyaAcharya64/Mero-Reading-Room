import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, setDoc, getDoc } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import '../../styles/ReadingRoomManagement.css';




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
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%"
            font-size="140"
            text-anchor="middle"
            dominant-baseline="middle"
            font-family="Arial, Helvetica, sans-serif"
            fill="#1976d2">
            T
        </text>
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
    door: { width: 50, height: 75 },
    window: { width: 60, height: 60 }
};

function ReadingRoomManagement({ onBack }) {
    const { user } = useAuth();

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
    const [canvasScale, setCanvasScale] = useState(1);

    // Student management states
    const [verifiedUsers, setVerifiedUsers] = useState([]);
    const [seatAssignments, setSeatAssignments] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [assignmentMode, setAssignmentMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadRooms();
        loadVerifiedUsers();
        loadSeatAssignments();
    }, []);

    // Auto-clear success messages after 3 seconds
    useEffect(() => {
        if (message && !message.includes('Error')) {
            const timer = setTimeout(() => {
                setMessage('');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

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
            const elements = room.elements || [];
            const seat = elements.find(e => e.id === seatId);

            if (!student || !seat) return;

            const existingAssignment = seatAssignments.find(a => a.userId === userId);
            let preservedPaymentDue = null;
            let preservedLastPayment = null;

            if (existingAssignment) {
                if (!confirm(`${student.name} is already assigned to ${existingAssignment.seatLabel} in ${existingAssignment.roomName}. Move them here?`)) {
                    return;
                }
                // Fetch current user data to preserve payment dates
                const userDocRef = doc(db, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const currentUserData = userDocSnap.data();
                    preservedPaymentDue = currentUserData.nextPaymentDue;
                    preservedLastPayment = currentUserData.lastPaymentDate;
                }

                // Delete old assignment
                await deleteDoc(doc(db, 'seatAssignments', existingAssignment.id));
            }

            // Create new seat assignment
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

            // Determine payment dates: preserve if reassigning, create new if first assignment
            const nextPaymentDue = preservedPaymentDue || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            const lastPaymentDate = preservedLastPayment || new Date().toISOString();

            console.log('Updating user document with:', {
                registrationCompleted: true,
                enrollmentCompleted: true,
                currentSeat: {
                    roomId: selectedRoom,
                    roomName: room.name,
                    seatId: seatId,
                    seatLabel: seat.label
                },
                nextPaymentDue: nextPaymentDue,
                lastPaymentDate: lastPaymentDate,
                selectedRoomType: room.type,
                isReassignment: !!existingAssignment
            });

            // Update user document with new seat info but preserve payment dates if reassigning
            await setDoc(doc(db, 'users', userId), {
                registrationCompleted: true,
                enrollmentCompleted: true,
                currentSeat: {
                    roomId: selectedRoom,
                    roomName: room.name,
                    seatId: seatId,
                    seatLabel: seat.label
                },
                nextPaymentDue: nextPaymentDue,
                lastPaymentDate: lastPaymentDate,
                selectedRoomType: room.type
            }, { merge: true });

            console.log('User document updated successfully for userId:', userId, existingAssignment ? '(reassignment - payment dates preserved)' : '(new assignment)');

            setMessage(`Assigned ${student.name} to ${seat.label}${existingAssignment ? ' (payment dates preserved)' : ''}`);
            loadSeatAssignments();
            setAssignmentMode(false);
            setSelectedStudent(null);
            setSearchQuery('');
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
            // First, get the assignment to find the userId
            const assignment = seatAssignments.find(a => a.id === assignmentId);

            if (!assignment) {
                setMessage('Error: Assignment not found');
                return;
            }

            // Delete the seat assignment
            await deleteDoc(doc(db, 'seatAssignments', assignmentId));

            // Update user document to clear seat assignment but PRESERVE registration status
            await setDoc(doc(db, 'users', assignment.userId), {
                // registrationCompleted: false, // REMOVED: Registration is lifetime
                // enrollmentCompleted: false,   // REMOVED: Enrollment is lifetime
                currentSeat: null,
                nextPaymentDue: null,
                lastPaymentDate: null,
                selectedRoomType: null
            }, { merge: true });

            console.log('User unassigned from seat (registration status preserved) for userId:', assignment.userId);

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

            const currentElements = room.elements || [];
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
            const currentElements = room.elements || [];
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
                const updatedElements = (r.elements || []).map(el =>
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
            const currentElements = room.elements || [];
            const roomRef = doc(db, 'readingRooms', selectedRoom);
            await updateDoc(roomRef, { elements: currentElements });
        } catch (error) {
            console.error('Error updating element position:', error);
            setMessage('Error updating element position');
        }

        setIsDragging(null);
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
        setSearchQuery(''); // Add this line to reset search
    };

    // Calculate canvas scale for responsiveness
    useEffect(() => {
        if (!showRoomModal || !selectedRoom) return;

        const calculateScale = () => {
            const room = rooms.find(r => r.id === selectedRoom);
            if (!room) return;

            const wrapper = document.querySelector('.rrm-canvas-wrapper');
            if (!wrapper) return;

            const wrapperWidth = wrapper.clientWidth - 40; // Account for padding
            const roomWidth = room.width;

            // Scale down if room is wider than container
            const scale = roomWidth > wrapperWidth ? wrapperWidth / roomWidth : 1;
            setCanvasScale(Math.min(scale, 1)); // Never scale up, only down
        };

        calculateScale();
        window.addEventListener('resize', calculateScale);
        return () => window.removeEventListener('resize', calculateScale);
    }, [showRoomModal, selectedRoom, rooms]);

    const getSelectedRoomData = () => {
        if (!selectedRoom) return null;
        return rooms.find(r => r.id === selectedRoom);
    };

    const selectedRoomData = getSelectedRoomData();

    return (
        <div className="rrm-container">
            <PageHeader title="Reading Room Management" onBack={onBack} />

            <main className="rrm-body">
                <h1 className="rrm-page-title">Reading Room Management</h1>

                {message && (
                    <p className={`rrm-message ${message.includes('Error') ? 'error' : 'success'}`}>
                        {message}
                    </p>
                )}

                {/* Create New Room Form */}
                <section className="rrm-create-section">
                    <h2 className="rrm-section-title">Create New Room</h2>
                    <form onSubmit={handleCreateRoom}>
                        <div className="rrm-form-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
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
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button type="submit" className="cta-button cta-button--primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minWidth: '200px' }}>
                                {loading ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'Create Room'}
                            </button>
                        </div>
                    </form>
                </section>

                {/* All Rooms List */}
                <section className="rrm-rooms-section">
                    <h2 className="rrm-section-title">All Rooms ({rooms.length})</h2>
                    <div className="rrm-rooms-grid">
                        {rooms.map(room => {
                            const elements = room.elements || [];
                            const seats = elements.filter(e => !e.type || e.type === 'seat');
                            const roomAssignments = seatAssignments.filter(a => a.roomId === room.id);
                            const assignedCount = roomAssignments.length;
                            const unassignedCount = seats.length - assignedCount;

                            return (
                                <div
                                    key={room.id}
                                    className="rrm-room-card"
                                    onClick={() => openRoomModal(room.id)}
                                >
                                    <div className="rrm-room-header">
                                        <h3 className="rrm-room-name">{room.name}</h3>
                                        <p className="rrm-room-type">
                                            {room.type === 'ac' ? 'AC' : 'Non-AC'} {room.isLocked && '• Locked'}
                                        </p>
                                    </div>
                                    <div className="rrm-room-stats">
                                        <div>Total Seats: {seats.length}</div>
                                        <div className="rrm-stat-assigned">Assigned: {assignedCount}</div>
                                        <div className="rrm-stat-available">Available: {unassignedCount}</div>
                                    </div>
                                </div>
                            );
                        })}

                        {rooms.length === 0 && (
                            <p className="rrm-empty-state">
                                No rooms yet. Create your first room above.
                            </p>
                        )}
                    </div>
                </section>
            </main>

            {/* Room Details Modal */}
            {showRoomModal && selectedRoomData && (
                <div className="rrm-modal-overlay">
                    <div className="rrm-modal-content">
                        {/* Modal Header */}
                        <div className="rrm-modal-header">
                            <div>
                                <h2 className="rrm-modal-title">{selectedRoomData.name}</h2>
                                <p className="rrm-modal-subtitle">
                                    {selectedRoomData.type === 'ac' ? 'AC Room' : 'Non-AC Room'}
                                    {selectedRoomData.isLocked ? ' • Layout Locked' : ' • Edit Mode'}
                                </p>
                            </div>
                            <button
                                onClick={closeRoomModal}
                                className="rrm-close-btn"
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="rrm-modal-body">
                            {/* Main Content Area - Left Side */}
                            <div className="rrm-main-content">
                                {message && (
                                    <div className="rrm-floating-message">
                                        <div className={`rrm-floating-message-content ${message.includes('Error') ? 'error' : 'success'}`}>
                                            {message}
                                        </div>
                                    </div>
                                )}


                                {/* Add Element Form (only when unlocked) */}
                                {!selectedRoomData.isLocked && (
                                    <section className="rrm-add-element-section">
                                        <h3 className="rrm-add-element-title">Add Element</h3>
                                        <form onSubmit={handleAddElement} className="rrm-element-form">
                                            <label className="input-field">
                                                <span className="input-field__label">Type</span>
                                                <select
                                                    value={elementForm.type}
                                                    onChange={(e) => setElementForm({ ...elementForm, type: e.target.value })}
                                                    style={{ padding: '10px', fontFamily: 'inherit', fontSize: 'inherit' }}
                                                >
                                                    <option value="seat">Seat</option>
                                                    <option value="toilet">Toilet</option>
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
                                            <button type="submit" className="cta-button cta-button--primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                {loading ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'Add'}
                                            </button>
                                        </form>
                                    </section>
                                )}

                                {/* Room Canvas */}
                                <section className="rrm-canvas-section">
                                    <p className="rrm-canvas-hint">
                                        {selectedRoomData.isLocked
                                            ? 'Click on vacant seats to assign students. Click assigned seats to view details.'
                                            : 'Drag elements to reposition. Double-click to delete.'}
                                    </p>

                                    <div className="rrm-canvas-wrapper">
                                        <div
                                            className={`rrm-canvas-container ${isDragging ? 'dragging' : ''}`}
                                            style={{
                                                width: `${selectedRoomData.width}px`,
                                                height: `${selectedRoomData.height}px`,
                                                transform: `scale(${canvasScale})`
                                            }}
                                            onMouseMove={handleMouseMove}
                                            onMouseUp={handleMouseUp}
                                            onMouseLeave={handleMouseUp}
                                        >
                                            {/* Controls inside room canvas */}
                                            <div className="rrm-canvas-controls">
                                                <button
                                                    onClick={() => handleToggleLock(selectedRoom)}
                                                    className="rrm-canvas-btn"
                                                    title={selectedRoomData.isLocked ? 'Unlock Layout' : 'Lock Layout'}
                                                >
                                                    {selectedRoomData.isLocked ? '🔓' : '🔒'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRoom(selectedRoom)}
                                                    className="rrm-canvas-btn delete"
                                                    title="Delete Room"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                            {(() => {
                                                const elements = selectedRoomData.elements || [];
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
                                    </div>
                                </section>
                            </div>

                            {/* Right Side Panel - Assignment Mode */}
                            {selectedRoomData.isLocked && assignmentMode && (
                                <div style={{
                                    width: '320px',
                                    borderLeft: '1px solid #ddd',
                                    paddingLeft: '20px',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <h3 style={{ margin: 0 }}>Assign Seat</h3>
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
                                    <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
                                        Select a student to assign to the selected seat
                                    </p>

                                    {/* Search Bar */}
                                    <div style={{ marginBottom: '15px' }}>
                                        <input
                                            type="text"
                                            placeholder="Search by MRR number..."
                                            value={searchQuery || ''}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                fontSize: '14px',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>

                                    <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: '10px', alignContent: 'start' }}>
                                        {verifiedUsers
                                            .filter(u => !seatAssignments.some(a => a.userId === u.id))
                                            .filter(u => !searchQuery || (u.mrrNumber && u.mrrNumber.toLowerCase().includes(searchQuery.toLowerCase())))
                                            .map(student => (
                                                <div
                                                    key={student.id}
                                                    onClick={() => handleAssignStudent(student.id, assignmentMode)}
                                                    style={{
                                                        padding: '12px',
                                                        border: '1px solid #ddd',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        backgroundColor: 'white',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#f0fff0';
                                                        e.currentTarget.style.borderColor = '#4caf50';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'white';
                                                        e.currentTarget.style.borderColor = '#ddd';
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{student.name}</div>
                                                    <div style={{ fontSize: '12px', color: '#666' }}>MRR: {student.mrrNumber}</div>
                                                </div>
                                            ))
                                        }
                                        {verifiedUsers.filter(u => !seatAssignments.some(a => a.userId === u.id)).filter(u => !searchQuery || (u.mrrNumber && u.mrrNumber.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && (
                                            <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                                                {searchQuery ? 'No students found matching your search' : 'No available students'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
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
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1100,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        padding: '0',
                        maxWidth: '600px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '24px',
                            borderBottom: '1px solid #e0e0e0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#f8f9fa'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Student Details</h3>
                            <button
                                onClick={() => setShowStudentModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '28px',
                                    cursor: 'pointer',
                                    lineHeight: '1',
                                    padding: '0',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#666',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#e0e0e0';
                                    e.currentTarget.style.color = '#333';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#666';
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '24px' }}>
                            {/* Student Photo and Basic Info Section */}
                            <div style={{
                                display: 'flex',
                                gap: '20px',
                                marginBottom: '24px',
                                flexWrap: 'wrap'
                            }}>
                                {/* Photo */}
                                {selectedStudent.photoUrl && (
                                    <div style={{ flex: '0 0 auto' }}>
                                        <img
                                            src={selectedStudent.photoUrl}
                                            alt={selectedStudent.name}
                                            style={{
                                                width: '120px',
                                                height: '120px',
                                                objectFit: 'cover',
                                                borderRadius: '12px',
                                                border: '3px solid #e0e0e0',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Name and MRR */}
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <h2 style={{
                                        margin: '0 0 8px 0',
                                        fontSize: '24px',
                                        fontWeight: '600',
                                        color: '#333'
                                    }}>
                                        {selectedStudent.name}
                                    </h2>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '6px 12px',
                                        backgroundColor: '#e3f2fd',
                                        color: '#1976d2',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        marginBottom: '12px'
                                    }}>
                                        {selectedStudent.mrrNumber}
                                    </div>

                                    {/* Verification Badge */}
                                    {selectedStudent.verified && (
                                        <div style={{
                                            display: 'inline-block',
                                            marginLeft: '8px',
                                            padding: '6px 12px',
                                            backgroundColor: '#e8f5e9',
                                            color: '#2e7d32',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}>
                                            ✓ Verified
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div style={{
                                marginBottom: '24px',
                                padding: '16px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '8px'
                            }}>
                                <h4 style={{
                                    margin: '0 0 12px 0',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#666',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Contact Information
                                </h4>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>Email</div>
                                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{selectedStudent.email}</div>
                                    </div>
                                    {selectedStudent.phoneNumber && (
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>Phone</div>
                                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{selectedStudent.phoneNumber}</div>
                                        </div>
                                    )}
                                    {selectedStudent.dateOfBirth && (
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>Date of Birth</div>
                                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
                                                {new Date(selectedStudent.dateOfBirth).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Interests */}
                            {selectedStudent.interestedIn && Array.isArray(selectedStudent.interestedIn) && selectedStudent.interestedIn.length > 0 && (
                                <div style={{ marginBottom: '24px' }}>
                                    <h4 style={{
                                        margin: '0 0 12px 0',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#666',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Interests
                                    </h4>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {selectedStudent.interestedIn.map((interest, index) => (
                                            <span
                                                key={index}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: '#fff3e0',
                                                    color: '#e65100',
                                                    borderRadius: '20px',
                                                    fontSize: '13px',
                                                    fontWeight: '500',
                                                    border: '1px solid #ffe0b2'
                                                }}
                                            >
                                                {interest}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Seat Assignment Information */}
                            {selectedStudent.assignment && (
                                <div style={{
                                    marginBottom: '24px',
                                    padding: '16px',
                                    backgroundColor: '#e8f5e9',
                                    borderRadius: '8px',
                                    border: '1px solid #c8e6c9'
                                }}>
                                    <h4 style={{
                                        margin: '0 0 12px 0',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#2e7d32',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Seat Assignment
                                    </h4>
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '13px', color: '#555' }}>Room:</span>
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>
                                                {selectedStudent.assignment.roomName}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '13px', color: '#555' }}>Seat:</span>
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>
                                                {selectedStudent.assignment.seatLabel}
                                            </span>
                                        </div>
                                        {selectedStudent.assignment.assignedAt && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '13px', color: '#555' }}>Assigned:</span>
                                                <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>
                                                    {new Date(selectedStudent.assignment.assignedAt).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Additional Metadata */}
                            {(selectedStudent.submittedAt || selectedStudent.updatedAt) && (
                                <div style={{
                                    marginBottom: '24px',
                                    padding: '12px',
                                    backgroundColor: '#fafafa',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: '#666'
                                }}>
                                    {selectedStudent.submittedAt && (
                                        <div style={{ marginBottom: '4px' }}>
                                            Registered: {new Date(selectedStudent.submittedAt).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </div>
                                    )}
                                    {selectedStudent.updatedAt && (
                                        <div>
                                            Last Updated: {new Date(selectedStudent.updatedAt).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid #e0e0e0',
                            display: 'flex',
                            gap: '12px',
                            backgroundColor: '#f8f9fa'
                        }}>
                            <button
                                onClick={() => handleUnassignStudent(selectedStudent.assignment?.id)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 4px rgba(244,67,54,0.2)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#d32f2f';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(244,67,54,0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f44336';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(244,67,54,0.2)';
                                }}
                            >
                                Unassign Seat
                            </button>
                            <button
                                onClick={() => setShowStudentModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: '#757575',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#616161';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#757575';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
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

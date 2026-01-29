import { useState, useEffect } from 'react';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, runTransaction, onSnapshot, collection, query, where, getDocs, getDoc, updateDoc, arrayUnion, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../auth/AuthProvider';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Discussion.css';
import '../../styles/StandardLayout.css';
import { useLoading } from '../../context/GlobalLoadingContext';
import PageHeader from '../../components/PageHeader';

const SLOTS = [
    { id: '06', label: '6:00 AM - 9:00 AM', startHour: 6 },
    { id: '09', label: '9:00 AM - 12:00 PM', startHour: 9 },
    { id: '12', label: '12:00 PM - 3:00 PM', startHour: 12 },
    { id: '15', label: '3:00 PM - 6:00 PM', startHour: 15 },
    { id: '18', label: '6:00 PM - 9:00 PM', startHour: 18 }
];

const Discussion = ({ onBack }) => {
    const { user } = useAuth();
    const { setIsLoading } = useLoading();

    useEffect(() => {
        const verifyMembership = async () => {
            if (!user) return;
            try {
                // Call the centralized eligibility Cloud Function
                const verifyEligibility = httpsCallable(functions, 'verifyDiscussionEligibility');
                const result = await verifyEligibility({ userId: user.uid });
                const { eligible, reason } = result.data;

                if (!eligible) {
                    console.log("Ineligible for discussion room:", reason);
                    if (reason) {
                        alert(reason);
                    }
                    if (onBack) onBack();
                }
            } catch (error) {
                console.error("Error verifying membership via Cloud Function:", error);
                // Fallback to minimal client-side check if function fails
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const isExpired = userData.nextPaymentDue && new Date(userData.nextPaymentDue) < new Date();
                        const hasActiveSeat = userData.registrationCompleted && userData.currentSeat && !isExpired;

                        if (!hasActiveSeat) {
                            if (onBack) onBack();
                        }
                    }
                } catch (fallbackError) {
                    console.error("Fallback verification failed:", fallbackError);
                    if (onBack) onBack();
                }
            }
        };
        verifyMembership();
    }, [user, onBack]);


    const [bookings, setBookings] = useState({});

    // UI State
    const [selectedSlot, setSelectedSlot] = useState(null); // { id, label }
    const [viewMode, setViewMode] = useState('list'); // 'list', 'book', 'details'

    // Form states
    const [groupName, setGroupName] = useState('');
    const [newMemberMrr, setNewMemberMrr] = useState('');
    const [pendingMembers, setPendingMembers] = useState([]);

    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get the "logical" date string (YYYY-MM-DD)
    // We stick to the 6 AM cycle logic for consistency, or just use calendar date?
    // "from 6-9... till 9" implies a daily cycle. 
    // Let's keep the logic: if < 6 AM, it's previous day's cycle (though slots start at 6).
    const getLogicalDateString = () => {
        const now = new Date();
        const currentHour = now.getHours();
        if (currentHour < 6) {
            now.setDate(now.getDate() - 1);
        }
        return now.toISOString().split('T')[0];
    };

    useEffect(() => {
        setIsLoading(true);
        const dateStr = getLogicalDateString();
        // Query all bookings for this date
        const q = query(
            collection(db, 'discussion_rooms'),
            where('date', '==', dateStr)
        );

        // Standard Batch Reveal Pattern
        getDocs(q).finally(() => {
            setIsLoading(false);
        });

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newBookings = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.slotId) {
                    newBookings[data.slotId] = data;
                }
            });
            setBookings(newBookings);
        }, (err) => {
            console.error("Error listening to bookings:", err);
            setError("Failed to load bookings.");
        });

        return () => unsubscribe();
    }, []);

    // Check if a user is already part of 2 or more bookings for the day (as booker or member)
    const getUserBookingCount = (uid) => {
        return Object.values(bookings).filter(booking => {
            if (booking.bookedBy === uid) return true;
            if (booking.members && booking.members.some(m => m.uid === uid)) return true;
            return false;
        }).length;
    };

    const isUserAtMaxBookings = (uid) => {
        return getUserBookingCount(uid) >= 2;
    };

    const lookupUserByMrr = async (mrr) => {
        if (!mrr.trim()) return null;
        try {
            const q = query(collection(db, 'users'), where('mrrNumber', '==', mrr.trim()));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();
                return {
                    uid: userDoc.id,
                    name: userData.displayName || userData.email?.split('@')[0] || 'User',
                    mrrNumber: userData.mrrNumber
                };
            }
            return null;
        } catch (err) {
            console.error("Error looking up user:", err);
            return null;
        }
    };

    const handleAddPendingMember = async (e) => {
        e.preventDefault();
        setError('');
        if (!newMemberMrr.trim()) return;

        // Check if already added
        if (pendingMembers.some(m => m.mrrNumber === newMemberMrr.trim())) {
            setError('Member already added to list.');
            return;
        }
        // Check if it's self
        // We don't strictly have MRR for current user in context easily without fetching, 
        // but let's assume they might add themselves which is redundant but harmless, 
        // or we can skip this check.

        setIsSubmitting(true);
        const member = await lookupUserByMrr(newMemberMrr);
        setIsSubmitting(false);

        if (member) {
            // Check if user is already at max bookings (2 per day)
            if (isUserAtMaxBookings(member.uid)) {
                setError(`Member ${member.name} has already reached the maximum of 2 bookings for today.`);
                return;
            }

            setPendingMembers(prev => [...prev, member]);
            setNewMemberMrr('');
        } else {
            setError('User not found with this MRR ID.');
        }
    };

    const handleRemovePendingMember = (index) => {
        const newPending = [...pendingMembers];
        newPending.splice(index, 1);
        setPendingMembers(newPending);
    };

    const handleSlotClick = (slot) => {
        setSelectedSlot(slot);
        setError('');
        setSuccessMsg('');
        setGroupName('');
        setPendingMembers([]);
        setNewMemberMrr('');

        // Count how many rooms are booked for this slot
        const slotBookings = Object.values(bookings).filter(b => b.slotId === slot.id);
        const bookedRoomCount = slotBookings.length;

        // Check if user is part of any booking for this slot
        const userBookingForSlot = slotBookings.find(booking =>
            booking.bookedBy === user.uid ||
            (booking.members && booking.members.some(m => m.uid === user.uid))
        );

        if (userBookingForSlot) {
            // User is part of a booking in this slot, show details
            setViewMode('details');
        } else if (bookedRoomCount < 7) {
            // There are rooms available, allow booking
            setViewMode('book');
        } else {
            // All rooms are full
            alert('All discussion rooms (D1-D7) are fully booked for this time slot. Please try another slot.');
        }
    };

    const handleBookRoom = async (e) => {
        e.preventDefault();
        if (!user || !selectedSlot) return;

        if (!groupName.trim()) {
            setError('Please enter a group name.');
            return;
        }

        // 1. Check if current user is at max bookings (2 per day)
        if (isUserAtMaxBookings(user.uid)) {
            setError("You have already reached the maximum of 2 bookings for today.");
            return;
        }

        // 2. Check if any pending members are at max bookings
        for (const member of pendingMembers) {
            if (isUserAtMaxBookings(member.uid)) {
                setError(`Member ${member.name} has already reached the maximum of 2 bookings for today.`);
                return;
            }
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Fetch current user's MRR from Firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            let userMrr = 'N/A';
            if (userDocSnap.exists()) {
                userMrr = userDocSnap.data().mrrNumber || 'N/A';
            }

            // Create leader member object
            const leaderMember = {
                uid: user.uid,
                name: `${user.displayName || 'User'} (Leader)`,
                mrrNumber: userMrr
            };

            // Combine leader with pending members
            const allMembers = [leaderMember, ...pendingMembers];

            // Call backend function to book the room
            const bookDiscussionRoom = httpsCallable(functions, 'bookDiscussionRoom');
            const result = await bookDiscussionRoom({
                date: getLogicalDateString(),
                slotId: selectedSlot.id,
                slotLabel: selectedSlot.label,
                teamName: groupName,
                members: allMembers
            });

            if (result.data.success) {
                // Show success message with room assignment
                alert(`Booking successful! Your room is ${result.data.roomId}`);
                setGroupName('');
                setPendingMembers([]);
                setViewMode('details');
            }
        } catch (err) {
            console.error("Booking failed:", err);
            setError(err.message || 'Failed to book the room. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddMemberToExisting = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!newMemberMrr.trim()) return;

        const currentBooking = bookings[selectedSlot.id];
        if (currentBooking.members && currentBooking.members.some(m => m.mrrNumber === newMemberMrr.trim())) {
            setError('Member is already in the group.');
            return;
        }

        setIsSubmitting(true);
        const member = await lookupUserByMrr(newMemberMrr);

        if (member) {
            try {
                // Check if user is at max bookings (2 per day)
                if (isUserAtMaxBookings(member.uid)) {
                    setError(`Member ${member.name} has already reached the maximum of 2 bookings for today.`);
                    setIsSubmitting(false);
                    return;
                }

                const slotDocId = `${getLogicalDateString()}_${selectedSlot.id}_${booking.roomId}`;
                const slotRef = doc(db, 'discussion_rooms', slotDocId);

                await updateDoc(slotRef, {
                    members: arrayUnion(member)
                });

                setNewMemberMrr('');
                setSuccessMsg('Member added successfully!');
                setTimeout(() => setSuccessMsg(''), 3000);
            } catch (err) {
                console.error("Error adding member:", err);
                setError("Failed to add member.");
            }
        } else {
            setError('User not found with this MRR ID.');
        }
        setIsSubmitting(false);
    };

    const handleCancelBooking = async () => {
        if (window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
            try {
                const dateStr = getLogicalDateString();
                const docId = `${dateStr}_${selectedSlot.id}_${booking.roomId}`;
                const docRef = doc(db, 'discussion_rooms', docId);
                await deleteDoc(docRef);
                setViewMode('list');
                setSelectedSlot(null);
            } catch (err) {
                console.error("Error cancelling booking:", err);
                setError("Failed to cancel booking.");
            }
        }
    };


    // Render List of Slots
    if (viewMode === 'list') {
        return (
            <div className="std-container">
                <PageHeader title="Discussion Room" onBack={onBack} />

                <main className="std-body">
                    <div className="discussion-card">
                        <h1 className="page-title">
                            Discussion Room Slots
                        </h1>
                        <p className="page-subtitle">
                            Select a time slot to book or view details.
                        </p>

                        <div className="slots-list">
                            {SLOTS.map(slot => {
                                // Get all bookings for this slot
                                const slotBookings = Object.values(bookings).filter(b => b.slotId === slot.id);
                                const bookedRoomCount = slotBookings.length;
                                const availableRoomCount = 7 - bookedRoomCount;

                                // Check if user has a booking in this slot
                                const userBooking = slotBookings.find(booking =>
                                    booking.bookedBy === user.uid ||
                                    (booking.members && booking.members.some(m => m.uid === user.uid))
                                );

                                const hasAvailableRooms = availableRoomCount > 0;
                                const isMyBooking = !!userBooking;

                                return (
                                    <div
                                        key={slot.id}
                                        onClick={() => handleSlotClick(slot)}
                                        className={`slot-card ${!hasAvailableRooms ? 'booked' : ''} ${isMyBooking ? 'my-booking' : ''}`}
                                    >
                                        <div className="slot-info">
                                            <h3 className="slot-label">{slot.label}</h3>
                                            {isMyBooking ? (
                                                <p className="slot-status">
                                                    Your Room: <strong>{userBooking.roomId}</strong> - <strong>{userBooking.teamName}</strong>
                                                    <span className="my-group-label"> (Your Group)</span>
                                                </p>
                                            ) : (
                                                <p className="slot-status" style={{ color: hasAvailableRooms ? 'var(--discussion-gray)' : 'inherit' }}>
                                                    {availableRoomCount > 0
                                                        ? `${availableRoomCount} of 7 rooms available`
                                                        : 'All rooms booked'}
                                                </p>
                                            )}
                                        </div>
                                        <div className="slot-action">
                                            <span className="action-badge">
                                                {isMyBooking ? 'Manage' : (hasAvailableRooms ? 'Book Now' : 'Full')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>
        );
    }



    // Render Booking Form or Details
    // Find the user's booking for this slot (if any)
    const slotBookings = Object.values(bookings).filter(b => b.slotId === selectedSlot?.id);
    const booking = slotBookings.find(b =>
        b.bookedBy === user.uid ||
        (b.members && b.members.some(m => m.uid === user.uid))
    );
    const isBooked = !!booking;
    const isMyTeam = isBooked && (booking.bookedBy === user.uid || (booking.members && booking.members.some(m => m.uid === user.uid)));
    const bookedRoomCount = slotBookings.length;
    const availableRoomCount = 7 - bookedRoomCount;

    return (
        <div className="std-container">
            <PageHeader title="Discussion Room" onBack={() => setViewMode('list')} />

            <main className="std-body">
                <div className="discussion-card">
                    <h2 className="page-title">{selectedSlot?.label}</h2>
                    <p className="page-subtitle">
                        {isBooked
                            ? `${booking.teamName} - Room ${booking.roomId}`
                            : `${availableRoomCount} of 7 rooms available`}
                    </p>

                    {/* BOOKING FORM */}
                    {!isBooked && (
                        <div className="form-container">
                            <form onSubmit={handleBookRoom}>
                                <div className="input-group">
                                    <label className="input-label">Group Name</label>
                                    <input
                                        type="text"
                                        className="text-input"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder="Enter your group name"
                                        required
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Group Members (Optional)</label>
                                    <div className="member-add-row">
                                        <input
                                            type="text"
                                            className="text-input"
                                            value={newMemberMrr}
                                            onChange={(e) => setNewMemberMrr(e.target.value)}
                                            placeholder="Enter MRR ID"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddPendingMember(e);
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-black"
                                            onClick={handleAddPendingMember}
                                            disabled={isSubmitting}
                                        >
                                            Add
                                        </button>
                                    </div>

                                    {pendingMembers.length > 0 && (
                                        <div className="chips-container">
                                            {pendingMembers.map((member, index) => (
                                                <div key={index} className="chip">
                                                    {member.name}
                                                    <button
                                                        type="button"
                                                        className="chip-remove"
                                                        onClick={() => handleRemovePendingMember(index)}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {error && <div className="error-msg">{error}</div>}

                                <button
                                    type="submit"
                                    className="btn btn-black btn-block"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Booking...' : 'Book Slot'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* DETAILS VIEW - MY TEAM */}
                    {isBooked && isMyTeam && (
                        <div className="form-container" style={{ maxWidth: 'unset' }}>
                            <div className="details-banner">
                                <h3>Room <strong>{booking.roomId}</strong>: <strong>{booking.teamName}</strong></h3>
                            </div>

                            <h3 className="section-title">Group Members</h3>

                            <div style={{ marginBottom: '1.875rem' }}>
                                {booking.members && booking.members.length > 0 && (
                                    <ul className="members-list">
                                        {booking.members.filter(m => m && (m.name || typeof m === 'string')).map((member, idx) => {
                                            const name = member.name || (typeof member === 'string' ? member : 'Unknown');
                                            const mrr = member.mrrNumber || '';
                                            return (
                                                <li key={idx} className="member-item">
                                                    <div className="member-info">
                                                        <span className="member-name">{name}</span>
                                                        {mrr && <span className="member-mrr">MRR ID: {mrr}</span>}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div className="add-member-section">
                                <h4 className="add-member-title">Add Group Member</h4>
                                <div className="member-add-row">
                                    <input
                                        type="text"
                                        className="text-input"
                                        value={newMemberMrr}
                                        onChange={(e) => setNewMemberMrr(e.target.value)}
                                        placeholder="Enter MRR ID"
                                    />
                                    <button
                                        className="btn btn-black"
                                        onClick={handleAddMemberToExisting}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? '...' : 'Add'}
                                    </button>
                                </div>
                                {error && <p className="error-msg" style={{ marginTop: '0.625rem' }}>{error}</p>}
                                {successMsg && <p className="success-msg" style={{ marginTop: '0.625rem' }}>{successMsg}</p>}
                            </div>

                            {booking.bookedBy === user.uid && (
                                <div style={{ marginTop: '1.875rem', textAlign: 'center' }}>
                                    <button
                                        className="btn btn-outline-red btn-small"
                                        onClick={handleCancelBooking}
                                    >
                                        Cancel Booking
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* DETAILS VIEW - OTHERS */}
                    {isBooked && !isMyTeam && (
                        <div className="others-booking-view">
                            <h2>Booked</h2>
                            <p>
                                This slot is attained by <strong>{booking.teamName}</strong>
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Discussion;

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
                    // User is ineligible for discussion room
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


    const [bookings, setBookings] = useState({}); // { slotId: [booking1, booking2] }

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
                    if (!newBookings[data.slotId]) {
                        newBookings[data.slotId] = [];
                    }
                    newBookings[data.slotId].push({ id: doc.id, ...data });
                }
            });
            setBookings(newBookings);
        }, (err) => {
            console.error("Error listening to bookings:", err);
            setError("Failed to load bookings.");
        });

        return () => unsubscribe();
    }, []);

    // Check if the current user has a booking in a specific slot
    const getMyBookingInSlot = (slotId) => {
        const slotBookings = bookings[slotId] || [];
        return slotBookings.find(b =>
            b.bookedBy === user.uid || (b.members && b.members.some(m => m.uid === user.uid))
        );
    };

    // Check if a user is already part of any booking for the day (across all slots)
    const isUserAlreadyBookedToday = (uid) => {
        return Object.values(bookings).flat().some(booking => {
            if (booking.bookedBy === uid) return true;
            if (booking.members && booking.members.some(m => m.uid === uid)) return true;
            return false;
        });
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

        setIsSubmitting(true);
        const member = await lookupUserByMrr(newMemberMrr);
        setIsSubmitting(false);

        if (member) {
            // Check if user is already booked today
            if (isUserAlreadyBookedToday(member.uid)) {
                setError(`Member ${member.name} is already part of another group today.`);
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

        const myBooking = getMyBookingInSlot(slot.id);

        if (myBooking) {
            setViewMode('details'); // View MY booking details
        } else {
            // If I don't have a booking here, can I book?
            // Only if slot is not full (7 rooms) AND I haven't booked 2 slots today (handled by cloud function check, but good to know)
            // AND I don't have a booking in this slot already (handled above)
            // So we go to 'book' mode, and let 'book' mode show "Full" if full.
            setViewMode('book');
        }
    };

    const handleBookRoom = async (e) => {
        e.preventDefault();
        if (!user || !selectedSlot) return;

        if (!groupName.trim()) {
            setError('Please enter a group name.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Fetch current user's MRR from Firestore just for local object construction if needed, 
            // but Cloud Function will handle the heavy lifting.
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            let userMrr = 'N/A';
            if (userDocSnap.exists()) {
                userMrr = userDocSnap.data().mrrNumber || 'N/A';
            }

            // Create leader member object (local construction for potential optimistic UI, but relying on CF response)
            const leaderMember = {
                uid: user.uid,
                name: `${user.displayName || 'User'} (Leader)`,
                mrrNumber: userMrr
            };

            const allMembers = [leaderMember, ...pendingMembers];

            // Call Cloud Function
            const bookDiscussionRoom = httpsCallable(functions, 'bookDiscussionRoom');
            await bookDiscussionRoom({
                date: getLogicalDateString(),
                slotId: selectedSlot.id,
                slotLabel: selectedSlot.label,
                teamName: groupName,
                members: allMembers
            });

            setGroupName('');
            setPendingMembers([]);
            setViewMode('details');
            setSuccessMsg('Booking successful!');
        } catch (err) {
            console.error("Booking failed:", err);
            setError(err.message || "Failed to book room.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddMemberToExisting = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        const myBooking = getMyBookingInSlot(selectedSlot.id);
        if (!myBooking) return;

        if (!newMemberMrr.trim()) return;

        if (myBooking.members && myBooking.members.some(m => m.mrrNumber === newMemberMrr.trim())) {
            setError('Member is already in the group.');
            return;
        }

        setIsSubmitting(true);
        const member = await lookupUserByMrr(newMemberMrr);

        if (member) {
            try {
                if (isUserAlreadyBookedToday(member.uid)) {
                    setError(`Member ${member.name} is already part of another group today.`);
                    setIsSubmitting(false);
                    return;
                }

                // Update Firestore Document directly (Still okay for simple updates, or should we make a CF?)
                // Since `bookDiscussionRoom` creates the doc, we can update it directly if we have permission.
                // Assuming clients can update their own bookings.
                const bookingRef = doc(db, 'discussion_rooms', myBooking.id); // Using the doc ID we stored

                await updateDoc(bookingRef, {
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
            const myBooking = getMyBookingInSlot(selectedSlot.id);
            if (!myBooking) return;

            try {
                const docRef = doc(db, 'discussion_rooms', myBooking.id);
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
                <PageHeader title="Discussion" onBack={onBack} />

                <main className="std-body">
                    <div className="discussion-card">
                        <h1 className="page-title">
                            Book a Slot
                        </h1>
                        <p className="page-subtitle">
                            Reserve a 3-hour session for your group.
                        </p>

                        <div className="slots-list">
                            {SLOTS.filter(slot => {
                                const now = new Date();
                                const currentHour = now.getHours();
                                // Slot ends at startHour + 3
                                // If currentHour >= endHour, the slot is over.
                                // e.g. 12-3 PM (start 12). Ends at 15. If now is 15 (3 PM), it is over.
                                return (slot.startHour + 3) > currentHour;
                            }).map(slot => {
                                const slotBookings = bookings[slot.id] || [];
                                const totalBooked = slotBookings.length;
                                const isFull = totalBooked >= 7;
                                const myBooking = getMyBookingInSlot(slot.id);
                                const isMyBooking = !!myBooking;

                                return (
                                    <div
                                        key={slot.id}
                                        onClick={() => handleSlotClick(slot)}
                                        className={`slot-card ${isFull && !isMyBooking ? 'booked' : ''} ${isMyBooking ? 'my-booking' : ''}`}
                                    >
                                        <div className="slot-info">
                                            <h3 className="slot-label">{slot.label}</h3>
                                            {isMyBooking ? (
                                                <p className="slot-status">
                                                    Reserved: <strong>{myBooking.teamName}</strong>
                                                    <span className="my-group-label">YOU</span>
                                                </p>
                                            ) : (
                                                <p className="slot-status">
                                                    {isFull ? 'Full' : 'Available'}
                                                    {!isFull && <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '5px' }}>({7 - totalBooked} rooms left)</span>}
                                                </p>
                                            )}
                                        </div>
                                        <div className="slot-action">
                                            <span className="action-badge">
                                                {isMyBooking ? 'Edit ›' : (isFull ? 'Full' : 'Book ›')}
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
    const myBooking = getMyBookingInSlot(selectedSlot?.id);
    const hasBooking = !!myBooking;
    const slotBookings = bookings[selectedSlot?.id] || [];
    const isFull = slotBookings.length >= 7;

    return (
        <div className="std-container">
            <PageHeader title="Room Details" onBack={() => setViewMode('list')} forceShowBack={true} />

            <main className="std-body">
                <div className="discussion-card">
                    <h2 className="page-title">{selectedSlot?.label}</h2>
                    <p className="page-subtitle">
                        {hasBooking ? `Group: ${myBooking.teamName}` : (isFull ? 'All rooms are booked' : 'Session is open for booking')}
                    </p>

                    {/* SHOW ASSIGNED ROOM IF IT'S MY BOOKING */}
                    {hasBooking && myBooking.roomId && (
                        <div style={{
                            backgroundColor: '#e0f2f1',
                            color: '#00695c',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            border: '1px solid #b2dfdb',
                            fontWeight: '600',
                            textAlign: 'center'
                        }}>
                            Assigned Room: Room {myBooking.roomId.replace('D', '')}
                        </div>
                    )}

                    {/* BOOKING FORM */}
                    {!hasBooking && !isFull && (
                        <div className="form-container">
                            <form onSubmit={handleBookRoom}>
                                <div className="ios-form-group">
                                    <div className="input-group">
                                        <label className="input-label">Group Name</label>
                                        <input
                                            type="text"
                                            className="text-input"
                                            value={groupName}
                                            onChange={(e) => setGroupName(e.target.value)}
                                            placeholder="Required"
                                            required
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">Add Member (MRR ID)</label>
                                        <div className="member-add-row">
                                            <input
                                                type="text"
                                                className="text-input"
                                                value={newMemberMrr}
                                                onChange={(e) => setNewMemberMrr(e.target.value)}
                                                placeholder="e.g. 1024"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddPendingMember(e);
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="btn-ios-ghost"
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
                                </div>

                                {error && <div className="error-msg">{error}</div>}

                                <div className="ios-actions">
                                    <button
                                        type="submit"
                                        className="btn-ios-primary"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Processing...' : 'Book Room'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* FULL MSG */}
                    {!hasBooking && isFull && (
                        <div className="others-booking-view">
                            <h2>Session Fully Booked</h2>
                            <p>
                                All 7 discussion rooms are currently occupied for this time slot.
                            </p>
                        </div>
                    )}

                    {/* DETAILS VIEW - MY TEAM */}
                    {hasBooking && (
                        <div className="form-container">
                            <h3 className="page-subtitle" style={{ padding: '0 8px', marginBottom: '8px' }}>Members</h3>

                            <ul className="ios-list">
                                {myBooking.members && myBooking.members.length > 0 && (
                                    myBooking.members.filter(m => m && (m.name || typeof m === 'string')).map((member, idx) => {
                                        const name = member.name || (typeof member === 'string' ? member : 'Unknown');
                                        const mrr = member.mrrNumber || '';
                                        return (
                                            <li key={idx} className="ios-list-item">
                                                <div className="member-info">
                                                    <span className="member-name">{name}</span>
                                                    {mrr && <span className="member-mrr">MRR #{mrr}</span>}
                                                </div>
                                            </li>
                                        );
                                    })
                                )}
                            </ul>

                            <h3 className="page-subtitle" style={{ padding: '0 8px', marginBottom: '8px' }}>Management</h3>
                            <div className="ios-form-group">
                                <div className="input-group">
                                    <label className="input-label">Add Member (MRR ID)</label>
                                    <div className="member-add-row">
                                        <input
                                            type="text"
                                            className="text-input"
                                            value={newMemberMrr}
                                            onChange={(e) => setNewMemberMrr(e.target.value)}
                                            placeholder="Invite more"
                                        />
                                        <button
                                            className="btn-ios-ghost"
                                            onClick={handleAddMemberToExisting}
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? '...' : 'Invite'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && <p className="error-msg">{error}</p>}
                            {successMsg && <p className="success-msg">{successMsg}</p>}

                            {myBooking.bookedBy === user.uid && (
                                <div style={{ marginTop: '24px' }}>
                                    <button
                                        className="btn-ios-danger"
                                        onClick={handleCancelBooking}
                                    >
                                        Cancel Session
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Discussion;

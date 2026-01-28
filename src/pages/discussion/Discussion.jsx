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

    // Check if a user is already part of any booking for the day (as booker or member)
    const isUserAlreadyBooked = (uid) => {
        return Object.values(bookings).some(booking => {
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
        // Check if it's self
        // We don't strictly have MRR for current user in context easily without fetching, 
        // but let's assume they might add themselves which is redundant but harmless, 
        // or we can skip this check.

        setIsSubmitting(true);
        const member = await lookupUserByMrr(newMemberMrr);
        setIsSubmitting(false);

        if (member) {
            // Check if user is already booked today
            if (isUserAlreadyBooked(member.uid)) {
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

        if (bookings[slot.id]) {
            setViewMode('details');
        } else {
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

        // 1. Check if current user is already booked today
        if (isUserAlreadyBooked(user.uid)) {
            setError("You are already part of a discussion group for today. You can only join one group per day.");
            return;
        }

        // 2. Check if any pending members are already booked today
        for (const member of pendingMembers) {
            if (isUserAlreadyBooked(member.uid)) {
                setError(`Member ${member.name} is already part of another group today.`);
                return;
            }
        }

        setIsSubmitting(true);
        setError('');

        try {
            const slotDocId = `${getLogicalDateString()}_${selectedSlot.id}`;
            const slotRef = doc(db, 'discussion_rooms', slotDocId);

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

            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(slotRef);
                if (sfDoc.exists()) {
                    throw new Error("This slot has just been booked by someone else.");
                }

                transaction.set(slotRef, {
                    date: getLogicalDateString(),
                    slotId: selectedSlot.id,
                    slotLabel: selectedSlot.label,
                    bookedBy: user.uid,
                    bookerName: user.displayName || 'Unknown',
                    teamName: groupName, // keeping field name for compatibility, UI shows "Group"
                    members: allMembers,
                    createdAt: new Date().toISOString()
                });
            });

            setGroupName('');
            setPendingMembers([]);
            setViewMode('details');
        } catch (err) {
            console.error("Booking failed:", err);
            setError(err.message);
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
                // Check if user is already booked today
                if (isUserAlreadyBooked(member.uid)) {
                    setError(`Member ${member.name} is already part of another group today.`);
                    setIsSubmitting(false);
                    return;
                }

                const slotDocId = `${getLogicalDateString()}_${selectedSlot.id}`;
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
                const docId = `${dateStr}_${selectedSlot.id}`;
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
                            {SLOTS.map(slot => {
                                const booking = bookings[slot.id];
                                const isBooked = !!booking;
                                const isMyBooking = isBooked && (booking.bookedBy === user.uid || (booking.members && booking.members.some(m => m.uid === user.uid)));

                                return (
                                    <div
                                        key={slot.id}
                                        onClick={() => handleSlotClick(slot)}
                                        className={`slot-card ${isBooked ? 'booked' : ''} ${isMyBooking ? 'my-booking' : ''}`}
                                    >
                                        <div className="slot-info">
                                            <h3 className="slot-label">{slot.label}</h3>
                                            {isBooked ? (
                                                <p className="slot-status">
                                                    Reserved: <strong>{booking.teamName}</strong>
                                                    {isMyBooking && <span className="my-group-label">YOU</span>}
                                                </p>
                                            ) : (
                                                <p className="slot-status">Available</p>
                                            )}
                                        </div>
                                        <div className="slot-action">
                                            <span className="action-badge">
                                                {isBooked ? (isMyBooking ? 'Edit ›' : 'Details ›') : 'Book ›'}
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
    const booking = bookings[selectedSlot?.id];
    const isBooked = !!booking;
    const isMyTeam = isBooked && (booking.bookedBy === user.uid || (booking.members && booking.members.some(m => m.uid === user.uid)));

    return (
        <div className="std-container">
            <PageHeader title="Room Details" onBack={() => setViewMode('list')} />

            <main className="std-body">
                <div className="discussion-card">
                    <h2 className="page-title">{selectedSlot?.label}</h2>
                    <p className="page-subtitle">
                        {isBooked ? `Group: ${booking.teamName}` : 'Session is open for booking'}
                    </p>

                    {/* BOOKING FORM */}
                    {!isBooked && (
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

                    {/* DETAILS VIEW - MY TEAM */}
                    {isBooked && isMyTeam && (
                        <div className="form-container">
                            <h3 className="page-subtitle" style={{ padding: '0 8px', marginBottom: '8px' }}>Members</h3>
                            
                            <ul className="ios-list">
                                {booking.members && booking.members.length > 0 && (
                                    booking.members.filter(m => m && (m.name || typeof m === 'string')).map((member, idx) => {
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

                            {booking.bookedBy === user.uid && (
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

                    {/* DETAILS VIEW - OTHERS */}
                    {isBooked && !isMyTeam && (
                        <div className="others-booking-view">
                            <h2>Session Booked</h2>
                            <p>
                                This slot is currently occupied by<br/>
                                <strong style={{ color: 'var(--ios-text)' }}>{booking.teamName}</strong>
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Discussion;

import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, runTransaction, onSnapshot, collection, query, where, getDocs, getDoc, updateDoc, arrayUnion, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../auth/AuthProvider';
import LoadingSpinner from '../../components/LoadingSpinner';

const SLOTS = [
    { id: '06', label: '6:00 AM - 9:00 AM', startHour: 6 },
    { id: '09', label: '9:00 AM - 12:00 PM', startHour: 9 },
    { id: '12', label: '12:00 PM - 3:00 PM', startHour: 12 },
    { id: '15', label: '3:00 PM - 6:00 PM', startHour: 15 },
    { id: '18', label: '6:00 PM - 9:00 PM', startHour: 18 }
];

const Discussion = ({ onBack }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);


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
        const dateStr = getLogicalDateString();
        // Query all bookings for this date
        const q = query(
            collection(db, 'discussion_rooms'),
            where('date', '==', dateStr)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newBookings = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.slotId) {
                    newBookings[data.slotId] = data;
                }
            });
            setBookings(newBookings);
            setLoading(false);
        }, (err) => {
            console.error("Error listening to bookings:", err);
            setError("Failed to load bookings.");
            setLoading(false);
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

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <LoadingSpinner size="40" stroke="3" color="#333" />
            </div>
        );
    }

    // Render List of Slots
    if (viewMode === 'list') {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '20px' }}>
                <button
                    onClick={onBack}
                    style={{
                        marginBottom: '20px',
                        padding: '8px 16px',
                        backgroundColor: '#000',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'block',
                        maxWidth: '800px',
                        margin: '0 auto 20px auto',
                        fontWeight: '500'
                    }}
                >
                    ← Back to Home
                </button>

                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '40px',
                        borderRadius: '0',
                        border: '1px solid #000',
                        textAlign: 'center'
                    }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '10px', color: '#000' }}>
                            Discussion Room Slots
                        </h1>
                        <p style={{ color: '#666', marginBottom: '40px' }}>
                            Select a time slot to book or view details.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {SLOTS.map(slot => {
                                const booking = bookings[slot.id];
                                const isBooked = !!booking;
                                const isMyBooking = isBooked && (booking.bookedBy === user.uid || (booking.members && booking.members.some(m => m.uid === user.uid)));

                                return (
                                    <div
                                        key={slot.id}
                                        onClick={() => handleSlotClick(slot)}
                                        style={{
                                            padding: '20px',
                                            borderRadius: '0',
                                            border: '1px solid #000',
                                            backgroundColor: isBooked ? (isMyBooking ? '#000' : '#fff') : '#fff',
                                            color: isBooked && isMyBooking ? '#fff' : '#000',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isMyBooking) e.currentTarget.style.backgroundColor = '#f5f5f5';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isMyBooking) e.currentTarget.style.backgroundColor = '#fff';
                                        }}
                                    >
                                        <div style={{ textAlign: 'left' }}>
                                            <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'inherit' }}>{slot.label}</h3>
                                            {isBooked ? (
                                                <p style={{ fontSize: '14px', marginTop: '4px', color: 'inherit', opacity: isMyBooking ? 0.8 : 1 }}>
                                                    Booked by: <strong style={{ color: 'inherit' }}>{booking.teamName}</strong>
                                                    {isMyBooking && <span style={{ marginLeft: '8px', fontWeight: 'bold', color: 'inherit' }}>(Your Group)</span>}
                                                </p>
                                            ) : (
                                                <p style={{ fontSize: '14px', marginTop: '4px', color: '#666' }}>Available</p>
                                            )}
                                        </div>
                                        <div>
                                            <span style={{
                                                padding: '6px 12px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                border: isMyBooking ? '1px solid #fff' : '1px solid #000',
                                                backgroundColor: 'transparent',
                                                color: 'inherit'
                                            }}>
                                                {isBooked ? (isMyBooking ? 'Manage' : 'View') : 'Book Now'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render Booking Form or Details
    const booking = bookings[selectedSlot?.id];
    const isBooked = !!booking;
    const isMyTeam = isBooked && (booking.bookedBy === user.uid || (booking.members && booking.members.some(m => m.uid === user.uid)));

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '20px' }}>
            <button
                onClick={() => setViewMode('list')}
                style={{
                    marginBottom: '20px',
                    padding: '8px 16px',
                    backgroundColor: '#000',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'block',
                    maxWidth: '800px',
                    margin: '0 auto 20px auto',
                    fontWeight: '500'
                }}
            >
                ← Back to Slots
            </button>

            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '0',
                    border: '1px solid #000',
                    textAlign: 'center'
                }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px', color: '#000' }}>
                        {selectedSlot?.label}
                    </h2>
                    <p style={{ color: '#666', marginBottom: '30px' }}>
                        {isBooked ? `Booked by ${booking.teamName}` : 'Slot Available'}
                    </p>

                    {/* BOOKING FORM */}
                    {!isBooked && (
                        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                            <form onSubmit={handleBookRoom}>
                                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#000' }}>
                                        Group Name
                                    </label>
                                    <input
                                        type="text"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder="Enter your group name"
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '0',
                                            border: '1px solid #000',
                                            fontSize: '16px',
                                            outline: 'none'
                                        }}
                                        required
                                    />
                                </div>

                                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#000' }}>
                                        Group Members (Optional)
                                    </label>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                        <input
                                            type="text"
                                            value={newMemberMrr}
                                            onChange={(e) => setNewMemberMrr(e.target.value)}
                                            placeholder="Enter MRR ID"
                                            style={{
                                                flex: 1,
                                                padding: '10px',
                                                borderRadius: '0',
                                                border: '1px solid #000',
                                                fontSize: '14px',
                                                outline: 'none'
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddPendingMember(e);
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddPendingMember}
                                            disabled={isSubmitting}
                                            style={{
                                                padding: '10px 20px',
                                                backgroundColor: '#000',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '0',
                                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                fontWeight: '600'
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>

                                    {pendingMembers.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {pendingMembers.map((member, index) => (
                                                <div key={index} style={{
                                                    backgroundColor: '#f5f5f5',
                                                    padding: '4px 12px',
                                                    borderRadius: '0',
                                                    border: '1px solid #ddd',
                                                    fontSize: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    {member.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePendingMember(index)}
                                                        style={{
                                                            border: 'none',
                                                            background: 'none',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                            color: '#666',
                                                            fontSize: '14px',
                                                            lineHeight: 1
                                                        }}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {error && <div style={{ color: '#d32f2f', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    style={{
                                        width: '100%',
                                        padding: '14px',
                                        backgroundColor: '#000',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0',
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                        opacity: isSubmitting ? 0.7 : 1
                                    }}
                                >
                                    {isSubmitting ? 'Booking...' : 'Book Slot'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* DETAILS VIEW - MY TEAM */}
                    {isBooked && isMyTeam && (
                        <div style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
                            <div style={{
                                padding: '20px',
                                backgroundColor: '#000',
                                borderRadius: '0',
                                color: '#fff',
                                marginBottom: '30px',
                                textAlign: 'center'
                            }}>
                                <h3 style={{ fontSize: '18px', marginBottom: '5px', color: '#fff' }}>Your Group: <strong style={{ color: '#fff' }}>{booking.teamName}</strong></h3>
                            </div>

                            <h3 style={{ fontSize: '18px', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                                Group Members
                            </h3>

                            <div style={{ marginBottom: '30px' }}>
                                {booking.members && booking.members.length > 0 && (
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        {booking.members.filter(m => m && (m.name || typeof m === 'string')).map((member, idx) => {
                                            const name = member.name || (typeof member === 'string' ? member : 'Unknown');
                                            const mrr = member.mrrNumber || '';
                                            return (
                                                <li key={idx} style={{
                                                    padding: '12px',
                                                    backgroundColor: 'white',
                                                    border: '1px solid #eee',
                                                    marginBottom: '8px',
                                                    borderRadius: '0',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                        <span style={{ fontWeight: '500', color: '#000' }}>{name}</span>
                                                        {mrr && <span style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>MRR ID: {mrr}</span>}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '0', border: '1px solid #eee' }}>
                                <h4 style={{ fontSize: '16px', marginBottom: '15px' }}>Add Group Member</h4>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input
                                        type="text"
                                        value={newMemberMrr}
                                        onChange={(e) => setNewMemberMrr(e.target.value)}
                                        placeholder="Enter MRR ID"
                                        style={{ flex: 1, padding: '10px', borderRadius: '0', border: '1px solid #000', outline: 'none' }}
                                    />
                                    <button
                                        onClick={handleAddMemberToExisting}
                                        disabled={isSubmitting}
                                        style={{
                                            padding: '10px 20px',
                                            backgroundColor: '#000',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0',
                                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                            opacity: isSubmitting ? 0.7 : 1
                                        }}
                                    >
                                        {isSubmitting ? '...' : 'Add'}
                                    </button>
                                </div>
                                {error && <p style={{ color: '#d32f2f', fontSize: '14px', marginTop: '10px' }}>{error}</p>}
                                {successMsg && <p style={{ color: '#2e7d32', fontSize: '14px', marginTop: '10px' }}>{successMsg}</p>}
                            </div>

                            {booking.bookedBy === user.uid && (
                                <div style={{ marginTop: '30px', textAlign: 'center' }}>
                                    <button
                                        onClick={handleCancelBooking}
                                        style={{
                                            padding: '10px 20px',
                                            backgroundColor: '#fff',
                                            color: '#d32f2f',
                                            border: '1px solid #d32f2f',
                                            borderRadius: '0',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            fontSize: '14px'
                                        }}
                                    >
                                        Cancel Booking
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* DETAILS VIEW - OTHERS */}
                    {isBooked && !isMyTeam && (
                        <div style={{ padding: '40px', backgroundColor: '#f5f5f5', borderRadius: '0', border: '1px solid #ddd', color: '#333' }}>
                            <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Booked</h2>
                            <p style={{ fontSize: '18px', marginBottom: '20px' }}>
                                This slot is attained by <strong>{booking.teamName}</strong>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Discussion;

// ... imports ...
import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db, functions } from '../../lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import '../../styles/StandardLayout.css';

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

    // Renewal State
    const [showRenewal, setShowRenewal] = useState(false);
    const [selectedDurationType, setSelectedDurationType] = useState('month');
    const [selectedDuration, setSelectedDuration] = useState(1);
    const [customDuration, setCustomDuration] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
    const [transactions, setTransactions] = useState([]);

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
        if (!roomId) {
            setLoading(false);
            return;
        }

        let unsubAssignments = () => { };
        let unsubTransactions = () => { };

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

                const txnQuery = query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.uid)
                );

                unsubTransactions = onSnapshot(txnQuery, (snap) => {
                    const txns = snap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(t => t.type === 'reading_room' || t.type === 'reading_room_renewal');

                    // Client-side sort to avoid index requirements
                    txns.sort((a, b) => new Date(b.date) - new Date(a.date));
                    setTransactions(txns);
                });

            } catch (err) {
                console.error('Error loading room data:', err);
                setLoading(false);
            }
        };

        loadRoomData();
        return () => {
            unsubAssignments();
            unsubTransactions();
        };
    }, [userData, user]);


    const handleRenew = async () => {
        setIsSubmitting(true);
        setError('');

        try {
            const renewReadingRoomSubscription = httpsCallable(functions, 'renewReadingRoomSubscription');

            let duration = selectedDuration;
            if (selectedDuration === 'custom') {
                duration = parseInt(customDuration);
                if (isNaN(duration) || duration <= 0) {
                    throw new Error("Please enter a valid duration.");
                }
            }
            if (selectedDurationType === 'day') {
                duration = parseInt(customDuration || selectedDuration); // Reuse input or state
                if (isNaN(duration) || duration <= 0) {
                    throw new Error("Please enter valid days.");
                }
            }

            const result = await renewReadingRoomSubscription({
                durationType: selectedDurationType,
                duration: duration
            });

            if (result.data.success) {
                alert(`Renewal successful! Next payment: ${new Date(result.data.nextPaymentDue).toLocaleDateString()}`);
                setShowRenewal(false);
                setCustomDuration('');
            }
        } catch (err) {
            console.error('Renewal failed:', err);
            setError(err.message || 'Failed to process renewal.');
        } finally {
            setIsSubmitting(false);
        }
    };


    // Refund State
    const [refundCalculation, setRefundCalculation] = useState(null);

    // ... existing renewal handlers ...

    const handleCalculateRefund = () => {
        // 1. Find latest relevant transaction or use current package info
        // We rely on userData.lastPaymentDate and transactions
        const lastTxn = transactions[0]; // Sorted desc

        // Default values if data missing
        let paidAmount = 0;
        let packageDays = 30; // Assume month by default
        let startDate = new Date();

        if (userData.lastPaymentDate) {
            startDate = new Date(userData.lastPaymentDate);
        } else if (lastTxn) {
            startDate = new Date(lastTxn.date);
        }

        if (lastTxn) {
            paidAmount = lastTxn.amount;
            // Try to guess days from details if possible, or assume based on amount? 
            // Ideally store package info in user. But for now, let's infer.
            // If details contains "Day", it's daily.
            if (lastTxn.details?.toLowerCase().includes('day')) {
                // Extract number? Or just assume daily rate logic.
                // Simplified: Daily users refund = 0 usually? Or same formula.
                packageDays = 1; // It's per day basis
                // Actually if they bought 5 days, and used 2...
                // Only if we know they bought 5 days.
                // Let's assume standard month logic for refund if unclear. Only admins verify.
                packageDays = 30; // Fallback
            }
        }

        // Fallback: If no transaction found (e.g. manual admin assignment), use standard room price
        if (paidAmount === 0 && roomData) {
            paidAmount = roomData.price || (roomData.type === 'ac' ? 3000 : 2500);
        }

        // Days Used
        const now = new Date();
        const diffTime = Math.abs(now - startDate);
        const daysUsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Formula: Refund = Paid - (Paid / PackageDays * DaysUsed)
        // If PackageDays is unclear, we might assume they entered a month. 
        // Better approach: Calculate "Daily Cost" based on what they paid.
        // Daily Cost = Paid / 30 (for monthly).

        // Let's stick to the user's formula: Refund Amount = Total Paid - (Total Package Price / Total Package Days * Days Spent)
        // We will assume 30 days for package if not specified, or if 'daily' we need that info.

        // If they are on a "Daily" expiry policy, usually no refunds? 
        // Let's just propose a refund and let admin adjust.

        let calculatedRefund = 0;
        if (paidAmount > 0) {
            const dailyCost = paidAmount / packageDays;
            const costIncurred = dailyCost * daysUsed;
            calculatedRefund = paidAmount - costIncurred;
        }

        if (calculatedRefund < 0) calculatedRefund = 0;

        setRefundCalculation({
            paidAmount,
            startDate,
            daysUsed,
            calculatedRefund: Math.floor(calculatedRefund),
            packageDays
        });
        setShowWithdrawConfirm(true);
    };

    const [refundMode, setRefundMode] = useState('wallet'); // 'wallet' or 'cash'

    const handleWithdraw = async () => {
        setIsSubmitting(true);
        try {
            // 1. Prepare Refund Details
            const refundPayload = {
                packagePrice: refundCalculation?.paidAmount || 0,
                packageDays: refundCalculation?.packageDays || 30,
                daysUsed: refundCalculation?.daysUsed || 0,
                calculatedAmount: refundCalculation?.calculatedRefund || 0
            };

            // 2. Call Cloud Function (Handles Withdrawal + Refund Creation)
            const withdrawService = httpsCallable(functions, 'withdrawService');
            const result = await withdrawService({
                serviceType: 'readingRoom',
                refundDetails: refundPayload,
                refundMode: refundMode // Pass the selected mode
            });

            const refundToken = result.data.refundToken;

            // Success
            // Success
            if (refundMode === 'wallet') {
                alert(`Withdrawal successful. रु ${refundCalculation?.calculatedRefund || 0} is added to your account ${user.mrrNumber || ''}`);
            } else {
                alert(`Withdrawal successful. Refund token: ${refundToken}\n\nPlease visit the office to collect your refund.`);
            }
            setShowWithdrawConfirm(false);

        } catch (err) {
            console.error('Withdraw failed:', err);
            alert('Failed to withdraw: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };


    const getEstimatedCost = () => {
        if (!roomData) return 0;
        const monthlyRate = roomData.price || (roomData.type === 'ac' ? 3000 : 2500);
        const dailyRate = Math.ceil(monthlyRate / 30);

        let cost = 0;
        let duration = selectedDuration;

        if (selectedDurationType === 'month') {
            if (selectedDuration === 'custom') {
                duration = parseInt(customDuration) || 0;
            }
            cost = monthlyRate * duration;
        } else {
            // Per Day
            duration = parseInt(customDuration || selectedDuration) || 0;
            cost = dailyRate * duration;
        }

        // Add Fine
        const fine = userData?.fineAmount || 0;
        return cost + fine;
    };


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
    // Logic change: Don't show "Membership Expired" blocking screen if they are in Grace Period (fineAmount > 0 or inGracePeriod)
    // Actually, dashboard should show status even if expired, so they can renew.
    // The previous logic blocked access if expired. We should change this to allow access to Dashboard to Renew.

    // Only block if they DON'T have a seat anymore.
    const hasSeat = userData?.currentSeat;

    if (!hasSeat) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', maxWidth: '500px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', fontFamily: 'var(--brand-font-serif)' }}>
                        No Active Membership
                    </h2>
                    <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px', lineHeight: '1.6' }}>
                        You don't have an active reading room membership.
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
    const fineAmount = userData?.fineAmount || 0;

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
                    {/* Top Info Section */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '24px',
                        paddingBottom: '20px',
                        borderBottom: '1px solid #f5f5f5',
                        flexWrap: 'wrap',
                        gap: '20px',
                        alignItems: 'center'
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

                        <div>
                            <div style={{
                                fontSize: '12px',
                                color: '#888',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginBottom: '4px',
                                fontFamily: 'var(--brand-font-body)'
                            }}>
                                Status
                            </div>
                            <div style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                backgroundColor: isExpired ? '#ffebee' : '#e6f4ea',
                                borderRadius: '20px',
                                color: isExpired ? '#c62828' : '#1e8e3e',
                                fontSize: '14px',
                                fontWeight: '600'
                            }}>
                                {isExpired ? 'Expired' : 'Active'}
                            </div>
                        </div>

                        <div>
                            <div style={{
                                fontSize: '12px',
                                color: '#888',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginBottom: '4px',
                                fontFamily: 'var(--brand-font-body)'
                            }}>
                                Next Payment
                            </div>
                            <div style={{
                                fontSize: '18px',
                                color: isExpired ? '#d32f2f' : '#2e7d32',
                                fontWeight: '600',
                                fontFamily: 'var(--brand-font-serif)'
                            }}>
                                {expiryDateShort}
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
                            overflow: 'auto',
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
                                            {type === 'door' && <DoorIcon size={element.width} />}
                                            {type === 'window' && <WindowIcon size={element.width} />}
                                            {type === 'toilet' && <ToiletIcon size={element.width} />}
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    ) : (
                        <div style={{ padding: '60px', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '12px', marginBottom: '20px' }}>
                            <span style={{ color: '#888', fontFamily: 'var(--brand-font-body)' }}>Room layout not available</span>
                        </div>
                    )}

                    {/* Legend */}
                    <div id="dashboard-legend" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '20px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#2196f3', border: '1px solid #1565c0' }} />
                            <span style={{ fontSize: '12px', color: '#666', fontFamily: 'var(--brand-font-body)' }}>Your Seat</span>
                        </div>
                    </div>

                    {/* Bottom Info Section */}
                    <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div id="status-section" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
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
                                backgroundColor: isExpired ? '#ffebee' : '#e6f4ea',
                                borderRadius: '20px'
                            }}>
                                <span style={{
                                    color: isExpired ? '#c62828' : '#1e8e3e',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    letterSpacing: '0.3px'
                                }}>
                                    {isExpired ? 'Expired' : 'Active'}
                                </span>
                            </div>
                            {fineAmount > 0 && (
                                <div style={{ marginTop: '4px', color: '#d32f2f', fontSize: '12px', fontWeight: 'bold' }}>
                                    Pending Fine: रु {fineAmount}
                                </div>
                            )}
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
                                color: daysLeft < 5 || isExpired ? '#d32f2f' : '#000',
                                fontWeight: '600',
                                fontFamily: 'var(--brand-font-serif)'
                            }}>
                                {expiryDateShort}
                            </div>
                            {isExpired && (
                                <div style={{ fontSize: '11px', color: '#d32f2f', textAlign: 'right' }}>
                                    Overdue by {Math.abs(daysLeft)} days
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Renew / Withdraw Buttons */}
                    {!showRenewal && !showWithdrawConfirm && (
                        <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowRenewal(true)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: '#000',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Renew Subscription
                            </button>
                            <button
                                onClick={handleCalculateRefund}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: '#fff',
                                    color: '#d32f2f',
                                    border: '1px solid #ffcdd2',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Withdraw
                            </button>
                        </div>
                    )}

                    {/* Renewal Form */}
                    {showRenewal && (
                        <div style={{
                            marginTop: '24px',
                            backgroundColor: '#fafafa',
                            padding: '24px',
                            borderRadius: '12px',
                            border: '1px solid #eee'
                        }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>Renew Subscription</h3>

                            {/* Duration Type Tabs */}
                            <div style={{ display: 'flex', marginBottom: '16px', borderBottom: '1px solid #ddd' }}>
                                <div
                                    onClick={() => { setSelectedDurationType('month'); setSelectedDuration(1); setCustomDuration(''); }}
                                    style={{
                                        padding: '10px 20px',
                                        cursor: 'pointer',
                                        borderBottom: selectedDurationType === 'month' ? '2px solid #000' : 'none',
                                        fontWeight: selectedDurationType === 'month' ? 'bold' : 'normal',
                                        color: selectedDurationType === 'month' ? '#000' : '#888'
                                    }}
                                >
                                    Monthly
                                </div>
                                <div
                                    onClick={() => { setSelectedDurationType('day'); setSelectedDuration(''); setCustomDuration(''); }}
                                    style={{
                                        padding: '10px 20px',
                                        cursor: 'pointer',
                                        borderBottom: selectedDurationType === 'day' ? '2px solid #000' : 'none',
                                        fontWeight: selectedDurationType === 'day' ? 'bold' : 'normal',
                                        color: selectedDurationType === 'day' ? '#000' : '#888'
                                    }}
                                >
                                    Per Day
                                </div>
                            </div>

                            {selectedDurationType === 'month' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                                    {[1, 3, 12].map(m => (
                                        <div
                                            key={m}
                                            onClick={() => { setSelectedDuration(m); setCustomDuration(''); }}
                                            style={{
                                                padding: '10px',
                                                border: `1px solid ${selectedDuration === m ? '#000' : '#ddd'}`,
                                                backgroundColor: selectedDuration === m ? '#000' : '#fff',
                                                color: selectedDuration === m ? '#fff' : '#000',
                                                borderRadius: '6px',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                        >
                                            {m} Month{m > 1 ? 's' : ''}
                                        </div>
                                    ))}
                                    <div
                                        onClick={() => setSelectedDuration('custom')}
                                        style={{
                                            padding: '10px',
                                            border: `1px solid ${selectedDuration === 'custom' ? '#000' : '#ddd'}`,
                                            backgroundColor: selectedDuration === 'custom' ? '#000' : '#fff',
                                            color: selectedDuration === 'custom' ? '#fff' : '#000',
                                            borderRadius: '6px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        Custom
                                    </div>
                                </div>
                            )}

                            {/* Custom Month Input */}
                            {selectedDurationType === 'month' && selectedDuration === 'custom' && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#666' }}>Enter number of months</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={customDuration}
                                        onChange={(e) => setCustomDuration(e.target.value)}
                                        placeholder="e.g. 2, 5..."
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    />
                                </div>
                            )}

                            {/* Day Input */}
                            {selectedDurationType === 'day' && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#666' }}>Enter number of days</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={customDuration}
                                        onChange={(e) => setCustomDuration(e.target.value)}
                                        placeholder="e.g. 5, 10..."
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    />
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                                        Note: Per day subscriptions expire immediately after the duration ends.
                                    </div>
                                </div>
                            )}

                            {/* Summary & Cost */}
                            <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                    <span style={{ color: '#666' }}>Renewal Cost</span>
                                    <span>रु {getEstimatedCost().toLocaleString() - fineAmount}</span>
                                </div>
                                {fineAmount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#d32f2f' }}>
                                        <span>Overdue Fine</span>
                                        <span>+ रु {fineAmount}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '8px', fontWeight: 'bold' }}>
                                    <span>Total</span>
                                    <span>रु {getEstimatedCost().toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '13px', color: '#666' }}>
                                    <span>Your Balance</span>
                                    <span style={{ color: (userData.balance || 0) < getEstimatedCost() ? '#d32f2f' : '#1e8e3e' }}>
                                        रु {(userData.balance || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {error && <div style={{ color: 'red', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setShowRenewal(false)}
                                    disabled={isSubmitting}
                                    style={{ flex: 1, padding: '12px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRenew}
                                    disabled={isSubmitting || (userData.balance || 0) < getEstimatedCost()}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        backgroundColor: '#000',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: (userData.balance || 0) < getEstimatedCost() ? 'not-allowed' : 'pointer',
                                        opacity: (userData.balance || 0) < getEstimatedCost() ? 0.6 : 1
                                    }}
                                >
                                    {isSubmitting ? 'Processing...' : 'Pay & Renew'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Withdraw Confirmation */}
                    {showWithdrawConfirm && (
                        <div style={{
                            marginTop: '24px',
                            backgroundColor: '#fff',
                            padding: '24px',
                            borderRadius: '12px',
                            border: '1px solid #ddd',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>Confirm Withdrawal & Refund</h3>

                            <div style={{ background: '#f9f9f9', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                                    <div style={{ color: '#666' }}>Start Date:</div>
                                    <div style={{ fontWeight: '600' }}>{refundCalculation?.startDate?.toLocaleDateString()}</div>

                                    <div style={{ color: '#666' }}>Days Stayed:</div>
                                    <div style={{ fontWeight: '600' }}>{refundCalculation?.daysUsed} Days</div>

                                    <div style={{ color: '#666' }}>Estimated Refund:</div>
                                    <div style={{ fontWeight: 'bold', color: '#1e8e3e', fontSize: '16px' }}>
                                        रु {refundCalculation?.calculatedRefund?.toLocaleString()}
                                    </div>
                                </div>
                                <div style={{ marginTop: '12px', fontSize: '12px', color: '#d32f2f', fontStyle: 'italic' }}>
                                    * Final refund amount is subject to admin verification and may include deductions for damages or policy adjustments.
                                </div>
                            </div>

                            {/* Refund Mode Selection */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>Select Refund Mode:</div>
                                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="refundMode"
                                        value="wallet"
                                        checked={refundMode === 'wallet'}
                                        onChange={() => setRefundMode('wallet')}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <div>
                                        <span style={{ fontWeight: '600' }}>Add to Balance (Wallet)</span>
                                        <div style={{ fontSize: '12px', color: '#666' }}>Amount will be instantly credited to your wallet.</div>
                                    </div>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="refundMode"
                                        value="cash"
                                        checked={refundMode === 'cash'}
                                        onChange={() => setRefundMode('cash')}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <div>
                                        <span style={{ fontWeight: '600' }}>Cash Refund</span>
                                        <div style={{ fontSize: '12px', color: '#666' }}>Request approval from admin and collect cash from office.</div>
                                    </div>
                                </label>
                            </div>

                            <p style={{ fontSize: '14px', color: '#444', marginBottom: '20px' }}>
                                By confirming, you will be <strong>immediately withdrawn</strong> from seat <strong>{userData.currentSeat.seatLabel}</strong>.
                            </p>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setShowWithdrawConfirm(false)}
                                    disabled={isSubmitting}
                                    style={{ flex: 1, padding: '12px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleWithdraw}
                                    disabled={isSubmitting}
                                    style={{
                                        flex: 2,
                                        padding: '12px',
                                        backgroundColor: '#d32f2f',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {isSubmitting ? 'Processing...' : 'Confirm Withdraw & Request Refund'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Transaction History */}
                    {transactions.length > 0 && (
                        <div style={{ marginTop: '32px', borderTop: '1px solid #eee', paddingTop: '24px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', fontFamily: 'var(--brand-font-serif)' }}>Payment History</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #f5f5f5', textAlign: 'left' }}>
                                            <th style={{ padding: '12px 8px', color: '#666', fontWeight: '600' }}>Date</th>
                                            <th style={{ padding: '12px 8px', color: '#666', fontWeight: '600' }}>Details</th>
                                            <th style={{ padding: '12px 8px', color: '#666', fontWeight: '600', textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((txn) => (
                                            <tr key={txn.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                <td style={{ padding: '12px 8px', color: '#444' }}>
                                                    {new Date(txn.date).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '12px 8px', color: '#444' }}>
                                                    {txn.details || txn.type}
                                                    <div style={{ fontSize: '11px', color: '#888' }}>{txn.transactionId}</div>
                                                </td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#1e8e3e' }}>
                                                    रु {txn.amount?.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}

export default ReadingRoomDashboard;

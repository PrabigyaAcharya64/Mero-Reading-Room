import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { useLoading } from '../../context/GlobalLoadingContext';
import PageHeader from '../../components/PageHeader';
import '../../styles/Hostel.css';
import '../../styles/StandardLayout.css';

const RENEW_OPTIONS = [1, 3, 6, 12];

const HostelStatus = ({ onBack }) => {
    const { user } = useAuth();
    const { setIsLoading } = useLoading();

    const [hostelInfo, setHostelInfo] = useState(null);
    const [roommates, setRoommates] = useState([]);
    const [userBalance, setUserBalance] = useState(0);
    const [error, setError] = useState('');
    const [showRenewal, setShowRenewal] = useState(false);
    const [selectedRenewalMonths, setSelectedRenewalMonths] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            setIsLoading(true);
            try {
                // Fetch user hostel data
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUserBalance(userData.balance || 0);

                    if (userData.currentHostelRoom) {
                        setHostelInfo({
                            room: userData.currentHostelRoom,
                            nextPaymentDue: userData.hostelNextPaymentDue,
                            monthlyRate: userData.hostelMonthlyRate
                        });

                        // Fetch roommates
                        const getRoommates = httpsCallable(functions, 'getHostelRoommates');
                        const result = await getRoommates({ roomId: userData.currentHostelRoom.roomId });

                        if (result.data.success) {
                            // Filter out current user from roommates list
                            const otherRoommates = result.data.roommates.filter(r => r.userId !== user.uid);
                            setRoommates(otherRoommates);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching hostel data:', error);
                setError('Failed to load hostel information.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user, setIsLoading]);

    const handleRenewal = async () => {
        setIsSubmitting(true);
        setError('');

        try {
            const renewHostelSubscription = httpsCallable(functions, 'renewHostelSubscription');
            const result = await renewHostelSubscription({ months: selectedRenewalMonths });

            if (result.data.success) {
                alert(
                    `Subscription renewed successfully!\n\n` +
                    `Renewed for: ${selectedRenewalMonths} month${selectedRenewalMonths > 1 ? 's' : ''}\n` +
                    `Next payment due: ${new Date(result.data.nextPaymentDue).toLocaleDateString()}`
                );

                // Refresh data
                window.location.reload();
            }
        } catch (err) {
            console.error('Renewal failed:', err);
            setError(err.message || 'Failed to process renewal. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getRenewalCost = (months) => {
        return (hostelInfo?.monthlyRate || 0) * months;
    };

    const canAffordRenewal = getRenewalCost(selectedRenewalMonths) <= userBalance;

    const isExpiringSoon = () => {
        if (!hostelInfo?.nextPaymentDue) return false;
        const daysUntilDue = Math.ceil((new Date(hostelInfo.nextPaymentDue) - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 7;
    };

    if (!hostelInfo) {
        return (
            <div className="std-container">
                <PageHeader title="Hostel Status" onBack={onBack} />
                <main className="std-body">
                    <div className="hostel-status-card">
                        <p>No active hostel booking found.</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="std-container">
            <PageHeader title="Hostel Status" onBack={onBack} />

            <main className="std-body">
                <div className="hostel-status-card">
                    {/* Room Information */}
                    <div className="status-section room-details">
                        <h2 className="section-title">Your Room</h2>
                        <div className="room-banner">
                            <div className="room-main-info">
                                <h3>{hostelInfo.room.buildingName}</h3>
                                <p className="room-label">{hostelInfo.room.roomLabel} - Bed {hostelInfo.room.bedNumber}</p>
                            </div>
                            <div className="room-rate">
                                <span className="rate-amount">रु {hostelInfo.monthlyRate?.toLocaleString()}</span>
                                <span className="rate-period">/month</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    <div className="status-section payment-info">
                        <h3 className="section-title">Payment Details</h3>
                        <div className="payment-details">
                            <div className="payment-item">
                                <span className="payment-label">Next Payment Due:</span>
                                <span className={`payment-value ${isExpiringSoon() ? 'expiring-soon' : ''}`}>
                                    {new Date(hostelInfo.nextPaymentDue).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </span>
                            </div>
                            {isExpiringSoon() && (
                                <div className="expiry-warning">
                                    ⚠️ Payment due soon! Renew your subscription to avoid interruption.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Roommates Section */}
                    <div className="status-section roommates-section">
                        <h3 className="section-title">
                            Roommates {roommates.length > 0 && `(${roommates.length})`}
                        </h3>
                        {roommates.length > 0 ? (
                            <div className="roommates-list">
                                {roommates.map((roommate, idx) => (
                                    <div key={idx} className="roommate-card">
                                        <div className="roommate-icon">
                                            <span>👤</span>
                                        </div>
                                        <div className="roommate-info">
                                            <span className="roommate-name">{roommate.userName}</span>
                                            <span className="roommate-mrr">MRR: {roommate.userMrrNumber}</span>
                                            <span className="roommate-bed">Bed {roommate.bedNumber}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-roommates">You have this room to yourself! 🎉</p>
                        )}
                    </div>

                    {/* Renewal Section */}
                    {!showRenewal ? (
                        <button
                            className="btn btn-black btn-block"
                            onClick={() => setShowRenewal(true)}
                        >
                            Renew Subscription
                        </button>
                    ) : (
                        <div className="renewal-section">
                            <h3 className="section-title">Renew Your Subscription</h3>

                            <div className="renewal-options">
                                {RENEW_OPTIONS.map(months => {
                                    const cost = getRenewalCost(months);
                                    const canAfford = cost <= userBalance;

                                    return (
                                        <div
                                            key={months}
                                            className={`renewal-option ${selectedRenewalMonths === months ? 'selected' : ''} ${!canAfford ? 'unaffordable' : ''}`}
                                            onClick={() => canAfford && setSelectedRenewalMonths(months)}
                                        >
                                            <div className="renewal-duration">
                                                <span className="duration-number">{months}</span>
                                                <span className="duration-text">Month{months > 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="renewal-price">
                                                <span className="price-label">रु {cost.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="renewal-summary">
                                <div className="summary-row">
                                    <span>Duration:</span>
                                    <span>{selectedRenewalMonths} Month{selectedRenewalMonths > 1 ? 's' : ''}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Cost:</span>
                                    <span>रु {getRenewalCost(selectedRenewalMonths).toLocaleString()}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Your Balance:</span>
                                    <span className={canAffordRenewal ? 'sufficient' : 'insufficient'}>
                                        रु {userBalance.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {error && <div className="error-msg">{error}</div>}

                            <div className="renewal-actions">
                                <button
                                    className="btn btn-outline btn-block"
                                    onClick={() => setShowRenewal(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-black btn-block"
                                    onClick={handleRenewal}
                                    disabled={isSubmitting || !canAffordRenewal}
                                >
                                    {isSubmitting ? 'Processing...' : canAffordRenewal ? 'Confirm Renewal' : 'Insufficient Balance'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default HostelStatus;

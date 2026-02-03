import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, addDoc } from 'firebase/firestore';
import { useLoading } from '../../context/GlobalLoadingContext';
import PageHeader from '../../components/PageHeader';
import '../../styles/Hostel.css';
import '../../styles/StandardLayout.css';

import { generateAndSendHostelInvoice } from './HostelInvoice';

const RENEW_OPTIONS = [1, 3, 6, 12, 'custom'];

const HostelStatus = ({ onBack }) => {
    const { user } = useAuth();
    const { setIsLoading } = useLoading();

    const [hostelInfo, setHostelInfo] = useState(null);
    const [roommates, setRoommates] = useState([]);
    const [userBalance, setUserBalance] = useState(0);
    const [userData, setUserData] = useState(null);
    const [error, setError] = useState('');

    // UI State
    const [showRenewal, setShowRenewal] = useState(false);
    const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
    const [selectedRenewalMonths, setSelectedRenewalMonths] = useState(1);
    const [customMonths, setCustomMonths] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [transactions, setTransactions] = useState([]);

    const [refundCalculation, setRefundCalculation] = useState(null);
    const [refundMode, setRefundMode] = useState('wallet'); // 'wallet' or 'cash'

    useEffect(() => {
        if (!user) return;
        setIsLoading(true);

        const unsubUser = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setUserData(data);
                setUserBalance(data.balance || 0);

                if (data.currentHostelRoom) {
                    setHostelInfo({
                        room: data.currentHostelRoom,
                        nextPaymentDue: data.hostelNextPaymentDue,
                        monthlyRate: data.hostelMonthlyRate,
                        fineAmount: data.hostelFineAmount || 0
                    });

                    // Fetch roommates only if needed and not already fetched
                    try {
                        const getRoommates = httpsCallable(functions, 'getHostelRoommates');
                        const result = await getRoommates({ roomId: data.currentHostelRoom.roomId });
                        if (result.data.success) {
                            const otherRoommates = result.data.roommates.filter(r => r.userId !== user.uid);
                            setRoommates(otherRoommates);
                        }
                    } catch (e) {
                        console.error("Error fetching roommates", e);
                    }
                } else {
                    setHostelInfo(null);
                }
            }
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching user data:", err);
            setError("Failed to load user data");
            setIsLoading(false);
        });

        // Load Transactions
        const txnQuery = query(
            collection(db, 'transactions'),
            where('userId', '==', user.uid),
            where('type', '==', 'hostel_fee') // Or check all and filter
        );

        // Note: 'hostel_fee' or 'hostel'?
        // The generateTransactionId uses prefixes, but 'type' field in transaction creation: 'hostel_fee' is common.
        // Let's check typical type names. 
        // Assuming 'hostel_fee' or 'hostel'. Let's match typical patterns.
        // Or better: filter client side if type is inconsistent.

        const unsubTransactions = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', user.uid)), (snap) => {
            const txns = snap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(t => t.type && (t.type.includes('hostel') || t.details?.toLowerCase().includes('hostel'))) // Robust filter
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            setTransactions(txns);
        });

        return () => {
            unsubUser();
            unsubTransactions();
        };
    }, [user, setIsLoading]);

    const handleCalculateRefund = () => {
        const lastTxn = transactions[0];

        let paidAmount = 0;
        let packageMonths = 1;
        let startDate = new Date();

        // 1. Determine Start Date
        // Hostel usually tracks `hostelNextPaymentDue`.
        // Start date = Next Payment Due - Months Paid?
        // Or if we have `hostelLastPaymentDate` (not standard in previous code view).
        // Let's use Transaction Date.
        if (lastTxn) {
            startDate = new Date(lastTxn.date);
            paidAmount = lastTxn.amount;

            // Try to guess duration.
            // If amount ~= monthlyRate * X.
            if (hostelInfo?.monthlyRate) {
                const estimatedMonths = Math.round(paidAmount / hostelInfo.monthlyRate);
                if (estimatedMonths > 0) packageMonths = estimatedMonths;
            }
        } else {
            // Fallback if no clean transaction
            // default to 1 month from whenever they paid (unknown)
            // Refund = 0 safe fallback
        }

        const now = new Date();
        const diffTime = Math.abs(now - startDate);
        const daysUsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalPackageDays = packageMonths * 30;

        // Refund Formula
        let calculatedRefund = 0;
        if (paidAmount > 0) {
            const dailyCost = paidAmount / totalPackageDays;
            const costIncurred = dailyCost * daysUsed;
            calculatedRefund = paidAmount - costIncurred;
        }

        if (calculatedRefund < 0) calculatedRefund = 0;

        setRefundCalculation({
            paidAmount,
            startDate,
            daysUsed,
            calculatedRefund: Math.floor(calculatedRefund),
            packageMonths
        });
        setShowWithdrawConfirm(true);
    };

    const handleRenewal = async () => {
        setIsSubmitting(true);
        setError('');

        try {
            const renewHostelSubscription = httpsCallable(functions, 'renewHostelSubscription');

            let months = selectedRenewalMonths;
            if (selectedRenewalMonths === 'custom') {
                months = parseInt(customMonths);
                if (isNaN(months) || months <= 0) {
                    throw new Error("Please enter a valid number of months.");
                }
            }

            const result = await renewHostelSubscription({ months: months });

            if (result.data.success) {
                // Generate and send invoice
                try {
                    await generateAndSendHostelInvoice(user.uid, result.data.transactionId);
                } catch (invoiceError) {
                    console.error('Invoice generation error:', invoiceError);
                }

                alert(
                    `Subscription renewed successfully!\n\n` +
                    `Renewed for: ${months} month${months > 1 ? 's' : ''}\n` +
                    `Next payment due: ${new Date(result.data.nextPaymentDue).toLocaleDateString()}`
                );
                setShowRenewal(false);
                setCustomMonths('');
            }
        } catch (err) {
            console.error('Renewal failed:', err);
            setError(err.message || 'Failed to process renewal. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleWithdraw = async () => {
        setIsSubmitting(true);
        try {
            // 1. Prepare Refund Details
            const refundPayload = {
                packagePrice: refundCalculation?.paidAmount || 0,
                packageDays: (refundCalculation?.packageMonths || 1) * 30,
                daysUsed: refundCalculation?.daysUsed || 0,
                calculatedAmount: refundCalculation?.calculatedRefund || 0
            };

            // 2. Call Cloud Function (Handles Withdrawal + Refund Creation)
            const withdrawService = httpsCallable(functions, 'withdrawService');
            const result = await withdrawService({
                serviceType: 'hostel',
                refundDetails: refundPayload,
                refundMode: refundMode
            });

            const refundToken = result.data.refundToken;

            if (refundMode === 'wallet') {
                alert(`Withdrawal successful. रु ${refundCalculation?.calculatedRefund || 0} is added to your account ${user.mrrNumber || ''}`);
            } else {
                alert(`Withdrawal successful. Refund token: ${refundToken}\n\nPlease visit the office to collect your refund.`);
            }
            setShowWithdrawConfirm(false);
        } catch (err) {
            console.error('Withdraw failed:', err);
            alert('Failed to withdraw: ' + (err.message || 'Unknown error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const getRenewalCost = (months) => {
        const m = months === 'custom' ? (parseInt(customMonths) || 0) : months;
        const baseCost = (hostelInfo?.monthlyRate || 0) * m;
        return baseCost + (hostelInfo?.fineAmount || 0);
    };

    const currentCost = getRenewalCost(selectedRenewalMonths);
    const canAffordRenewal = currentCost <= userBalance && currentCost > 0;

    const isExpiringSoon = () => {
        if (!hostelInfo?.nextPaymentDue) return false;
        const daysUntilDue = Math.ceil((new Date(hostelInfo.nextPaymentDue) - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 7;
    };

    // Check for expiration
    const nextDue = hostelInfo?.nextPaymentDue;
    const expiryDate = nextDue ? new Date(nextDue) : null;
    const isExpired = expiryDate && expiryDate < new Date();

    if (!hostelInfo) {
        return (
            <div className="std-container">
                <PageHeader title="Hostel Status" onBack={onBack} forceShowBack={true} />
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
            <PageHeader title="Hostel Status" onBack={onBack} forceShowBack={true} />

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
                                <span className="payment-label">Status:</span>
                                <span className={`payment-value ${isExpired ? 'expired-status' : 'active-status'}`}
                                    style={{ color: isExpired ? '#d32f2f' : '#1e8e3e', fontWeight: 'bold' }}>
                                    {isExpired ? 'Expired' : 'Active'}
                                </span>
                            </div>
                            <div className="payment-item">
                                <span className="payment-label">Next Payment Due:</span>
                                <span className={`payment-value ${isExpiringSoon() || isExpired ? 'expiring-soon' : ''}`}>
                                    {new Date(hostelInfo.nextPaymentDue).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </span>
                            </div>
                            {hostelInfo.fineAmount > 0 && (
                                <div className="payment-item" style={{ color: '#d32f2f' }}>
                                    <span className="payment-label">Outstanding Fine:</span>
                                    <span className="payment-value">रु {hostelInfo.fineAmount}</span>
                                </div>
                            )}
                            {(isExpiringSoon() || isExpired) && (
                                <div className="expiry-warning">
                                    {isExpired
                                        ? '⚠️ Membership expired! Please renew immediately to avoid penalties.'
                                        : '⚠️ Payment due soon! Renew your subscription to avoid interruption.'}
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

                    {/* Actions Section */}
                    {!showRenewal && !showWithdrawConfirm && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button
                                className="btn btn-black btn-block"
                                onClick={() => setShowRenewal(true)}
                                style={{ flex: 1 }}
                            >
                                Renew Subscription
                            </button>
                            <button
                                className="btn btn-block"
                                onClick={handleCalculateRefund}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#fff',
                                    color: '#d32f2f',
                                    border: '1px solid #ffcdd2'
                                }}
                            >
                                Withdraw
                            </button>
                        </div>
                    )}

                    {/* Withdraw Confirmation */}
                    {showWithdrawConfirm && (
                        <div className="renewal-section" style={{ border: '1px solid #ef5350', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                            <h3 className="section-title" style={{ color: '#d32f2f' }}>Confirm Withdraw & Refund</h3>

                            <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                                    <div style={{ color: '#666' }}>Start Date:</div>
                                    <div style={{ fontWeight: '600' }}>{refundCalculation?.startDate?.toLocaleDateString() || 'N/A'}</div>

                                    <div style={{ color: '#666' }}>Days Stayed:</div>
                                    <div style={{ fontWeight: '600' }}>{refundCalculation?.daysUsed || 0} Days</div>

                                    <div style={{ color: '#666' }}>Estimated Refund:</div>
                                    <div style={{ fontWeight: 'bold', color: '#1e8e3e', fontSize: '15px' }}>
                                        रु {refundCalculation?.calculatedRefund?.toLocaleString() || 0}
                                    </div>
                                </div>
                                <div style={{ marginTop: '10px', fontSize: '11px', color: '#d32f2f', fontStyle: 'italic' }}>
                                    * Refund subject to admin approval and adjustment.
                                </div>
                            </div>

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

                            <p style={{ marginBottom: '20px', fontSize: '14px', color: '#444' }}>
                                This will end your hostel stay immediately. Are you sure?
                            </p>

                            <div className="renewal-actions">
                                <button
                                    className="btn btn-outline btn-block"
                                    onClick={() => setShowWithdrawConfirm(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-block"
                                    onClick={handleWithdraw}
                                    disabled={isSubmitting}
                                    style={{ backgroundColor: '#d32f2f', color: '#fff', border: 'none' }}
                                >
                                    {isSubmitting ? 'Processing...' : 'Confirm Withdraw'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Renewal Section */}
                    {showRenewal && (
                        <div className="renewal-section">
                            <h3 className="section-title">Renew Your Subscription</h3>

                            <div className="renewal-options">
                                {RENEW_OPTIONS.map(months => {
                                    // Visual check for affordability only on fixed months.
                                    // For custom, we check dynamically.
                                    let isCustom = months === 'custom';
                                    let cost = 0;
                                    if (!isCustom) {
                                        cost = (hostelInfo.monthlyRate || 0) * months + (hostelInfo.fineAmount || 0);
                                    }

                                    const canAfford = isCustom ? true : cost <= userBalance;

                                    return (
                                        <div
                                            key={months}
                                            className={`renewal-option ${selectedRenewalMonths === months ? 'selected' : ''} ${!canAfford ? 'unaffordable' : ''}`}
                                            onClick={() => {
                                                setSelectedRenewalMonths(months);
                                                if (months !== 'custom') setCustomMonths('');
                                            }}
                                        >
                                            <div className="renewal-duration">
                                                <span className="duration-number">{isCustom ? '?' : months}</span>
                                                <span className="duration-text">{isCustom ? 'Custom' : `Month${months > 1 ? 's' : ''}`}</span>
                                            </div>
                                            {!isCustom && (
                                                <div className="renewal-price">
                                                    <span className="price-label">रु {(cost - (hostelInfo.fineAmount || 0)).toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedRenewalMonths === 'custom' && (
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>Enter number of months:</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={customMonths}
                                        onChange={(e) => setCustomMonths(e.target.value)}
                                        placeholder="e.g. 5"
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
                                    />
                                </div>
                            )}

                            <div className="renewal-summary">
                                <div className="summary-row">
                                    <span>Duration:</span>
                                    <span>{selectedRenewalMonths === 'custom' ? (customMonths || 0) : selectedRenewalMonths} Month(s)</span>
                                </div>
                                <div className="summary-row">
                                    <span>Renewal Cost:</span>
                                    <span>रु {(getRenewalCost(selectedRenewalMonths) - (hostelInfo.fineAmount || 0)).toLocaleString()}</span>
                                </div>
                                {hostelInfo.fineAmount > 0 && (
                                    <div className="summary-row" style={{ color: '#d32f2f' }}>
                                        <span>Fine:</span>
                                        <span>+ रु {hostelInfo.fineAmount}</span>
                                    </div>
                                )}
                                <div className="summary-row total-row" style={{ borderTop: '1px solid #eee', paddingTop: '5px', fontWeight: 'bold' }}>
                                    <span>Total:</span>
                                    <span>रु {currentCost.toLocaleString()}</span>
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

import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import { generateAndSendInvoice } from './ReadingRoomInvoice';
import '../../styles/StandardLayout.css';

function ReadingRoomBuy({ onBack, selectedOption, onComplete }) {
    const { user, userBalance } = useAuth();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [userData, setUserData] = useState(null);
    const [error, setError] = useState('');

    const [couponCode, setCouponCode] = useState('');
    const [calculation, setCalculation] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [couponError, setCouponError] = useState('');

    const loadUserData = async () => {
        try {
            if (!user) return;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                setUserData(userDoc.data());
            }
        } catch (err) {
            console.error('Error loading user data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUserData();
    }, [user]);

    // Handle case where selectedOption is lost (e.g. on refresh)
    useEffect(() => {
        if (!selectedOption) {
            onBack();
        }
    }, [selectedOption, onBack]);

    if (!selectedOption) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            <LoadingSpinner size="40" stroke="3" color="#333" />
        </div>;
    }



    const handleCalculatePrice = async (code = '') => {
        setIsCalculating(true);
        setCouponError('');
        try {
            const calculatePayment = httpsCallable(functions, 'calculatePayment');
            const result = await calculatePayment({
                userId: user.uid,
                serviceType: 'readingRoom',
                months: 1,
                couponCode: code || null,
                roomType: selectedOption.roomType
            });
            setCalculation(result.data);
        } catch (err) {
            console.error(err);
            setCouponError(err.message || 'Failed to calculate price');
            setCalculation(null);
        } finally {
            setIsCalculating(false);
        }
    };

    const baseTotal = selectedOption.registrationFee + selectedOption.monthlyFee;
    const finalPrice = calculation ? calculation.finalPrice : selectedOption.monthlyFee;
    const validationAmount = finalPrice + selectedOption.registrationFee;

    const handlePayment = async () => {
        if (validationAmount > userBalance) {
            setError('Insufficient balance. Please add funds to your wallet.');
            return;
        }

        setProcessing(true);
        setError('');

        try {
            // Call the Cloud Function to process purchase
            const processPurchase = httpsCallable(functions, 'processReadingRoomPurchase');
            const result = await processPurchase({
                roomType: selectedOption.roomType,
                registrationFee: selectedOption.registrationFee,
                monthlyFee: selectedOption.monthlyFee,
                couponCode: calculation ? couponCode : null
            });

            const { success, transactionId, needsEnrollment } = result.data;

            if (!success) {
                throw new Error('Purchase failed. Please try again.');
            }

            // Generate and send invoice
            try {
                const invoiceResult = await generateAndSendInvoice(user.uid, transactionId);
                // Removed console log for production
            } catch (invoiceError) {
                console.error('Invoice generation error:', invoiceError);
            }

            // Redirect based on enrollment status
            onComplete(needsEnrollment);
        } catch (err) {
            console.error('Error processing payment:', err);
            setError(err.message || 'Failed to process payment. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <LoadingSpinner size="40" stroke="3" color="#333" />
            </div>
        );
    }

    return (
        <div className="std-container">
            <PageHeader title="Confirm Payment" onBack={onBack} />

            <main className="std-body">
                <div style={{ maxWidth: '900px', margin: '0 auto', border: '1px solid #333', padding: '40px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', marginBottom: '10px', textTransform: 'uppercase' }}>
                            Confirm Payment
                        </h1>
                        <p style={{ fontSize: '14px', color: '#666' }}>
                            Review details and pay using your wallet balance
                        </p>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '40px',
                        marginBottom: '40px'
                    }}>
                        {/* Order Summary */}
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#000', textTransform: 'uppercase' }}>
                                Order Summary
                            </h2>

                            <div style={{ border: '1px solid #eee', padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                    <span style={{ color: '#666' }}>Room Type</span>
                                    <span style={{ fontWeight: 'bold' }}>{selectedOption.roomType === 'ac' ? 'AC Room' : 'Non-AC Room'}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                    <span style={{ color: '#666' }}>Monthly Fee</span>
                                    <span>रु {selectedOption.monthlyFee.toLocaleString()}</span>
                                </div>

                                {selectedOption.isFirstTime && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                        <span style={{ color: '#666' }}>Registration Fee</span>
                                        <span>रु {selectedOption.registrationFee.toLocaleString()}</span>
                                    </div>
                                )}

                                {calculation && calculation.discounts && calculation.discounts.length > 0 && (
                                    <div style={{ borderTop: '1px dashed #ddd', paddingTop: '10px', marginTop: '10px' }}>
                                        {calculation.discounts.map((discount, index) => (
                                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '14px', color: '#16a34a' }}>
                                                <span>{discount.name}</span>
                                                <span>- रु {discount.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: '20px',
                                    paddingTop: '20px',
                                    borderTop: '1px solid #333',
                                    fontSize: '18px',
                                    fontWeight: 'bold'
                                }}>
                                    <span>Total Amount</span>
                                    <span>रु {validationAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Coupon Section */}
                        <div style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '15px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>Have a Coupon?</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    placeholder="Enter Code"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                    disabled={isCalculating || !!calculation}
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd',
                                        fontSize: '14px'
                                    }}
                                />
                                {calculation ? (
                                    <button
                                        onClick={() => {
                                            setCouponCode('');
                                            setCalculation(null);
                                            setCouponError('');
                                        }}
                                        style={{
                                            padding: '8px 12px', borderRadius: '4px', border: 'none',
                                            backgroundColor: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold'
                                        }}
                                    >
                                        Remove
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleCalculatePrice(couponCode)}
                                        disabled={!couponCode || isCalculating}
                                        style={{
                                            padding: '8px 12px', borderRadius: '4px', border: 'none',
                                            backgroundColor: '#000', color: '#fff', cursor: 'pointer', fontWeight: 'bold',
                                            opacity: (!couponCode || isCalculating) ? 0.5 : 1
                                        }}
                                    >
                                        {isCalculating ? '...' : 'Apply'}
                                    </button>
                                )}
                            </div>
                            {couponError && (
                                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '5px' }}>{couponError}</div>
                            )}
                            {calculation && calculation.totalDiscount > 0 && (
                                <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '5px' }}>
                                    Coupon applied successfully!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payment Section */}
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#000', textTransform: 'uppercase' }}>
                            Payment
                        </h2>

                        <div style={{ border: '1px solid #eee', padding: '20px', backgroundColor: '#f9f9f9' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Your Current Balance</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
                                    रु {userBalance.toLocaleString()}
                                </div>
                            </div>

                            {validationAmount > userBalance ? (
                                <div style={{
                                    padding: '15px',
                                    backgroundColor: '#ffebee',
                                    color: '#c62828',
                                    fontSize: '14px',
                                    marginBottom: '20px',
                                    border: '1px solid #ffcdd2'
                                }}>
                                    Insufficient balance. You need रु {(validationAmount - userBalance).toLocaleString()} more.
                                </div>
                            ) : (
                                <div style={{
                                    padding: '15px',
                                    backgroundColor: '#e8f5e9',
                                    color: '#2e7d32',
                                    fontSize: '14px',
                                    marginBottom: '20px',
                                    border: '1px solid #c8e6c9'
                                }}>
                                    Remaining balance after payment: <strong>रु {(userBalance - validationAmount).toLocaleString()}</strong>
                                </div>
                            )}

                            {error && (
                                <div style={{
                                    padding: '10px',
                                    backgroundColor: '#ffebee',
                                    color: '#c62828',
                                    fontSize: '14px',
                                    marginBottom: '15px'
                                }}>
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handlePayment}
                                disabled={processing || validationAmount > userBalance}
                                style={{
                                    width: '100%',
                                    padding: '15px',
                                    backgroundColor: processing || validationAmount > userBalance ? '#ccc' : '#000',
                                    color: 'white',
                                    border: 'none',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    cursor: processing || validationAmount > userBalance ? 'not-allowed' : 'pointer',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {processing ? 'Processing...' : `Pay रु ${validationAmount.toLocaleString()}`}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ReadingRoomBuy;
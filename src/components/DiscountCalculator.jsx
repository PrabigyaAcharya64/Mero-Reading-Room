
import React, { useState } from 'react';
import { functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../auth/AuthProvider';

const DiscountCalculator = ({ serviceType, initialBasePriceLabel = 'Service' }) => {
    const { user } = useAuth();
    const [couponCode, setCouponCode] = useState('');
    const [months, setMonths] = useState(1);
    const [calculation, setCalculation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const calculate = async () => {
        if (!user) {
            setError('Please login first.');
            return;
        }

        setLoading(true);
        setError('');
        setCalculation(null);

        try {
            const calculatePayment = httpsCallable(functions, 'calculatePayment');
            const result = await calculatePayment({
                userId: user.uid,
                serviceType: serviceType, // 'hostel' or 'readingRoom'
                couponCode: couponCode.trim() || null,
                months: parseInt(months),
                roomType: 'ac' // Default for demo, or pass as prop
            });

            setCalculation(result.data);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error calculating price.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px', marginTop: '20px', backgroundColor: '#fafafa' }}>
            <h3>💰 Price & Discount Calculator</h3>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>Duration (Months)</label>
                    <input
                        type="number"
                        min="1"
                        value={months}
                        onChange={(e) => setMonths(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                </div>
                <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>Coupon Code (Optional)</label>
                    <input
                        type="text"
                        placeholder="e.g. FESTIVE20"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                </div>
            </div>

            <button
                onClick={calculate}
                disabled={loading}
                style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: loading ? '#ccc' : '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                }}
            >
                {loading ? 'Calculating...' : 'Check Price'}
            </button>

            {error && <p style={{ color: 'red', marginTop: '10px', fontSize: '14px' }}>⚠️ {error}</p>}

            {calculation && (
                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px dashed #ccc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span>{calculation.basePriceLabel}</span>
                        <span>Rs. {calculation.basePrice.toLocaleString()}</span>
                    </div>

                    {calculation.discounts.map((d, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: 'green' }}>
                            <span>🏷️ {d.name}</span>
                            <span>- Rs. {d.amount.toLocaleString()}</span>
                        </div>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontWeight: 'bold', fontSize: '16px' }}>
                        <span>Final Price</span>
                        <span>Rs. {calculation.finalPrice.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiscountCalculator;

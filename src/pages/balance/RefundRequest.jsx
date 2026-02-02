import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { db, functions } from '../../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useLoading } from '../../context/GlobalLoadingContext';
import PageHeader from '../../components/PageHeader';
import '../../styles/StandardLayout.css';

export default function RefundRequest({ onBack }) {
    const { user, userBalance } = useAuth();
    const { setIsLoading } = useLoading();    // Form State
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [refundHistory, setRefundHistory] = useState([]);

    useEffect(() => {
        if (!user) return;
        setIsLoading(true);

        const q = query(
            collection(db, 'refunds'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt ? new Date(doc.data().createdAt) : new Date()
            }));
            setRefundHistory(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, setIsLoading]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!amount || parseFloat(amount) <= 0) {
            alert("Please enter a valid amount.");
            return;
        }
        if (parseFloat(amount) > userBalance) {
            alert("Insufficient balance.");
            return;
        }

        setIsSubmitting(true);
        try {
            const requestRefund = httpsCallable(functions, 'requestBalanceRefund');
            const result = await requestRefund({
                amount: parseFloat(amount),
                reason: reason,
                refundMode: 'cash'
            });

            const { refundToken } = result.data;

            alert(`Withdrawal successful. Refund token: ${refundToken}\n\nPlease visit the office to collect your refund.`);

            setAmount('');
            setReason('');

        } catch (err) {
            console.error(err);
            alert("Failed to submit request: " + (err.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="std-container">
            <PageHeader title="Refund Request" onBack={onBack} forceShowBack={true} />

            <main className="std-body">
                {/* Balance Card */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e1e1e 0%, #3a3a3a 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    color: 'white',
                    marginBottom: '24px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }}>
                    <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Available Balance</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                        रु {userBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Request Form */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Request Withdrawal</h3>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#555' }}>
                                Amount to Refund
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount"
                                max={userBalance}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: '1px solid #ddd',
                                    fontSize: '16px',
                                    backgroundColor: '#f9f9f9'
                                }}
                            />
                        </div>



                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#555' }}>
                                Reason (Optional)
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="E.g., Moving out, unused balance..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px',
                                    backgroundColor: '#f9f9f9',
                                    resize: 'none'
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !amount}
                            style={{
                                width: '100%',
                                padding: '16px',
                                backgroundColor: '#000',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                opacity: isSubmitting || !amount ? 0.7 : 1
                            }}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </form>
                </div>

                {/* History Section */}
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <RefreshCw size={20} /> Request History
                    </h3>

                    {refundHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                            <p>No refund requests found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {refundHistory.map(item => (
                                <div key={item.id} style={{
                                    backgroundColor: 'white',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    border: '1px solid #eee'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                            {item.serviceType === 'balance_refund' ? 'Balance Withdraw' :
                                                item.serviceType === 'hostel' ? 'Hostel Refund' : 'Reading Room Refund'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>
                                            {item.createdAt.toLocaleDateString()}
                                            {item.refundToken && (
                                                <span style={{ marginLeft: '8px', color: '#1976d2', fontWeight: '500' }}>
                                                    • {item.refundToken}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#d32f2f' }}>
                                            रु {item.amount || item.calculatedAmount}
                                        </div>
                                        <div style={{
                                            fontSize: '11px',
                                            textTransform: 'uppercase',
                                            marginTop: '4px',
                                            color: item.status === 'pending' ? '#f59e0b' :
                                                item.status === 'completed' ? '#10b981' : '#ef4444',
                                            fontWeight: 'bold'
                                        }}>
                                            {item.status}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

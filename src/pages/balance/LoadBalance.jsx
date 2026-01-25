import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, X, QrCode, ChevronRight, Wallet } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { db, functions } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import FullScreenLoader from '../../components/FullScreenLoader';
import '../../styles/LoadBalance.css';

export default function LoadBalance({ onBack, onComplete }) {
    const { user, userBalance } = useAuth();
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState('0');
    const [transactionId, setTransactionId] = useState('');
    const [receiptImage, setReceiptImage] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    const handleKeyPress = (key) => {
        const keyStr = String(key);
        if (keyStr === 'backspace') {
            setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        } else if (keyStr === '.') {
            if (!amount.includes('.')) setAmount(prev => prev + '.');
        } else {
            setAmount(prev => prev === '0' ? keyStr : prev + keyStr);
        }
    };

    const handleContinue = () => {
        const numAmount = parseFloat(amount);
        if (numAmount < 100) {
            alert("Minimum load amount is रु 100");
            return;
        }
        setStep(2);
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("File size must be less than 5MB");
                return;
            }
            setReceiptImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setReceiptPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!transactionId.trim() || !receiptImage) {
            alert("Please fill all fields");
            return;
        }

        setLoading(true);
        try {
            const base64Image = receiptPreview.split(',')[1];
            const uploadImageFn = httpsCallable(functions, 'uploadImage');
            const uploadResult = await uploadImageFn({ base64Image });

            if (!uploadResult.data.success) throw new Error("Image upload failed");

            await addDoc(collection(db, 'balanceRequests'), {
                userId: user.uid,
                userName: user.displayName || user.email,
                userEmail: user.email,
                amount: parseFloat(amount),
                transactionId: transactionId,
                receiptUrl: uploadResult.data.url,
                status: 'pending',
                submittedAt: serverTimestamp(),
                paymentMethod: 'mobile_banking'
            });

            onComplete();
        } catch (error) {
            console.error("Error:", error);
            alert("Failed to sumbit request.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <FullScreenLoader text="Processing transaction..." />;

    // Step 1: Amount
    if (step === 1) {
        return (
            <div className="lb-container">
                <div className="lb-header">
                    <div className="lb-nav">
                        <button onClick={onBack} className="lb-back-btn">
                            <ArrowLeft size={20} className="text-white" />
                        </button>
                        <span className="lb-nav-title">Add Money</span>
                        <div style={{ width: 36 }} />
                    </div>

                    <div className="lb-balance-display">
                        <span className="lb-balance-label">Current Balance</span>
                        <div className="lb-balance-value">
                            <Wallet size={24} className="text-white opacity-80" />
                            रु {userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                <div className="lb-content">
                    <div className="lb-amount-card">
                        <span className="lb-amount-label">Enter Amount</span>
                        <div className="lb-amount-input">
                            <span className="lb-currency">रु</span>
                            {amount}
                        </div>
                    </div>

                    <div className="lb-keypad">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'backspace'].map((key) => (
                            <button
                                key={key}
                                onClick={() => handleKeyPress(key)}
                                className="lb-key"
                            >
                                {key === 'backspace' ? <X size={28} className="text-gray-400" /> : key}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleContinue}
                        className="lb-action-btn"
                    >
                        Confirmed Continue <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        );
    }

    // Step 2: Payment
    return (
        <div className="lb-container">
            <div className="lb-header-s2">
                <button onClick={() => setStep(1)} className="lb-back-btn-s2">
                    <ArrowLeft size={20} className="text-gray-800" />
                </button>
                <span className="lb-title-s2">Payment Details</span>
            </div>

            <div className="lb-content-scroll">
                <div className="lb-payment-card">
                    <div className="lb-payment-header">
                        <div className="lb-qr-icon">
                            <QrCode size={24} />
                        </div>
                        <div>
                            <h3 className="lb-payment-title">Mobile Banking</h3>
                            <p className="lb-payment-subtitle">Scan or send money manually</p>
                        </div>
                    </div>

                    <div className="lb-details-box">
                        <div className="lb-details-row">
                            <span className="lb-label-sm">Send Money To</span>
                            <span className="lb-badge">Mobile Number</span>
                        </div>
                        <p className="lb-id-value">9841015324</p>
                    </div>

                    <div className="lb-summary-row">
                        <span className="lb-label-sm">Amount to Pay</span>
                        <span className="lb-summary-val">रु {parseFloat(amount).toFixed(2)}</span>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <div>
                        <label className="lb-label">Transaction ID</label>
                        <input
                            type="text"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="e.g. 1928374"
                            className="lb-input"
                        />
                    </div>

                    <div>
                        <label className="lb-label">Upload Receipt</label>
                        {!receiptPreview ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="lb-upload-box"
                            >
                                <div className="lb-icon-circle">
                                    <Upload size={24} />
                                </div>
                                <p className="lb-upload-text">Tap to upload proof</p>
                            </div>
                        ) : (
                            <div className="lb-preview-container">
                                <img src={receiptPreview} alt="Receipt" className="lb-preview-img" />
                                <div className="lb-preview-overlay">
                                    <button
                                        onClick={() => {
                                            setReceiptImage(null);
                                            setReceiptPreview(null);
                                        }}
                                        className="lb-remove-btn"
                                    >
                                        Remove Image
                                    </button>
                                </div>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                    </div>
                </div>
            </div>

            <div className="lb-footer-s2">
                <div className="lb-footer-inner">
                    <button
                        onClick={handleSubmit}
                        className="lb-action-btn"
                        style={{ marginBottom: 0 }}
                    >
                        Verify & Submit
                    </button>
                </div>
            </div>
        </div>
    );
}

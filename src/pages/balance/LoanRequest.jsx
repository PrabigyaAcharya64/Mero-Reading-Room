import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/LoadBalance.css'; // Reusing similar styles

export default function LoanRequest() {
    const { user, userBalance } = useAuth();
    const { config, loading: configLoading } = useConfig();
    const navigate = useNavigate();
    const [amount, setAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const configReady = !configLoading && config;
    const loanSettings = configReady ? (config.LOAN || {}) : null;

    const handleApply = async () => {
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            setError("Please enter a valid amount.");
            return;
        }

        const loanAmount = parseFloat(amount);
        const effectiveMax = loanSettings?.MAX_AMOUNT || 0;

        if (loanAmount > effectiveMax) {
            setError(`Maximum loan amount is रु ${effectiveMax}`);
            return;
        }

        // Check active loan
        // We need to check if user already has active loan. 
        // Ideally we check this on mount too.

        setSubmitting(true);
        setError('');

        try {
            const { functions } = await import('../../lib/firebase');
            const { httpsCallable } = await import('firebase/functions');

            const requestLoan = httpsCallable(functions, 'requestLoan');
            const response = await requestLoan({ amount: loanAmount });

            if (response.data.success) {
                alert(response.data.message || "Loan applied successfully!");
                navigate('/balance');
            } else {
                throw new Error(response.data.message || "Unknown error");
            }

        } catch (err) {
            console.error("Loan Application Error:", err);
            // Parse cloud function error message
            const errMsg = err.message || "Failed to apply for loan.";
            alert(`Failed to apply for loan: ${errMsg}`);
            setError(errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    if (configLoading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;

    if (!loanSettings || !loanSettings.MAX_AMOUNT) return (
        <div className="std-container p-6">
            <div className="bg-red-50 text-red-700 p-4 rounded-lg">
                <AlertCircle className="inline mr-2" />
                Loan system is currently unavailable or not configured.
                <button onClick={() => navigate(-1)} className="block mt-4 text-sm underline">Go Back</button>
            </div>
        </div>
    );

    const maxAmount = loanSettings.MAX_AMOUNT || 0;
    const interestRate = loanSettings.DAILY_INTEREST_RATE || 0;
    const deadline = loanSettings.DEADLINE_DAYS || 0;

    return (
        <div className="lb-container" style={{ backgroundColor: '#f8fafc' }}>
            <div className="lb-header" style={{ backgroundColor: '#0f172a' }}>
                <div className="lb-nav">
                    <button onClick={() => navigate(-1)} className="lb-back-btn">
                        <ArrowLeft size={20} className="text-white" />
                    </button>
                    <span className="lb-nav-title">Request Loan</span>
                    <div style={{ width: 36 }} />
                </div>
            </div>

            <div className="p-6 max-w-md mx-auto mt-6">
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Loan Terms</h2>
                    <div className="space-y-3 text-sm text-gray-600">
                        <div className="flex justify-between">
                            <span>Max Amount:</span>
                            <span className="font-semibold text-gray-900">रु {maxAmount}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Daily Interest:</span>
                            <span className="font-semibold text-gray-900">{interestRate}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Deadline:</span>
                            <span className="font-semibold text-gray-900">{deadline} Days</span>
                        </div>
                        <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs mt-2">
                            Interest applies only after {deadline} days.
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-500 font-bold">रु</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder={`Max ${maxAmount}`}
                                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                max={maxAmount}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm flex items-center bg-red-50 p-3 rounded-lg border border-red-100">
                            <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleApply}
                        disabled={submitting}
                        className="w-full bg-black text-white py-3 rounded-xl font-semibold active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100 shadow-lg"
                    >
                        {submitting ? 'Processing...' : 'Confirm Loan'}
                    </button>
                </div>
            </div>
        </div>
    );
}

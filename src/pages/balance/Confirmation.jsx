import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import '../../styles/Confirmation.css';

export default function Confirmation({ onHome }) {
    return (
        <div className="cnf-container">
            {/* Background Decor */}
            <div className="cnf-bg-decor" />

            <div className="cnf-icon-circle">
                <Check className="w-12 h-12 text-white" size={48} strokeWidth={3} />
            </div>

            <h2 className="cnf-title">Request Submitted</h2>

            <p className="cnf-message">
                Your balance load request is being processed. Funds will be added within 1-2 hours after verification.
            </p>

            <button
                onClick={onHome}
                className="cnf-home-btn"
            >
                Return to Home <ArrowRight className="cnf-arrow" size={20} />
            </button>
        </div>
    );
}

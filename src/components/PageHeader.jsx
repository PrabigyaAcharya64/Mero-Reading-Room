import React from 'react';
import { ArrowLeft } from 'lucide-react';
import '../styles/PageHeader.css';

/**
 * Standardized Page Header component using the OrderDashboard style.
 * 
 * @param {Object} props
 * @param {string} props.title - The title to display in the header
 * @param {function} [props.onBack] - Callback for the back button. If provided, back button is shown.
 * @param {React.ReactNode} [props.rightElement] - Optional element to display on the right side
 */
const PageHeader = ({ title, onBack, rightElement }) => {
    return (
        <header className="std-header">
            <div className="std-header-left">
                {onBack && (
                    <button
                        type="button"
                        className="std-header-back-btn"
                        onClick={onBack}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
            </div>
            <h1 className="std-header-title">{title}</h1>
            <div className="std-header-right">
                {rightElement}
            </div>
        </header>
    );
};

export default PageHeader;

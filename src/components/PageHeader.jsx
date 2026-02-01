import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../styles/PageHeader.css';

/**
 * Standardized Page Header component using the OrderDashboard style.
 * 
 * @param {Object} props
 * @param {string} props.title - The title to display in the header
 * @param {function} [props.onBack] - Callback for the back button. If provided, back button is shown.
 * @param {React.ReactNode} [props.rightElement] - Optional element to display on the right side
 * @param {string} [props.icon] - Optional icon URL to display next to the title
 * @param {boolean} [props.forceShowBack] - Force the back button to show regardless of route nesting
 */
const PageHeader = ({ title, onBack, rightElement, icon, badgeCount, forceShowBack }) => {
    const location = useLocation();

    // Determine if we're in a nested route (depth > 1)
    // Examples:
    // / - depth 0 (LandingHome)
    // /hostel - depth 1
    // /admin - depth 1
    // /admin/user-management - depth 2
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const isNested = pathSegments.length > 1;

    // Show back button if:
    // 1. onBack is provided AND
    // 2. (we are in a nested route OR forceShowBack is true)
    const showBack = onBack && (isNested || forceShowBack);

    return (
        <header className="std-header">
            <div className="std-header-left">
                {showBack && (
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

            <div className="std-header-title-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {icon && (
                        <img
                            src={icon}
                            alt=""
                            style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                        />
                    )}
                    {badgeCount > 0 && (
                        <span className="std-header-badge">
                            {badgeCount}
                        </span>
                    )}
                </div>
                <h1 className="std-header-title">{title}</h1>
            </div>

            <div className="std-header-right">
                {rightElement}
            </div>
        </header>
    );
};

export default PageHeader;

import { useState } from 'react';
import HostelLanding from './HostelLanding';
import HostelPurchase from './HostelPurchase';
import HostelStatus from './HostelStatus';

const Hostel = ({ onBack }) => {
    const [currentView, setCurrentView] = useState('landing');

    const handleNavigate = (view) => {
        setCurrentView(view);
    };

    const handleBackToLanding = () => {
        setCurrentView('landing');
    };

    if (currentView === 'purchase') {
        return <HostelPurchase onBack={handleBackToLanding} onNavigate={handleNavigate} />;
    }

    if (currentView === 'status') {
        return <HostelStatus onBack={handleBackToLanding} />;
    }

    return <HostelLanding onNavigate={handleNavigate} onBack={onBack} />;
};

export default Hostel;

import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useLoading } from '../../context/GlobalLoadingContext';
import PageHeader from '../../components/PageHeader';
import '../../styles/Hostel.css';
import '../../styles/StandardLayout.css';

const HostelLanding = ({ onNavigate, onBack }) => {
    const { user } = useAuth();
    const { setIsLoading } = useLoading();
    const [hasHostelRoom, setHasHostelRoom] = useState(false);
    const [hostelInfo, setHostelInfo] = useState(null);

    useEffect(() => {
        const fetchHostelStatus = async () => {
            if (!user) return;

            setIsLoading(true);
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.currentHostelRoom) {
                        setHasHostelRoom(true);
                        setHostelInfo({
                            room: userData.currentHostelRoom,
                            nextPaymentDue: userData.hostelNextPaymentDue,
                            monthlyRate: userData.hostelMonthlyRate
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching hostel status:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHostelStatus();
    }, [user, setIsLoading]);

    const handleViewStatus = () => {
        onNavigate('status');
    };

    const handlePurchase = () => {
        onNavigate('purchase');
    };

    return (
        <div className="std-container">
            <PageHeader title="Hostel" onBack={onBack} />

            <main className="std-body">
                <div className="hostel-landing-card">
                    {hasHostelRoom ? (
                        <>
                            <div className="hostel-status-banner">
                                <h2 className="page-title">Your Hostel Room</h2>
                                <div className="room-info-display">
                                    <div className="info-item">
                                        <span className="info-label">Building</span>
                                        <span className="info-value">{hostelInfo.room.buildingName}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Room</span>
                                        <span className="info-value">{hostelInfo.room.roomLabel} - Bed {hostelInfo.room.bedNumber}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Monthly Rate</span>
                                        <span className="info-value">रु {hostelInfo.monthlyRate?.toLocaleString()}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Next Payment</span>
                                        <span className="info-value">
                                            {hostelInfo.nextPaymentDue
                                                ? new Date(hostelInfo.nextPaymentDue).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })
                                                : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                className="btn btn-black btn-block"
                                onClick={handleViewStatus}
                            >
                                View Details & Roommates
                            </button>
                        </>
                    ) : (
                        <>
                            <h1 className="page-title">Hostel Rooms</h1>
                            <p className="page-subtitle">
                                Comfortable and affordable hostel accommodation for students
                            </p>

                            <div className="hostel-features">
                                <div className="feature-item">
                                    <span className="feature-icon">🏢</span>
                                    <span className="feature-text">3 Buildings Available</span>
                                </div>
                                <div className="feature-item">
                                    <span className="feature-icon">🛏️</span>
                                    <span className="feature-text">Single, Double & Triple Rooms</span>
                                </div>
                                <div className="feature-item">
                                    <span className="feature-icon">📅</span>
                                    <span className="feature-text">Flexible Payment Plans</span>
                                </div>
                                <div className="feature-item">
                                    <span className="feature-icon">🚿</span>
                                    <span className="feature-text">Attached Bathroom Options</span>
                                </div>
                            </div>

                            <div className="pricing-info">
                                <h3>Starting From</h3>
                                <div className="price-range">
                                    <span className="price-amount">रु 14,500</span>
                                    <span className="price-period">/month</span>
                                </div>
                                <p className="price-note">
                                    Registration: रु 4,000 (one-time)<br />
                                    Refundable Deposit: रु 5,000
                                </p>
                            </div>

                            <button
                                className="btn btn-black btn-block"
                                onClick={handlePurchase}
                            >
                                Browse Rooms
                            </button>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default HostelLanding;

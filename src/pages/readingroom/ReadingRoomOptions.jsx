import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import FullScreenLoader from '../../components/FullScreenLoader';
import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import '../../styles/StandardLayout.css';

function ReadingRoomOptions({ onBack, onSelectOption, isSidebarOpen, onToggleSidebar }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [hasExistingMembership, setHasExistingMembership] = useState(false);
    const [membershipType, setMembershipType] = useState(null);

    useEffect(() => {
        checkExistingMembership();
    }, [user]);

    const checkExistingMembership = async () => {
        try {
            if (!user) return;

            // Check if user has existing reading room membership in users collection
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().registrationCompleted) {
                setHasExistingMembership(true);
                setMembershipType(userDoc.data().selectedRoomType || null);
            }
        } catch (err) {
            console.error('Error checking membership:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOption = (roomType) => {
        onSelectOption({
            roomType,
            isFirstTime: !hasExistingMembership,
            registrationFee: hasExistingMembership ? 0 : 1000,
            monthlyFee: roomType === 'ac' ? 3750 : 3500
        });
    };

    if (loading) {
        return <FullScreenLoader text="Loading options..." />;
    }

    return (
        <div className="std-container">
            <PageHeader title="Reading Room Options" onBack={onBack} isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />

            <main className="std-body">
                <div style={{ maxWidth: '900px', margin: '0 auto', border: '1px solid #333', padding: '40px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', marginBottom: '10px', textTransform: 'uppercase' }}>
                            Select Room Type
                        </h1>
                        <p style={{ fontSize: '14px', color: '#666' }}>
                            Choose the reading room facility that suits you best
                        </p>
                    </div>

                    {hasExistingMembership && (
                        <div style={{
                            padding: '15px',
                            border: '1px solid #333',
                            marginBottom: '30px',
                            textAlign: 'center',
                            fontSize: '14px'
                        }}>
                            <strong>Note:</strong> You already have a {membershipType === 'ac' ? 'AC' : 'Non-AC'} room membership.
                            Renewing will not charge the registration fee again.
                        </div>
                    )}

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '30px',
                        marginTop: '30px'
                    }}>
                        {/* Non-AC Room Option */}
                        <div
                            onClick={() => handleSelectOption('non-ac')}
                            style={{
                                border: '1px solid #333',
                                padding: '30px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                backgroundColor: '#fff',
                                textAlign: 'center'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f9f9f9';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fff';
                            }}
                        >
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#000', textTransform: 'uppercase' }}>
                                Non-AC Room
                            </h2>
                            <div style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
                                    रु 3,500<span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>/month</span>
                                </div>
                            </div>
                            <ul style={{
                                textAlign: 'left',
                                paddingLeft: '20px',
                                marginBottom: '25px',
                                color: '#333',
                                fontSize: '14px',
                                lineHeight: '1.6'
                            }}>
                                <li>Standard study environment</li>
                                <li>Natural ventilation</li>
                                <li>Basic amenities</li>
                            </ul>
                            <div style={{
                                padding: '15px',
                                backgroundColor: '#f5f5f5',
                                marginBottom: '20px',
                                fontSize: '14px'
                            }}>
                                <div style={{ fontWeight: 'bold', color: '#000' }}>
                                    {hasExistingMembership ? (
                                        <span>Total: रु 3,500/month</span>
                                    ) : (
                                        <span>Total: रु 4,500 (Inc. Registration)</span>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="primary"
                                fullWidth
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectOption('non-ac');
                                }}
                            >
                                Select Non-AC
                            </Button>
                        </div>

                        {/* AC Room Option */}
                        <div
                            onClick={() => handleSelectOption('ac')}
                            style={{
                                border: '1px solid #333',
                                padding: '30px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                backgroundColor: '#fff',
                                textAlign: 'center'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f9f9f9';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fff';
                            }}
                        >
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#000', textTransform: 'uppercase' }}>
                                AC Room
                            </h2>
                            <div style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
                                    रु 3,750<span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>/month</span>
                                </div>
                            </div>
                            <ul style={{
                                textAlign: 'left',
                                paddingLeft: '20px',
                                marginBottom: '25px',
                                color: '#333',
                                fontSize: '14px',
                                lineHeight: '1.6'
                            }}>
                                <li>Air-conditioned environment</li>
                                <li>Premium comfort</li>
                                <li>Priority seating</li>
                            </ul>
                            <div style={{
                                padding: '15px',
                                backgroundColor: '#f5f5f5',
                                marginBottom: '20px',
                                fontSize: '14px'
                            }}>
                                <div style={{ fontWeight: 'bold', color: '#000' }}>
                                    {hasExistingMembership ? (
                                        <span>Total: रु 3,750/month</span>
                                    ) : (
                                        <span>Total: रु 4,750 (Inc. Registration)</span>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="primary"
                                fullWidth
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectOption('ac');
                                }}
                            >
                                Select AC
                            </Button>
                        </div>
                    </div>

                    <div style={{
                        marginTop: '40px',
                        padding: '20px',
                        borderTop: '1px solid #eee',
                        fontSize: '14px',
                        color: '#666'
                    }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#000', fontSize: '16px', fontWeight: 'bold' }}>Payment Information</h3>
                        <ul style={{ paddingLeft: '20px' }}>
                            <li style={{ marginBottom: '5px' }}>
                                <strong>Registration Fee:</strong> रु 1,000 (One-time, only for first-time members)
                            </li>
                            <li style={{ marginBottom: '5px' }}>
                                <strong>Monthly Membership Fee:</strong> Non-AC: रु 3,500 | AC: रु 3,750
                            </li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ReadingRoomOptions;
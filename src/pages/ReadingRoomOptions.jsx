import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import LoadingSpinner from '../components/LoadingSpinner';

function ReadingRoomOptions({ onBack, onSelectOption }) {
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
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <LoadingSpinner size="40" stroke="3" color="#1976d2" />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '20px' }}>
            {/* Back Button */}
            {onBack && (
                <button
                    onClick={onBack}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        background: '#fff',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        color: '#000',
                        fontFamily: 'var(--brand-font-body)',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        marginBottom: '20px',
                        maxWidth: '900px',
                        margin: '0 auto 20px auto'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                        e.currentTarget.style.borderColor = '#d0d0d0';
                        e.currentTarget.style.transform = 'translateX(-2px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.transform = 'translateX(0)';
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back
                </button>
            )}

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
                        <button
                            style={{
                                padding: '12px 30px',
                                backgroundColor: '#000',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                width: '100%',
                                textTransform: 'uppercase'
                            }}
                        >
                            Select Non-AC
                        </button>
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
                        <button
                            style={{
                                padding: '12px 30px',
                                backgroundColor: '#000',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                width: '100%',
                                textTransform: 'uppercase'
                            }}
                        >
                            Select AC
                        </button>
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
        </div>
    );
}

export default ReadingRoomOptions;
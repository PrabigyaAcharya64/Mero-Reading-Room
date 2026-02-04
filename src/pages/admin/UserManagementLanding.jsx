
import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import '../../styles/StandardLayout.css';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner'; // Import LoadingSpinner

const newUserIcon = new URL('../../assets/newuser.svg', import.meta.url).href;
const usersIcon = new URL(/* @vite-ignore */ '../../assets/usermanagement.svg', import.meta.url).href;

function UserManagementLanding({ onBack, onNavigate, onDataLoaded }) {
    const [isPageLoading, setIsPageLoading] = useState(true); // Local loading state
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const pendingQ = query(collection(db, 'users'), orderBy('submittedAt', 'desc'));

        let hasLoaded = false;

        const unsubPending = onSnapshot(pendingQ, (snapshot) => {
            const count = snapshot.docs.filter(doc => {
                const data = doc.data();
                return data.mrrNumber && data.submittedAt && data.verified !== true;
            }).length;
            setPendingCount(count);

            if (!hasLoaded) {
                hasLoaded = true;
                setIsPageLoading(false); // Turn off local loading
                onDataLoaded?.();
            }
        }, (error) => {
            console.error("Error fetching pending users:", error);
            if (!hasLoaded) {
                hasLoaded = true;
                setIsPageLoading(false); // Turn off local loading
                onDataLoaded?.();
            }
        });
        return () => unsubPending();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="std-container">

            <main className="std-body">
                {isPageLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', minHeight: '200px' }}>
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        {/* Landing Services / Buttons */}
                        <section className="landing-services">
                            <div className="landing-services__grid" style={{ justifyContent: 'center' }}>
                                <button
                                    type="button"
                                    className="landing-service-card"
                                    onClick={() => onNavigate('new-users')}
                                    style={{ position: 'relative' }}
                                >
                                    {pendingCount > 0 && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            backgroundColor: '#ef4444',
                                            color: 'white',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            minWidth: '20px',
                                            textAlign: 'center',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }}>
                                            {pendingCount}
                                        </span>
                                    )}
                                    <span className="landing-service-card__icon">
                                        <img src={newUserIcon} alt="" aria-hidden="true" />
                                    </span>
                                    <span className="landing-service-card__label">New Users</span>
                                </button>

                                <button
                                    type="button"
                                    className="landing-service-card"
                                    onClick={() => onNavigate('all-members')}
                                >
                                    <span className="landing-service-card__icon">
                                        <img src={usersIcon} alt="" aria-hidden="true" style={{ opacity: 0.8 }} />
                                    </span>
                                    <span className="landing-service-card__label">All Members</span>
                                </button>
                            </div>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

export default UserManagementLanding;

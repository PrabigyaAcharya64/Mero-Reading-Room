import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import '../../styles/StandardLayout.css';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const newUserIcon = new URL('../../assets/newuser.svg', import.meta.url).href;

function UserManagement({ onBack, onNavigate, isSidebarOpen, onToggleSidebar }) {
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        // Match NewUsers.jsx logic exactly - fetch all users ordered by submittedAt
        const userQ = query(collection(db, 'users'), orderBy('submittedAt', 'desc'));

        const unsubscribe = onSnapshot(userQ, (snapshot) => {
            const count = snapshot.docs.filter(doc => {
                const data = doc.data();
                // Only count users who have submitted details and are not verified
                return data.mrrNumber && data.submittedAt && data.verified !== true;
            }).length;
            setPendingCount(count);
        }, (error) => {
            console.error("Error fetching pending users:", error);
        });

        return () => unsubscribe();
    }, []);

    return (
        <div className="std-container">
            <PageHeader title="User Management" onBack={onBack} isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />

            <main className="std-body">
                <section className="landing-services">
                    <div className="landing-services__grid">
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
                    </div>
                </section>
            </main>
        </div>
    );
}

export default UserManagement;

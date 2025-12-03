import React from 'react';

const newUserIcon = new URL('../../assets/newuser.svg', import.meta.url).href;

function UserManagement({ onBack, onNavigate }) {
    return (
        <div className="landing-screen">
            <header className="landing-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={onBack}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            color: 'var(--color-text-primary)'
                        }}
                    >
                        ←
                    </button>
                    <h2 style={{ margin: 0 }}>User Management</h2>
                </div>
            </header>

            <main className="landing-body">
                <section className="landing-services">
                    <div className="landing-services__grid">
                        <button
                            type="button"
                            className="landing-service-card"
                            onClick={() => onNavigate('new-users')}
                        >
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

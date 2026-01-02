import React from 'react';
import EnhancedBackButton from '../../components/EnhancedBackButton';

const newUserIcon = new URL('../../assets/newuser.svg', import.meta.url).href;

function UserManagement({ onBack, onNavigate }) {
    return (
        <div className="landing-screen">
            {onBack && <EnhancedBackButton onBack={onBack} />}
            <header className="landing-header">
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
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

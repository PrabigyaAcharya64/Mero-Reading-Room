import React from 'react';
import EnhancedBackButton from '../../components/EnhancedBackButton';

function HostelManagement({ onBack }) {
    return (
        <div className="landing-screen">
            <header className="landing-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <EnhancedBackButton onBack={onBack} />
                    <h2 style={{ margin: 0 }}>Hostel Management</h2>
                </div>
            </header>

            <main className="landing-body">
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '50vh',
                    color: 'var(--color-text-secondary)'
                }}>
                    <p>Hostel Management Module - Coming Soon</p>
                </div>
            </main>
        </div>
    );
}

export default HostelManagement;

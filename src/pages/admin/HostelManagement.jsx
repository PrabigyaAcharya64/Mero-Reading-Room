import React from 'react';

function HostelManagement({ onBack }) {
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

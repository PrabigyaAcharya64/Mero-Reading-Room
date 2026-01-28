import React, { useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import '../../styles/StandardLayout.css';

function HostelManagement({ onBack, onDataLoaded }) {
    useEffect(() => {
        onDataLoaded?.();
    }, []);

    return (
        <div className="std-container">
            <PageHeader title="Hostel Management" onBack={onBack} />

            <main className="std-body">
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

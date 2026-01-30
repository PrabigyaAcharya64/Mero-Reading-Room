import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import '../../styles/StandardLayout.css';

const rawIcon = new URL('../../assets/raw.png', import.meta.url).href;
const dryIcon = new URL('../../assets/dry.svg', import.meta.url).href;

const InventoryLanding = ({ onBack, onNavigate, onDataLoaded }) => {
    useEffect(() => {
        onDataLoaded?.();
    }, []);
    return (
        <div className="std-container">
            <main className="std-body">
                {onBack && (
                    <div style={{ marginBottom: '1rem' }}>
                        <button
                            onClick={onBack}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 1rem',
                                backgroundColor: 'transparent',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                color: '#374151',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                    </div>
                )}
                <section className="landing-services">
                    <div className="landing-services__grid">
                        <button
                            type="button"
                            className="landing-service-card"
                            onClick={() => onNavigate('raw-inventory')}
                        >
                            <span className="landing-service-card__icon">
                                <img src={rawIcon} alt="" aria-hidden="true" />
                            </span>
                            <span className="landing-service-card__label">Raw Inventory</span>
                        </button>

                        <button
                            type="button"
                            className="landing-service-card"
                            onClick={() => onNavigate('dry-inventory')}
                        >
                            <span className="landing-service-card__icon">
                                <img src={dryIcon} alt="" aria-hidden="true" />
                            </span>
                            <span className="landing-service-card__label">Dry Inventory</span>
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default InventoryLanding;

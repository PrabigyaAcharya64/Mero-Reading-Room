import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAdminHeader } from '../../context/AdminHeaderContext';
import '../../styles/StandardLayout.css';

const rawIcon = new URL('../../assets/raw.png', import.meta.url).href;
const dryIcon = new URL('../../assets/dry.svg', import.meta.url).href;

const InventoryLanding = ({ onBack, onNavigate, onDataLoaded }) => {
    const { setHeader } = useAdminHeader();
    useEffect(() => {
        setHeader({ title: 'Inventory' });
        onDataLoaded?.();
    }, [setHeader, onDataLoaded]);
    
    return (
        <div className="std-container">
            <main className="std-body">
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

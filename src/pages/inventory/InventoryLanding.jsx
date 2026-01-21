import React from 'react';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import '../../styles/InventoryLanding.css';

const rawIcon = new URL('../../assets/raw.png', import.meta.url).href;
const dryIcon = new URL('../../assets/dry.svg', import.meta.url).href;

const InventoryLanding = ({ onBack, onNavigate }) => {
    return (
        <div className="inventory-landing">
            <div className="inventory-header">
                <EnhancedBackButton onBack={onBack} />
                <h1 className="header-title">Inventory Management</h1>
            </div>

            <div className="inventory-content">
                <div className="inventory-buttons-wrapper">
                    <button
                        className="inventory-main-button"
                        onClick={() => onNavigate('raw-inventory')}
                    >
                        <div className="button-icon-wrapper">
                            <img src={rawIcon} alt="Raw Inventory" />
                        </div>
                        <span className="button-text">Raw Inventory</span>
                    </button>

                    <button
                        className="inventory-main-button"
                        onClick={() => onNavigate('dry-inventory')}
                    >
                        <div className="button-icon-wrapper">
                            <img src={dryIcon} alt="Dry Inventory" />
                        </div>
                        <span className="button-text">Dry Inventory</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InventoryLanding;

import React from 'react';
import './EnhancedBackButton.css';

const EnhancedBackButton = ({ onBack, style }) => {
  return (
    <button 
      className="enhanced-back-button" 
      onClick={onBack}
      style={style}
      aria-label="Go back"
    >
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#000" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
};

export default EnhancedBackButton;

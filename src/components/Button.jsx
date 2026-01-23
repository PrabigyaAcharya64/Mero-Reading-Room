import React from 'react';
import './Button.css';
import LoadingSpinner from './LoadingSpinner';

const Button = ({
    children,
    variant = 'primary', // primary, secondary, outline, ghost, danger
    size = 'md', // sm, md, lg
    fullWidth = false,
    loading = false,
    disabled = false,
    className = '',
    icon,
    type = 'button',
    onClick,
    ...props
}) => {
    const baseClass = 'std-button';
    const variantClass = `std-button--${variant}`;
    const sizeClass = `std-button--${size}`;
    const widthClass = fullWidth ? 'std-button--full' : '';

    return (
        <button
            type={type}
            className={`${baseClass} ${variantClass} ${sizeClass} ${widthClass} ${className}`}
            disabled={disabled || loading}
            onClick={onClick}
            {...props}
        >
            {loading && (
                <LoadingSpinner
                    size={size === 'sm' ? '14' : '20'}
                    stroke={size === 'sm' ? '2' : '3'}
                    color="currentColor"
                />
            )}
            {!loading && icon && <span className="std-button__icon">{icon}</span>}
            {children}
        </button>
    );
};

export default Button;

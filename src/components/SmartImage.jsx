import React, { useState, useEffect } from 'react';
import { useLoading } from '../context/GlobalLoadingContext';

/**
 * SmartImage
 * A professional image component that automatically tracks its loading state
 * in the global loading system and uses a smooth fade-in transition.
 */
const SmartImage = ({ src, alt, className, style, ...props }) => {
    const { registerResource, resolveResource } = useLoading();
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        if (!src) return;

        registerResource();

        const img = new Image();
        img.src = src;

        img.onload = () => {
            setIsLoaded(true);
            resolveResource();
        };

        img.onerror = () => {
            setHasError(true);
            resolveResource();
        };

        return () => {
            // If the component unmounts before loading, we still need to resolve
            if (!isLoaded && !hasError) {
                resolveResource();
            }
        };
    }, [src, registerResource, resolveResource]);

    return (
        <img
            src={src}
            alt={alt}
            className={`${className || ''} smart-image ${isLoaded ? 'loaded' : 'loading'}`}
            style={{
                ...style,
                opacity: isLoaded ? 1 : 0,
                transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                filter: isLoaded ? 'none' : 'blur(10px)'
            }}
            {...props}
        />
    );
};

export default SmartImage;

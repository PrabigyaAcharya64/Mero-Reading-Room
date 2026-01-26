import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import FullScreenLoader from '../components/FullScreenLoader';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isManualLoading, setIsManualLoading] = useState(false);
    const [pendingResources, setPendingResources] = useState(0);
    const [isSplashActive, setIsSplashActive] = useState(true);
    const [isRevealed, setIsRevealed] = useState(false);

    // Derived loading state
    const isLoading = useMemo(() => {
        return isManualLoading || pendingResources > 0 || isSplashActive;
    }, [isManualLoading, pendingResources, isSplashActive]);

    // Handle delayed reveal to prevent flashes
    useEffect(() => {
        if (!isLoading) {
            // Small delay to ensure smooth transition after everything is ready
            const timer = setTimeout(() => {
                setIsRevealed(true);
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setIsRevealed(false);
        }
    }, [isLoading]);

    const registerResource = useCallback(() => {
        setPendingResources(prev => prev + 1);
    }, []);

    const resolveResource = useCallback(() => {
        setPendingResources(prev => Math.max(0, prev - 1));
    }, []);

    const setSplashDone = useCallback(() => {
        // Ensure splash screen stays at least long enough for initial mount
        setTimeout(() => {
            setIsSplashActive(false);
        }, 300);
    }, []);

    // Safety timeout
    useEffect(() => {
        if (isLoading) {
            const timer = setTimeout(() => {
                console.warn('Loading safety timeout reached');
                setPendingResources(0);
                setIsSplashActive(false);
                setIsManualLoading(false);
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    const contextValue = useMemo(() => ({
        isLoading,
        setIsLoading: setIsManualLoading,
        registerResource,
        resolveResource,
        setSplashDone,
        isSplashActive
    }), [isLoading, registerResource, resolveResource, setSplashDone, isSplashActive]);

    return (
        <LoadingContext.Provider value={contextValue}>
            {isLoading && <FullScreenLoader />}
            <div
                className={`app-container-wrapper ${isRevealed ? 'revealed' : 'hidden'}`}
                style={{
                    visibility: isRevealed ? 'visible' : 'hidden',
                    opacity: isRevealed ? 1 : 0,
                    transform: isRevealed ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                    width: '100%',
                    height: '100dvh', // Use dynamic viewport height
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                {children}
            </div>
        </LoadingContext.Provider>
    );
};

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
};

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import FullScreenLoader from '../components/FullScreenLoader';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoadingState] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [shouldShowContent, setShouldShowContent] = useState(false);

    const loadingStartTime = useRef(0);
    const MIN_LOADING_TIME = 800; // Increased for a more premium feel
    const FADE_DURATION = 400;

    const setIsLoading = useCallback((loading) => {
        if (loading) {
            loadingStartTime.current = Date.now();
            setIsFadingOut(false);
            setShouldShowContent(false);
            setIsLoadingState(true);
        } else {
            const currentTime = Date.now();
            const elapsed = currentTime - loadingStartTime.current;
            const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);

            // Wait for minimum loading time to prevent flashes
            setTimeout(() => {
                setIsFadingOut(true);
                // Begin revealing content slightly before the loader is fully gone
                setTimeout(() => setShouldShowContent(true), 100);

                // Final cleanup after fade animation
                setTimeout(() => {
                    setIsLoadingState(false);
                    setIsFadingOut(false);
                }, FADE_DURATION);
            }, remaining);
        }
    }, []);

    return (
        <LoadingContext.Provider value={{ isLoading, setIsLoading, isFadingOut, shouldShowContent }}>
            {isLoading && <FullScreenLoader isFadingOut={isFadingOut} />}
            <div className={`reveal-container ${shouldShowContent ? 'active' : ''}`}>
                {children}
            </div>
        </LoadingContext.Provider>
    );
};

export const useLoading = () => useContext(LoadingContext);

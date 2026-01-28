import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import FullScreenLoader from '../components/FullScreenLoader';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoadingState] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [shouldShowContent, setShouldShowContent] = useState(false);

    const loadingStartTime = useRef(0);
    const MIN_LOADING_TIME = 600;
    const FADE_DURATION = 300;

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

            setTimeout(() => {
                setIsFadingOut(true);
                setShouldShowContent(true);

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

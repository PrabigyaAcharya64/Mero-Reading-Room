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

<<<<<<< Updated upstream
    const setIsLoading = useCallback((loading) => {
        if (loading) {
            loadingStartTime.current = Date.now();
            setIsFadingOut(false);
            setShouldShowContent(false);
            setIsLoadingState(true);
=======
    // Handle delayed reveal to prevent flashes
    useEffect(() => {
        if (!isLoading) {
            // Small delay to ensure smooth transition after everything is ready
            const timer = setTimeout(() => {
                setIsRevealed(true);
            }, 20);


            return () => clearTimeout(timer);
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
=======
    const resolveResource = useCallback(() => {
        setPendingResources(prev => Math.max(0, prev - 1));
    }, []);

    const setSplashDone = useCallback(() => {
        // Reduced delay for a snappier feel while still preventing layout flickers
        setTimeout(() => {
            setIsSplashActive(false);
        }, 50);
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

>>>>>>> Stashed changes
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

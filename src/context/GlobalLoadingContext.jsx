import React, { createContext, useContext, useState } from 'react';
import FullScreenLoader from '../components/FullScreenLoader';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);

    return (
        <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
            {isLoading && <FullScreenLoader text={null} />}
            <div style={{ visibility: isLoading ? 'hidden' : 'visible' }}>
                {children}
            </div>
        </LoadingContext.Provider>
    );
};

export const useLoading = () => useContext(LoadingContext);

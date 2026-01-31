import React, { createContext, useContext, useState, useCallback } from 'react';

const AdminHeaderContext = createContext();

export const useAdminHeader = () => {
    const context = useContext(AdminHeaderContext);
    if (!context) {
        throw new Error('useAdminHeader must be used within an AdminHeaderProvider');
    }
    return context;
};

export const AdminHeaderProvider = ({ children }) => {
    const [headerProps, setHeaderProps] = useState({
        title: '',
        onBack: null,
        rightElement: null
    });

    const setHeader = useCallback((props) => {
        setHeaderProps(prev => ({ ...prev, ...props }));
    }, []);

    const resetHeader = useCallback(() => {
        setHeaderProps({
            title: '',
            onBack: null,
            rightElement: null
        });
    }, []);

    return (
        <AdminHeaderContext.Provider value={{ headerProps, setHeader, resetHeader }}>
            {children}
        </AdminHeaderContext.Provider>
    );
};

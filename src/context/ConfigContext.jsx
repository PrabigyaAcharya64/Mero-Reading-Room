import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { CONFIG as DEFAULT_CONFIG } from '../config';

const ConfigContext = createContext();

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Subscribe to real-time updates from Firestore
        const settingsRef = doc(db, 'settings', 'config');
        const unsubscribe = onSnapshot(settingsRef, (docSnapshot) => {
            console.log("ConfigContext: Snapshot received", { exists: docSnapshot.exists(), data: docSnapshot.data() });
            if (docSnapshot.exists()) {
                // deep merge or just simpler replacement?
                // For now, let's assume the DB structure matches the CONFIG structure.
                // We merge with default to ensure new fields in default are present if missing in DB.
                const dbConfig = docSnapshot.data();
                setConfig(prevConfig => ({
                    ...prevConfig,
                    ...dbConfig,
                    READING_ROOM: { ...prevConfig.READING_ROOM, ...dbConfig.READING_ROOM },
                    WALLET: { ...prevConfig.WALLET, ...dbConfig.WALLET },
                    HOSTEL: { ...prevConfig.HOSTEL, ...dbConfig.HOSTEL }
                }));
            } else {
                // If doc doesn't exist, we can optionally create it with defaults
                // or just use defaults in memory.
                // Let's create it so admins have something to edit immediately.
                setDoc(settingsRef, DEFAULT_CONFIG).catch(err =>
                    console.error("Failed to initialize settings doc:", err)
                );
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching config:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateConfig = async (newConfig) => {
        try {
            await setDoc(doc(db, 'settings', 'config'), newConfig, { merge: true });
            return { success: true };
        } catch (error) {
            console.error("Error updating config:", error);
            return { success: false, error };
        }
    };

    const value = {
        config,
        loading,
        updateConfig
    };

    return (
        <ConfigContext.Provider value={value}>
            {children}
        </ConfigContext.Provider>
    );
};

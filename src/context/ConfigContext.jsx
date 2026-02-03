import { createContext, useContext, useState, useEffect } from 'react';
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

// Helper for deep merging objects
const deepMerge = (target, source) => {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

const isObject = (item) => {
    return (item && typeof item === 'object' && !Array.isArray(item));
};

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        let unsubscribe = () => { };

        // Safety timeout: Ensure we stop loading after 3 seconds even if Firestore is slow/offline
        const safetyTimeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn('Config load timeout - using defaults');
                setLoading(false);
            }
        }, 3000);

        try {
            unsubscribe = onSnapshot(doc(db, 'settings', 'config'), (docSnapshot) => {
                if (!mounted) return;

                if (docSnapshot.exists()) {
                    // Deep merge fetched config with defaults to ensure no missing keys
                    const fetchedConfig = docSnapshot.data();
                    const mergedConfig = deepMerge({ ...DEFAULT_CONFIG }, fetchedConfig);
                    setConfig(mergedConfig);
                } else {
                    // Initialize if missing (optional, but good for first run)
                    // We don't await here to avoid blocking
                    setDoc(doc(db, 'settings', 'config'), DEFAULT_CONFIG, { merge: true })
                        .catch(err => console.error("Failed to init config", err));
                }
                setLoading(false);
                clearTimeout(safetyTimeout);
            }, (error) => {
                console.error('Error fetching config:', error);
                if (mounted) setLoading(false);
                clearTimeout(safetyTimeout);
            });
        } catch (err) {
            console.error('Setup error in ConfigContext:', err);
            if (mounted) setLoading(false);
            clearTimeout(safetyTimeout);
        }

        return () => {
            mounted = false;
            clearTimeout(safetyTimeout);
            unsubscribe();
        };
    }, []);

    const updateConfig = async (newConfig) => {
        try {
            // We only update what's changed, but passing the whole object is also fine with merge: true
            // However, to be safe and efficient, we just write the new state.
            await setDoc(doc(db, 'settings', 'config'), newConfig, { merge: true });
            return { success: true };
        } catch (error) {
            console.error('Error updating config:', error);
            return { success: false, error };
        }
    };

    return (
        <ConfigContext.Provider value={{ config, updateConfig, loading }}>
            {children}
        </ConfigContext.Provider>
    );
};

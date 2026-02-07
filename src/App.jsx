import { useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { NavigationRoot } from './navigation';
import FullScreenLoader from './components/FullScreenLoader';
import { LoadingProvider, useLoading } from './context/GlobalLoadingContext';
import { ConfigProvider } from './context/ConfigContext';

function AppShell() {
    const { loading } = useAuth();
    const { setIsLoading } = useLoading();

    useEffect(() => {
        // Sync global loading with auth loading state
        setIsLoading(loading);
    }, [loading, setIsLoading]);

    if (loading) return null;

    return (
        <>
            <NavigationRoot />
            <div style={{
                position: 'fixed',
                bottom: 5,
                right: 5,
                background: '#dc2626',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                zIndex: 9999,
                fontSize: '11px',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
                v4.0 - Bulk SMS Fix
            </div>
        </>
    );
}

function App() {
    return (
        <AuthProvider>
            <LoadingProvider>
                <ConfigProvider>
                    <AppShell />
                </ConfigProvider>
            </LoadingProvider>
        </AuthProvider>
    );
}

export default App;
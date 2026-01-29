import { useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { NavigationRoot } from './navigation';
import FullScreenLoader from './components/FullScreenLoader';
import { LoadingProvider, useLoading } from './context/GlobalLoadingContext';

function AppShell() {
    const { loading } = useAuth();
    const { setIsLoading } = useLoading();

    useEffect(() => {
        // Sync global loading with auth loading state
        setIsLoading(loading);
    }, [loading, setIsLoading]);

    if (loading) return null;

    return <NavigationRoot />;
}

function App() {
    return (
        <AuthProvider>
            <LoadingProvider>
                <AppShell />
            </LoadingProvider>
        </AuthProvider>
    );
}

export default App;
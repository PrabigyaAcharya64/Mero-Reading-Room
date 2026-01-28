import { useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { NavigationRoot } from './navigation';
import FullScreenLoader from './components/FullScreenLoader';
import { LoadingProvider, useLoading } from './context/GlobalLoadingContext';

function AppShell() {
    const { loading } = useAuth();
    const { setIsLoading } = useLoading();

    useEffect(() => {
        // Only trigger global loader if it's the initial auth loading
        if (loading) {
            setIsLoading(true);
        }
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
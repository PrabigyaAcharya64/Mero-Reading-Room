import { AuthProvider, useAuth } from './auth/AuthProvider';
import { NavigationRoot } from './navigation';
import FullScreenLoader from './components/FullScreenLoader';
import { LoadingProvider } from './context/GlobalLoadingContext';

function AppShell() {
    const { loading } = useAuth();

    if (loading) {
        return <FullScreenLoader />;
    }

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
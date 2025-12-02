import { AuthProvider, useAuth } from './auth/AuthProvider';
import { NavigationRoot } from './navigation';
import FullScreenLoader from './components/FullScreenLoader';

function AppShell() {
    const { loading } = useAuth();

    if (loading) {
        return <FullScreenLoader text="Loading your account..." />;
    }

    return <NavigationRoot />;
}

function App() {
    return (
        <AuthProvider>
            <AppShell />
        </AuthProvider>
    );
}

export default App;
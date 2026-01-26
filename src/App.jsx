import { AuthProvider } from './auth/AuthProvider';
import { NavigationRoot } from './navigation';
import { LoadingProvider } from './context/GlobalLoadingContext';

function AppShell() {
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
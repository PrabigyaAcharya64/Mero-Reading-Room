import { AuthProvider, useAuth } from './auth/AuthProvider';
import { NavigationRoot } from './navigation';

function Loader() {
  return <div className="app-loader">Loading…</div>;
}

function AppShell() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-screen">
        <Loader />
      </div>
    );
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

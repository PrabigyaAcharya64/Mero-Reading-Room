import { useState } from 'react';
import GetStarted from '../pages/GetStarted';
import Login from '../pages/Login';
import SignUp from '../pages/SignUp';
import LandingPage from '../pages/LandingPage';
import AdminLanding from '../pages/AdminLanding';
import CanteenLanding from '../pages/Canteen/CanteenLanding';
import { useAuth } from '../auth/AuthProvider';

export function NavigationRoot() {
  const { user, userRole } = useAuth();
  const [mode, setMode] = useState('intro');

  if (user) {
    return <AppStack userRole={userRole} />;
  }

  return <AuthStack mode={mode} onChangeMode={setMode} />;
}

export function AuthStack({ mode, onChangeMode }) {
  if (mode === 'login') {
    return <Login onSwitch={() => onChangeMode('signup')} />;
  }

  if (mode === 'signup') {
    return <SignUp onSwitch={() => onChangeMode('login')} />;
  }

  return (
    <GetStarted onGetStarted={() => onChangeMode('signup')} onLogIn={() => onChangeMode('login')} />
  );
}

export function AppStack({ userRole }) {
  // Redirect based on user role
  if (userRole === 'admin') {
    return <AdminLanding />;
  }
  
  if (userRole === 'canteen') {
    return <CanteenLanding />;
  }
  
  // Default landing page for users without a specific role
  return <LandingPage />;
}


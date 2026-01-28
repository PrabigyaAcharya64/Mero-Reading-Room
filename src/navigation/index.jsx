import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
<<<<<<< Updated upstream
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
=======
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
>>>>>>> Stashed changes
import GetStarted from '../pages/GetStarted';
import Login from '../pages/Login';
import SignUp from '../pages/SignUp';
import AdditionalDetails from '../pages/AdditionalDetails';
import PendingVerification from '../pages/PendingVerification';
import LandingPage from '../pages/LandingPage';
import AdminLanding from '../pages/admin/AdminLanding';
import CanteenAdminLanding from '../pages/Canteen_Admin/CanteenAdminLanding';
import { useAuth } from '../auth/AuthProvider';
import { useLoading } from '../context/GlobalLoadingContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Protected Route Component
function ProtectedRoute({ children, requiredRole }) {
    const { user, userRole, loading } = useAuth();
    const { setIsLoading } = useLoading();
    const [isVerified, setIsVerified] = useState(null);
    const [needsDetails, setNeedsDetails] = useState(false);
    const [checking, setChecking] = useState(true);
    const location = useLocation();

    useEffect(() => {
        async function checkStatus() {
            if (!user) {
                setChecking(false);
                return;
            }

            // Staff don't need verification check
            if (userRole === 'admin' || userRole === 'canteen') {
                setIsVerified(true);
                setChecking(false);
                return;
            }

            try {
                const docRef = doc(db, 'users', user.uid);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (!data.mrrNumber || !data.submittedAt) {
                        setNeedsDetails(true);
                        setIsVerified(false);
                    } else {
                        setIsVerified(data.verified === true);
                        setNeedsDetails(false);
                    }
                } else {
                    setNeedsDetails(true);
                    setIsVerified(false);
                }
            } catch (e) {
                console.error("Status check failed", e);
            } finally {
                setChecking(false);
            }
        }
        if (!loading) checkStatus();
    }, [user, userRole, loading]);

<<<<<<< Updated upstream
    useEffect(() => {
        if (loading || checking) {
            setIsLoading(true);
=======
    // Determine which stack to render
    const renderContent = () => {
        // While auth is loading or we are checking verification for a user,
        // we return null to keep the splash screen active and avoid partial renders.
        if (authLoading || (user && checkingVerification)) {
            return null;
        }

        if (user) {
            if (needsAdditionalDetails) {
                return (
                    <PageTransition key="additional-details">
                        <AdditionalDetails
                            onComplete={() => {
                                setNeedsAdditionalDetails(false);
                                setMode('pending-verification');
                            }}
                        />
                    </PageTransition>
                );
            }

            if (isVerified === false) {
                return (
                    <PageTransition key="pending-verification">
                        <PendingVerification />
                    </PageTransition>
                );
            }

            return (
                <PageTransition key="app-stack">
                    <AppStack userRole={userRole} onNavigateRoot={handleRootNavigate} />
                </PageTransition>
            );
>>>>>>> Stashed changes
        }
    }, [loading, checking, setIsLoading]);

    if (loading || checking) return null;

<<<<<<< Updated upstream
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
=======
    return (
        <AnimatePresence mode="wait">
            {renderContent()}
        </AnimatePresence>
    );
}

export function AuthStack({ mode, onChangeMode }) {
    const getContent = () => {
        if (mode === 'login') {
            return <Login onSwitch={() => onChangeMode('signup')} />;
        }
        if (mode === 'signup') {
            return <SignUp onSwitch={() => onChangeMode('login')} onComplete={() => onChangeMode('additional-details')} />;
        }
        if (mode === 'additional-details' || mode === 'pending-verification') {
            return mode === 'additional-details' ? <AdditionalDetails onComplete={() => onChangeMode('pending-verification')} /> : <PendingVerification />;
        }
        return <GetStarted onGetStarted={() => onChangeMode('signup')} onLogIn={() => onChangeMode('login')} />;
    };

    return (
        <motion.div
            key={mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ width: '100%', height: '100%' }}
        >
            {getContent()}
        </motion.div>
    );
}

export function AppStack({ userRole, onNavigateRoot }) {
    if (userRole === 'admin') {
        return (
            <Routes>
                <Route path="/admin/*" element={<AdminLanding onNavigateRoot={onNavigateRoot} />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
        );
>>>>>>> Stashed changes
    }

    if (needsDetails && location.pathname !== '/onboarding/details') {
        return <Navigate to="/onboarding/details" replace />;
    }

    if (!isVerified && !needsDetails && location.pathname !== '/onboarding/pending' && userRole !== 'admin' && userRole !== 'canteen') {
        return <Navigate to="/onboarding/pending" replace />;
    }

    if (requiredRole && userRole !== requiredRole) {
        return <Navigate to="/" replace />;
    }

    return children;
}

export function NavigationRoot() {
    const { user, userRole, loading } = useAuth();
    const { setIsLoading } = useLoading();

    useEffect(() => {
        if (loading) setIsLoading(true);
    }, [loading, setIsLoading]);

    // Global loading state
    if (loading) return null;

    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/intro" element={!user ? <GetStarted /> : <Navigate to="/" replace />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
            <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/" replace />} />

            {/* Onboarding Routes (Protected but logic inside ProtectedRoute handles these) */}
            <Route path="/onboarding/details" element={
                <ProtectedRoute>
                    <AdditionalDetails />
                </ProtectedRoute>
            } />
            <Route path="/onboarding/pending" element={
                <ProtectedRoute>
                    <PendingVerification />
                </ProtectedRoute>
            } />

            {/* App Routes */}
            <Route path="/admin/*" element={
                <ProtectedRoute requiredRole="admin">
                    <AdminLanding />
                </ProtectedRoute>
            } />

            <Route path="/canteen-admin/*" element={
                <ProtectedRoute requiredRole="canteen">
                    <CanteenAdminLanding />
                </ProtectedRoute>
            } />

            {/* Default Landing / Catch-all */}
            <Route path="/*" element={
                <ProtectedRoute>
                    {userRole === 'admin' ? <Navigate to="/admin" replace /> :
                        userRole === 'canteen' ? <Navigate to="/canteen-admin" replace /> :
                            <LandingPage />}
                </ProtectedRoute>
            } />
        </Routes>
    );
}

// Keeping components for backwards compatibility during refactor if needed
export function AuthStack() { return <Navigate to="/intro" replace />; }
export function AppStack() { return <Navigate to="/" replace />; }
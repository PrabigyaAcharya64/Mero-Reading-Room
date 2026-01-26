import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
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
import PageTransition from '../components/PageTransition';

export function NavigationRoot() {
    const { user, userRole, loading: authLoading } = useAuth();
    const { setSplashDone } = useLoading();
    const location = useLocation();

    // Check URL params for pending verification
    const urlParams = new URLSearchParams(window.location.search);
    const initialMode = urlParams.get('pending') === 'true' ? 'pending-verification' : 'intro';

    const [selectedUser, setSelectedUser] = useState(null);
    const [mode, setMode] = useState(initialMode);
    const [needsAdditionalDetails, setNeedsAdditionalDetails] = useState(false);
    const [isVerified, setIsVerified] = useState(null);
    const [checkingVerification, setCheckingVerification] = useState(false);

    const handleRootNavigate = (newMode, userData = null) => {
        if (userData) setSelectedUser(userData);
        setMode(newMode);
    };

    // Replace legacy timer with splash completion logic
    useEffect(() => {
        if (!authLoading && !checkingVerification) {
            // Signal that we are ready to reveal the app
            setSplashDone();
        }
    }, [authLoading, checkingVerification, setSplashDone]);

    useEffect(() => {
        if (user && !authLoading) {
            checkUserStatus();
        }
    }, [user, authLoading]);

    const checkUserStatus = async () => {
        if (!user) return;

        if (userRole === 'admin' || userRole === 'canteen') {
            setIsVerified(true);
            return;
        }

        try {
            setCheckingVerification(true);
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (!userData.mrrNumber || !userData.submittedAt) {
                    setNeedsAdditionalDetails(true);
                    setIsVerified(false);
                } else {
                    setIsVerified(userData.verified === true);
                    setNeedsAdditionalDetails(false);
                }
            } else {
                setNeedsAdditionalDetails(true);
                setIsVerified(false);
            }
        } catch (error) {
            console.error('Error checking user status:', error);
            setIsVerified(false);
        } finally {
            setCheckingVerification(false);
        }
    };

    // Determine which stack to render
    const renderContent = () => {
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
        }

        return (
            <PageTransition key="auth-stack">
                <AuthStack mode={mode} onChangeMode={setMode} />
            </PageTransition>
        );
    };

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
            // These cases are handled in NavigationRoot but kept for safety
            return mode === 'additional-details' ? <AdditionalDetails onComplete={() => onChangeMode('pending-verification')} /> : <PendingVerification />;
        }
        return <GetStarted onGetStarted={() => onChangeMode('signup')} onLogIn={() => onChangeMode('login')} />;
    };

    return (
        <AnimatePresence mode="wait">
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
        </AnimatePresence>
    );
}

// Helper to provide motion to AuthStack items
import { motion } from 'framer-motion';

export function AppStack({ userRole, onNavigateRoot }) {
    if (userRole === 'admin') {
        return (
            <Routes>
                <Route path="/admin/*" element={<AdminLanding onNavigateRoot={onNavigateRoot} />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
        );
    }

    if (userRole === 'canteen') {
        return <CanteenAdminLanding />;
    }

    return (
        <Routes>
            <Route path="/*" element={<LandingPage />} />
        </Routes>
    );
}
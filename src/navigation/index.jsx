import { useState, useEffect } from 'react';
import GetStarted from '../pages/GetStarted';
import Login from '../pages/Login';
import SignUp from '../pages/SignUp';
import AdditionalDetails from '../pages/AdditionalDetails';
import PendingVerification from '../pages/PendingVerification';
import LandingPage from '../pages/LandingPage';
import AdminLanding from '../pages/admin/AdminLanding';
import CanteenLanding from '../pages/Canteen/CanteenClientLanding';
import { useAuth } from '../auth/AuthProvider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import FullScreenLoader from '../components/FullScreenLoader';

export function NavigationRoot() {
    const { user, userRole, loading } = useAuth();

    // Check URL params for pending verification
    const urlParams = new URLSearchParams(window.location.search);
    const initialMode = urlParams.get('pending') === 'true' ? 'pending-verification' : 'intro';

    const [mode, setMode] = useState(initialMode);
    const [needsAdditionalDetails, setNeedsAdditionalDetails] = useState(false);
    const [isVerified, setIsVerified] = useState(null);
    const [checkingVerification, setCheckingVerification] = useState(false);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    useEffect(() => {
        // Set initial load complete after a short delay to ensure smooth transitions
        const timer = setTimeout(() => {
            setInitialLoadComplete(true);
        }, 500);
        
        return () => clearTimeout(timer);
    }, []);

    // Handle browser back button
    useEffect(() => {
        // Push initial state to history
        window.history.pushState({ page: 'app' }, '', window.location.href);
        
        const handlePopState = (event) => {
            // Prevent default back navigation
            event.preventDefault();
            
            // Push state again to keep user in the app
            window.history.pushState({ page: 'app' }, '', window.location.href);
            
            // Optionally, you can add logic here to navigate within the app
            // For example, if you're on a sub-page, go back to the main page
            console.log('Back button pressed - staying in app');
        };
        
        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    useEffect(() => {
        if (user && !loading) {
            checkUserStatus();
        }
    }, [user, loading]);

    const checkUserStatus = async () => {
        if (!user) return;

        // Admin and canteen users don't need verification
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

                // Check if user has submitted additional details
                if (!userData.mrrNumber || !userData.submittedAt) {
                    setNeedsAdditionalDetails(true);
                    setIsVerified(false);
                } else {
                    // Check verification status
                    setIsVerified(userData.verified === true);
                    setNeedsAdditionalDetails(false);
                }
            } else {
                // User document doesn't exist, needs additional details
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

    // Show full screen loader during initial app load or auth checking
    if (loading || checkingVerification || !initialLoadComplete) {
        let loadingText = "Loading your account...";
        if (checkingVerification) {
            loadingText = "Verifying your account...";
        } else if (!initialLoadComplete) {
            loadingText = "Initializing application...";
        }
        
        return <FullScreenLoader text={loadingText} />;
    }

    if (user) {
        // If user needs to complete additional details
        if (needsAdditionalDetails) {
            return (
                <AdditionalDetails
                    onComplete={() => {
                        setNeedsAdditionalDetails(false);
                        setMode('pending-verification');
                    }}
                />
            );
        }

        // If user is not verified, show pending verification page
        if (isVerified === false) {
            return <PendingVerification />;
        }

        // User is verified, proceed to app
        return <AppStack userRole={userRole} />;
    }

    return <AuthStack mode={mode} onChangeMode={setMode} />;
}

export function AuthStack({ mode, onChangeMode }) {
    if (mode === 'login') {
        return <Login onSwitch={() => onChangeMode('signup')} />;
    }

    if (mode === 'signup') {
        return <SignUp onSwitch={() => onChangeMode('login')} onComplete={() => onChangeMode('additional-details')} />;
    }

    if (mode === 'additional-details') {
        return (
            <AdditionalDetails
                onComplete={() => {
                    onChangeMode('pending-verification');
                }}
            />
        );
    }

    if (mode === 'pending-verification') {
        return <PendingVerification />;
    }

    // Check if we should show pending verification from URL or session
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pending') === 'true') {
        return <PendingVerification />;
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
import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useLoading } from '../../context/GlobalLoadingContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

import HostelLanding from './HostelLanding';
import HostelPurchase from './HostelPurchase';
import HostelStatus from './HostelStatus';
import HostelEnrollmentForm from './HostelEnrollmentForm';
import HostelRules from './HostelRules';

const Hostel = ({ onBack }) => {
    const { user } = useAuth();
    const { setIsLoading } = useLoading();

    // View state: 'loading', 'landing', 'purchase', 'status', 'enrollment_form', 'enrollment_rules'
    const [view, setView] = useState('loading');

    // Enrollment data state
    const [enrollmentData, setEnrollmentData] = useState({
        formData: null,
        photoFile: null,
        photoPreview: null
    });

    useEffect(() => {
        const checkEnrollmentStatus = async () => {
            if (!user) {
                setView('landing');
                return;
            }

            try {
                // If we're already checking or determining view, we might want to skip or ensure loading
                // But typically on mount we check.

                // We check if the user has the 'hostelEnrolled' flag or 'hostelRegistrationDate'
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.hostelEnrolled || userData.hostelRegistrationDate) {
                        // Already enrolled, go to landing
                        setView('landing');
                    } else {
                        // Not enrolled, force enrollment flow
                        setView('enrollment_form');
                    }
                } else {
                    // No user doc? Should mean not enrolled
                    setView('enrollment_form');
                }
            } catch (error) {
                console.error("Error checking hostel enrollment:", error);
                setView('landing'); // Fallback to landing if error, though might bug out if they try to buy room without enrollment
            }
        };

        checkEnrollmentStatus();
    }, [user]);

    // Navigation Handlers for Enrollment
    const handleEnrollmentNext = (data) => {
        setEnrollmentData(prev => ({ ...prev, ...data }));
        setView('enrollment_rules');
    };

    const handleEnrollmentBack = () => {
        setView('enrollment_form');
    };

    const handleEnrollmentComplete = () => {
        // After successful enrollment, the user doc is updated.
        // We can switch to landing.
        setView('landing');
    };

    const handleGeneralBack = () => {
        if (view === 'purchase' || view === 'status') {
            setView('landing');
        } else if (view === 'enrollment_form') {
            // If they back out of compulsory enrollment, they go back to Main App Home
            onBack();
        } else {
            onBack();
        }
    };

    const handleNavigate = (target) => {
        setView(target);
    };

    if (view === 'loading') {
        // Since global loader overlay might be active, we can just return null or a loader
        return null;
    }

    if (view === 'enrollment_form') {
        return (
            <HostelEnrollmentForm
                onNext={handleEnrollmentNext}
                initialData={enrollmentData}
                onBack={onBack} // Back from here goes to App Home
            />
        );
    }

    if (view === 'enrollment_rules') {
        return (
            <HostelRules
                onBack={handleEnrollmentBack}
                formData={enrollmentData.formData}
                photoFile={enrollmentData.photoFile}
                onComplete={handleEnrollmentComplete}
            />
        );
    }

    if (view === 'purchase') {
        return <HostelPurchase onBack={() => setView('landing')} onNavigate={handleNavigate} />;
    }

    if (view === 'status') {
        return <HostelStatus onBack={() => setView('landing')} />;
    }

    // Default: 'landing'
    return <HostelLanding onNavigate={handleNavigate} onBack={onBack} />;
};

export default Hostel;

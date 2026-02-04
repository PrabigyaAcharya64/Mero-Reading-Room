import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { uploadImageSecurely } from '../../utils/imageUpload';
import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import { useLoading } from '../../context/GlobalLoadingContext';
import { FileText } from 'lucide-react';

function HostelRules({ onBack, formData, photoFile, onComplete }) {
    const { user } = useAuth();
    const { setIsLoading } = useLoading();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [agreementData, setAgreementData] = useState({
        agreedToRules: false,
        date: new Date().toISOString().split('T')[0],
        place: ''
    });

    const [signatureFile, setSignatureFile] = useState(null);
    const [signaturePreview, setSignaturePreview] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setAgreementData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        setError('');
    };

    const handleSignatureChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError('Signature size should be less than 2MB');
                return;
            }
            setSignatureFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setSignaturePreview(reader.result);
            };
            reader.readAsDataURL(file);
            setError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!agreementData.agreedToRules) {
            setError('You must read and agree to all rules and regulations.');
            return;
        }

        if (!agreementData.place) {
            setError('Please enter the place (e.g., Kathmandu).');
            return;
        }

        if (!photoFile && !user.photoURL) {
            setError('Photo is missing. Please go back and upload a photo.');
            return;
        }

        // Signature is optional in some flows but good for "contract". 
        // The reading room one required it. Let's make it required here too for strictness.
        if (!signatureFile) {
            setError('Please upload your digital signature/image of signature.');
            return;
        }

        setSubmitting(true);
        setIsLoading(true);

        try {
            // 1. Upload Images
            let photoUrl = user.photoURL;
            if (photoFile) {
                photoUrl = await uploadImageSecurely(photoFile);
            }

            let signatureUrl = '';
            if (signatureFile) {
                signatureUrl = await uploadImageSecurely(signatureFile);
            }

            // 2. Update Auth Profile
            if (user && formData.name && formData.name !== user.displayName) {
                await updateProfile(user, { displayName: formData.name });
            }

            // 3. Save to Firestore
            // We combine the form data from Step 1 and Agreement data from Step 2
            const userDocRef = doc(db, 'users', user.uid);

            // We'll update the user document with these details
            // We use merge: true to avoid overwriting existing fields like balance, role, etc.
            const payload = {
                ...formData,
                photoUrl: photoUrl,
                signatureUrl: signatureUrl,
                hostelRegistrationDate: new Date().toISOString(),
                hostelRegistrationData: {
                    ...formData,
                    ...agreementData,
                    photoUrl,
                    signatureUrl,
                    registeredAt: new Date().toISOString()
                },
                // Add specific flags
                hostelEnrolled: true,
                registrationTypeHostel: 'Hostel Standard In-App',
                registrationStatusHostel: 'active'
            };

            await setDoc(userDocRef, payload, { merge: true });

            onComplete(); // Navigate to landing/dashboard

        } catch (error) {
            console.error('Error saving details:', error);
            setError('Failed to submit registration. Please try again.');
        } finally {
            setSubmitting(false);
            setIsLoading(false);
        }
    };

    return (
        <div className="std-container">
            <PageHeader title="Rules & Agreement (2/2)" onBack={onBack} />

            <main className="std-body" style={{ paddingBottom: '40px' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

                    {error && (
                        <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '1rem', marginBottom: '1.5rem' }}>
                            <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Declaration and Rules */}
                        <div style={{ backgroundColor: '#eff6ff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
                                <FileText size={20} color="#1e3a8a" />
                                <h4 style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '1rem' }}>Declaration & Rules</h4>
                            </div>

                            <div style={{ height: '300px', overflowY: 'auto', backgroundColor: 'white', padding: '1rem', border: '1px solid #d1d5db', borderRadius: '0.25rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.5' }}>
                                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Accommodation Rules and Regulations:</p>
                                <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <li>All members should read the rules carefully before signing.</li>
                                    <li>The accommodation is primarily for members; outside visitation is strictly prohibited inside the rooms.</li>
                                    <li>Alcohol, smoking, and drug use inside the building are strictly prohibited. Instant expulsion applies.</li>
                                    <li>Food requests/timing flexibility will not be entertained. Meals are served at fixed times.</li>
                                    <li>Last entry time is 8:30 PM. Gate closes strictly.</li>
                                    <li>Security deposit will be forfeited if rules are breached or minimum stay is not met.</li>
                                    <li>Minimum 1 month notice is required before vacating.</li>
                                    <li>Members reside at their own risk and liability. Management is not responsible for lost valuables.</li>
                                    <li>Breach of non-member entry provision is chargeable by reasonable fine or expulsion.</li>
                                    <li>Room changes require management permission and availability check.</li>
                                    <li>Property damage is the liability of the member and will be deducted from deposit.</li>
                                    <li>Electricity must be used responsibly. Heaters/high-load appliances may be charged extra.</li>
                                    <li>Discipline and silence must be maintained in corridors and common areas.</li>
                                    <li>Management reserves the right to inspect rooms at any reasonable time.</li>
                                    <li>Rent must be paid within the first 5 days of the Nepali month. Late fees apply.</li>
                                    <li>Garbage must be disposed of in designated bins only.</li>
                                    <li>Keys must be returned upon vacating. Lost keys will be charged.</li>
                                    <li>Any medical conditions must be disclosed prior to admission.</li>
                                    <li>Mutual respect among residents and staff is mandatory. Bullying/harassment is zero tolerance.</li>
                                    <li>Water conservation is encouraged. Report leaks immediately.</li>
                                    <li>Internet/Wi-Fi is a facility, not a right. Fair usage policy applies.</li>
                                    <li>Overnight guests are not allowed under any circumstances.</li>
                                    <li>Cooking inside the room is strictly prohibited.</li>
                                    <li>Leave approval must be taken from the warden for overnight absence.</li>
                                    <li>The management decision is final in all disputes.</li>
                                </ol>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    name="agreedToRules"
                                    checked={agreementData.agreedToRules}
                                    onChange={handleChange}
                                    style={{ marginTop: '0.25rem', height: '1.25rem', width: '1.25rem', color: '#2563eb', borderRadius: '0.25rem' }}
                                />
                                <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                                    I hereby declare that all the information provided is true and correct. I have read, understood, and agree to be bound by the rules and regulations of the Reading Room Institute. If found guilty of breach of any rules, I accept the action taken by the management.
                                </span>
                            </label>
                        </div>

                        {/* Signature/Date/Place Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                            {/* Signature Upload */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>Signature (Upload Image)</label>
                                <div style={{ border: '1px solid #d1d5db', padding: '0.5rem', borderRadius: '0.375rem', backgroundColor: '#f9fafb' }}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleSignatureChange}
                                        style={{ width: '100%', fontSize: '0.875rem' }}
                                    />
                                </div>
                                {signaturePreview && (
                                    <div style={{ marginTop: '0.75rem', border: '1px solid #e5e7eb', padding: '0.25rem', display: 'inline-block' }}>
                                        <img
                                            src={signaturePreview}
                                            alt="Signature Preview"
                                            style={{ maxWidth: '150px', maxHeight: '80px', objectFit: 'contain' }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Date and Place */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 'bold', width: '3rem' }}>Date:</span>
                                    <input
                                        type="date"
                                        name="date"
                                        value={agreementData.date}
                                        onChange={handleChange}
                                        style={{ borderBottom: '2px solid #d1d5db', padding: '0.25rem 0.5rem', flex: 1, outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 'bold', width: '3rem' }}>Place:</span>
                                    <input
                                        type="text"
                                        name="place"
                                        value={agreementData.place}
                                        onChange={handleChange}
                                        placeholder="e.g. Kathmandu"
                                        style={{ borderBottom: '2px solid #d1d5db', padding: '0.25rem 0.5rem', flex: 1, outline: 'none' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onBack}
                                disabled={submitting}
                                style={{ paddingLeft: '2rem', paddingRight: '2rem' }}
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={submitting}
                                disabled={submitting}
                                style={{ paddingLeft: '2rem', paddingRight: '2rem' }}
                            >
                                Final Submit
                            </Button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default HostelRules;

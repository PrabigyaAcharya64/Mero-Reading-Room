import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import LoadingSpinner from '../components/LoadingSpinner';
import logo from '../assets/logo.png';

const IMGBB_API_KEY = 'f3836c3667cc5c73c64e1aa4f0849566';

function ReadingRoomEnrollment({ onBack }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [signatureFile, setSignatureFile] = useState(null);
    const [signaturePreview, setSignaturePreview] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        mobileNo: '',
        email: '',
        preparingFor: '',
        college: '',
        currentAddress: '',
        joiningDate: new Date().toISOString().split('T')[0],
        dob: '',
        declarationDate: new Date().toISOString().split('T')[0],
        agreed: false
    });

    useEffect(() => {
        loadUserData();
    }, [user]);

    const loadUserData = async () => {
        try {
            if (!user) return;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setFormData(prev => ({
                    ...prev,
                    name: userData.name || prev.name,
                    email: userData.email || user.email || prev.email,
                    mobileNo: userData.phoneNumber || prev.mobileNo,
                    dob: userData.dateOfBirth || prev.dob
                }));
            } else {
                // If no user data exists, at least set email from auth
                setFormData(prev => ({
                    ...prev,
                    email: user.email || prev.email
                }));
            }
        } catch (err) {
            console.error('Error loading user data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        setError('');
    };

    const handleSignatureChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError('Signature image should be less than 2MB');
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

    const uploadSignature = async () => {
        if (!signatureFile) return null;

        try {
            const formData = new FormData();
            formData.append('image', signatureFile);
            formData.append('key', IMGBB_API_KEY);

            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.success) {
                return data.data.url;
            } else {
                throw new Error('Signature upload failed');
            }
        } catch (error) {
            console.error('Error uploading signature:', error);
            throw new Error('Failed to upload signature. Please try again.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation
        if (!formData.agreed) {
            setError('Please agree to the rules and regulations');
            return;
        }

        if (!signatureFile) {
            setError('Please upload your signature');
            return;
        }

        setSubmitting(true);

        try {
            // Upload signature
            const signatureUrl = await uploadSignature();

            // Save enrollment data
            await addDoc(collection(db, 'readingRoomEnrollments'), {
                userId: user.uid,
                ...formData,
                signatureUrl,
                submittedAt: new Date().toISOString(),
                status: 'pending' // Admin can approve/reject
            });

            setSuccess('Enrollment form submitted successfully!');
            setTimeout(() => {
                if (onBack) onBack();
            }, 2000);
        } catch (err) {
            console.error('Error submitting enrollment:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit enrollment. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <LoadingSpinner size="40" stroke="3" color="#1976d2" />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: 'white', padding: '40px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
                    <img src={logo} alt="Logo" style={{ width: '80px', height: '80px', marginBottom: '10px' }} />
                    <h1 style={{ margin: '10px 0', fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        Membership Registration Form
                    </h1>
                    <h2 style={{ margin: '5px 0', fontSize: '18px', fontWeight: '600' }}>
                        Mero Reading Room
                    </h2>
                </div>

                {/* Back Button */}
                {onBack && (
                    <button
                        onClick={onBack}
                        style={{
                            marginBottom: '20px',
                            padding: '8px 16px',
                            backgroundColor: '#666',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        ← Back
                    </button>
                )}

                {/* Messages */}
                {error && (
                    <div style={{ padding: '12px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '20px' }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div style={{ padding: '12px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', marginBottom: '20px' }}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Registration Fields - Two Column Layout */}
                    <table style={{ width: '100%', marginBottom: '30px', borderCollapse: 'collapse', border: '1px solid #333' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '10px', border: '1px solid #333', width: '25%', fontWeight: '600' }}>Name:</td>
                                <td style={{ padding: '10px', border: '1px solid #333', width: '25%' }}>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc' }}
                                    />
                                </td>
                                <td style={{ padding: '10px', border: '1px solid #333', width: '25%', fontWeight: '600' }}>College:</td>
                                <td style={{ padding: '10px', border: '1px solid #333', width: '25%' }}>
                                    <input
                                        type="text"
                                        name="college"
                                        value={formData.college}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc' }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>Mobile No:</td>
                                <td style={{ padding: '10px', border: '1px solid #333' }}>
                                    <input
                                        type="tel"
                                        name="mobileNo"
                                        value={formData.mobileNo}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc' }}
                                    />
                                </td>
                                <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>Current Address:</td>
                                <td style={{ padding: '10px', border: '1px solid #333' }}>
                                    <input
                                        type="text"
                                        name="currentAddress"
                                        value={formData.currentAddress}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc' }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>E-Mail:</td>
                                <td style={{ padding: '10px', border: '1px solid #333' }}>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc' }}
                                    />
                                </td>
                                <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>Joining Date:</td>
                                <td style={{ padding: '10px', border: '1px solid #333' }}>
                                    <input
                                        type="date"
                                        name="joiningDate"
                                        value={formData.joiningDate}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc' }}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>Preparing For:</td>
                                <td style={{ padding: '10px', border: '1px solid #333' }}>
                                    <input
                                        type="text"
                                        name="preparingFor"
                                        value={formData.preparingFor}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc' }}
                                        placeholder="e.g., MBBS, CA, etc."
                                    />
                                </td>
                                <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>DoB:</td>
                                <td style={{ padding: '10px', border: '1px solid #333' }}>
                                    <input
                                        type="date"
                                        name="dob"
                                        value={formData.dob}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc' }}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Rules and Regulations */}
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ fontWeight: 'bold', marginBottom: '15px', fontSize: '16px' }}>
                            All members should adhere to the following rules and regulations inside the premises
                        </h3>
                        <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                            <li>The building is a complete SILENCE ZONE. Mobile phones should be kept in SILENT MODE at all times when inside the building, receiving calls is not permitted in the study room or the common spaces outside the rooms.</li>
                            <li>The whole of the building is a NON-SMOKING ZONE. Members may use the garden or canteen area for smoking.</li>
                            <li>Side talks and murmurs are strictly prohibited inside the study rooms, members should use the DISCUSSION ROOMS for any such discussions or self study requiring interactions.</li>
                            <li>Members are not allowed to eat food items at the study table/inside the building.</li>
                            <li>Only members are allowed inside the building. Any third party visitation is strictly prohibited except accompanied by the staff personnel.</li>
                            <li>Members shall be allowed a grace period of 3 days for renewal of membership. The payment is non-refundable and non-transferable.</li>
                            <li>The office should be informed of any discontinuance of our services else the member shall continue to be charged a membership fee as we continue to keep the seat. The fee shall be payable till the date informed.</li>
                            <li>Reading Room reserves the right to inspect bags or other such items when members enter/leave the Reading Room facility. The locker and study table allotted to each member are the responsibility of such individual members and shall be personally liable for damages, including and not limited to, breaking, defacing them, using of pen, marker, non-removable stickers etc. It shall also apply to any other property owned, operated or maintained by Reading Room. Further, the Reading Room shall not be responsible for any goods or items kept therein.</li>
                            <li>Reading Room is authorized by the members to post any congratulatory posts/information with photo upon their success in subsequent examinations and life achievements through different online/offline mediums.</li>
                            <li>In case of failure to adhere to the aforementioned rules and regulations, the Reading Room reserves the unconditional right to warn and where necessary, terminate the membership without any financial obligations on the Reading Rooms part.</li>
                        </ol>
                    </div>

                    {/* Declaration */}
                    <div style={{ marginBottom: '30px' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                name="agreed"
                                checked={formData.agreed}
                                onChange={handleInputChange}
                                required
                                style={{ marginTop: '3px', width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span style={{ flex: 1 }}>
                                I hereby declare that I have read, understood and agree to be bound by the aforementioned rules and regulations.
                            </span>
                        </label>
                    </div>

                    {/* Date and Signature */}
                    <div style={{ display: 'flex', gap: '40px', marginBottom: '30px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Date:</label>
                            <input
                                type="date"
                                name="declarationDate"
                                value={formData.declarationDate}
                                onChange={handleInputChange}
                                required
                                style={{ width: '100%', padding: '8px', border: '1px solid #333', borderRadius: '4px' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Signature:</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleSignatureChange}
                                style={{ width: '100%', padding: '8px', border: '1px solid #333', borderRadius: '4px' }}
                            />
                            {signaturePreview && (
                                <div style={{ marginTop: '10px' }}>
                                    <img
                                        src={signaturePreview}
                                        alt="Signature Preview"
                                        style={{ maxWidth: '200px', maxHeight: '100px', border: '1px solid #ccc', padding: '5px' }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div style={{ textAlign: 'center' }}>
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                padding: '12px 40px',
                                backgroundColor: submitting ? '#ccc' : '#1976d2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                margin: '0 auto'
                            }}
                        >
                            {submitting ? (
                                <>
                                    <LoadingSpinner size="20" stroke="2.5" color="white" />
                                    <span>Submitting...</span>
                                </>
                            ) : (
                                'Submit Enrollment'
                            )}
                        </button>
                    </div>
                </form>

                {/* Print Styles */}
                <style>{`
                    @media print {
                        button {
                            display: none !important;
                        }
                        body {
                            background: white;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}

export default ReadingRoomEnrollment;

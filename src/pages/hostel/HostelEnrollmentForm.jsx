import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/StandardLayout.css';
import logo from "../../assets/logo.png";
import { User } from 'lucide-react';

function HostelEnrollmentForm({ onNext, initialData, onBack }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        // Personal Information
        name: '',
        dob: '',
        email: '',
        contactNo: '',
        citizenshipId: '',
        bloodGroup: '',
        profession: '',
        college: '',
        medicalIssue: '',

        // Permanent Address
        permanentAddress: '',

        // Guardians Information
        fatherName: '', fatherContact: '',
        motherName: '', motherContact: '',
        spouseName: '', spouseContact: '',
        localGuardian: '', localGuardianContact: '',
        guardianAddress: '',

        // Meta
        place: ''
    });

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [error, setError] = useState('');

    // Load user data
    useEffect(() => {
        const loadUserData = async () => {
            // If we are returning from the rules page, use the preserved data
            if (initialData && initialData.formData) {
                setFormData(initialData.formData);
                if (initialData.photoPreview) setPhotoPreview(initialData.photoPreview);
                if (initialData.photoFile) setPhotoFile(initialData.photoFile);
                setLoading(false);
                return;
            }

            if (!user) return;

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();

                    // Helper to check nested field
                    const getVal = (field) => userData[field] || '';

                    setFormData(prev => ({
                        ...prev,
                        name: getVal('name') || user.displayName || prev.name,
                        email: getVal('email') || user.email || prev.email,
                        contactNo: getVal('phoneNumber') || getVal('mobileNo') || prev.contactNo,
                        dob: getVal('dateOfBirth') || getVal('dob') || prev.dob,
                        college: getVal('college') || prev.college,
                        bloodGroup: getVal('bloodGroup') || prev.bloodGroup,
                        profession: getVal('profession') || prev.profession,
                        medicalIssue: getVal('medicalIssue') || prev.medicalIssue,
                        citizenshipId: getVal('citizenshipId') || getVal('citizenshipNo') || prev.citizenshipId,

                        // Address
                        permanentAddress: getVal('permanentAddress') || getVal('address') || getVal('currentAddress') || prev.permanentAddress,

                        // Guardians (try to find matching keys)
                        fatherName: getVal('fatherName') || prev.fatherName,
                        fatherContact: getVal('fatherContact') || prev.fatherContact,
                        motherName: getVal('motherName') || prev.motherName,
                        motherContact: getVal('motherContact') || prev.motherContact,
                        spouseName: getVal('spouseName') || prev.spouseName,
                        spouseContact: getVal('spouseContact') || prev.spouseContact,
                        localGuardian: getVal('localGuardian') || getVal('localGuardianName') || prev.localGuardian,
                        localGuardianContact: getVal('localGuardianContact') || prev.localGuardianContact,
                        guardianAddress: getVal('guardianAddress') || prev.guardianAddress,
                    }));

                    if (userData.photoUrl || user.photoURL) {
                        setPhotoPreview(userData.photoUrl || user.photoURL);
                    }
                } else {
                    // Fallback to auth data
                    setFormData(prev => ({
                        ...prev,
                        name: user.displayName || prev.name,
                        email: user.email || prev.email,
                        contactNo: user.phoneNumber || prev.contactNo
                    }));
                    if (user.photoURL) setPhotoPreview(user.photoURL);
                }
            } catch (err) {
                console.error('Error loading user data:', err);
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, [user, initialData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        setError('');
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError('Photo size should be less than 5MB');
                return;
            }
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result);
            };
            reader.readAsDataURL(file);
            setError('');
        }
    };

    const handleNext = (e) => {
        e.preventDefault();
        setError('');

        if (!formData.name || !formData.dob || !formData.contactNo || !formData.permanentAddress) {
            setError('Please fill in all required fields.');
            return;
        }

        onNext({ formData, photoFile, photoPreview });
    };

    if (loading) {
        return (
            <div className="std-container">
                <PageHeader title="Hostel Registration" onBack={onBack} />
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    // Styles for table cells
    const labelCellStyle = { padding: '10px', border: '1px solid #333', fontWeight: 'bold', backgroundColor: '#f9fafb', width: '20%' };
    const inputCellStyle = { padding: '10px', border: '1px solid #333', width: '30%' };
    const inputStyle = { width: '100%', padding: '5px', border: '1px solid #ccc', outline: 'none' };
    const sectionHeaderStyle = { backgroundColor: '#333', color: 'white', padding: '8px 15px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px', marginTop: '20px', marginBottom: '0' };

    return (
        <div className="std-container">
            <PageHeader title="Hostel Registration (1/2)" onBack={onBack} />

            <main className="std-body">
                <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: 'white', padding: '40px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
                        <img src={logo} alt="Logo" style={{ width: '80px', height: '80px', marginBottom: '10px', display: 'block', margin: '0 auto 10px auto' }} />
                        <h1 style={{ margin: '10px 0', fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            Hostel Admission Form
                        </h1>
                        <h2 style={{ margin: '5px 0', fontSize: '18px', fontWeight: '600' }}>
                            Mero Reading Room & Hostel
                        </h2>
                    </div>

                    {error && (
                        <div style={{ padding: '12px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '20px' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleNext}>

                        {/* Upper Section: Photo and Basic Info */}
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexDirection: 'row', flexWrap: 'wrap-reverse' }}>
                            <div style={{ flex: 1, minWidth: '300px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333' }}>
                                    <tbody>
                                        <tr>
                                            <td style={labelCellStyle}>Full Name:</td>
                                            <td style={inputCellStyle} colSpan="3">
                                                <input type="text" name="name" value={formData.name} onChange={handleChange} required style={inputStyle} />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={labelCellStyle}>DOB:</td>
                                            <td style={inputCellStyle}>
                                                <input type="date" name="dob" value={formData.dob} onChange={handleChange} required style={inputStyle} />
                                            </td>
                                            <td style={labelCellStyle}>Blood Group:</td>
                                            <td style={inputCellStyle}>
                                                <input type="text" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} style={inputStyle} />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={labelCellStyle}>Contact No:</td>
                                            <td style={inputCellStyle}>
                                                <input type="tel" name="contactNo" value={formData.contactNo} onChange={handleChange} required style={inputStyle} />
                                            </td>
                                            <td style={labelCellStyle}>Email:</td>
                                            <td style={inputCellStyle}>
                                                <input type="email" name="email" value={formData.email} onChange={handleChange} required style={inputStyle} />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={labelCellStyle}>Citizenship No:</td>
                                            <td style={inputCellStyle}>
                                                <input type="text" name="citizenshipId" value={formData.citizenshipId} onChange={handleChange} style={inputStyle} />
                                            </td>
                                            <td style={labelCellStyle}>Profession:</td>
                                            <td style={inputCellStyle}>
                                                <input type="text" name="profession" value={formData.profession} onChange={handleChange} style={inputStyle} />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={labelCellStyle}>Institution:</td>
                                            <td style={inputCellStyle} colSpan="3">
                                                <input type="text" name="college" value={formData.college} onChange={handleChange} style={inputStyle} placeholder="School / College / Office Name" />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={labelCellStyle}>Medical Issues:</td>
                                            <td style={inputCellStyle} colSpan="3">
                                                <input type="text" name="medicalIssue" value={formData.medicalIssue} onChange={handleChange} style={inputStyle} placeholder="Any known allergies or conditions" />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Photo Area */}
                            <div style={{ width: '180px', flexShrink: 0, margin: '0 auto' }}>
                                <div style={{
                                    width: '100%',
                                    height: '200px',
                                    border: '1px solid #333',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    backgroundColor: '#f5f5f5'
                                }}>
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '10px' }}>
                                            <User size={40} color="#999" />
                                            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Passport Size Photo</div>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                    />
                                </div>
                                <div style={{ textAlign: 'center', fontSize: '11px', color: '#666', marginTop: '5px' }}>Click to Upload</div>
                            </div>
                        </div>

                        {/* Address Section */}
                        <div style={sectionHeaderStyle}>Address Details</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333' }}>
                            <tbody>
                                <tr>
                                    <td style={{ ...labelCellStyle, width: '20%' }}>Permanent Address:</td>
                                    <td style={{ ...inputCellStyle, width: '80%' }}>
                                        <input type="text" name="permanentAddress" value={formData.permanentAddress} onChange={handleChange} required style={inputStyle} placeholder="District, Municipality, Ward, Tole" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Guardian Info */}
                        <div style={sectionHeaderStyle}>Guardian Information</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: '20px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#eee' }}>
                                    <th style={{ padding: '8px', border: '1px solid #333', textAlign: 'left', width: '20%' }}>Relation</th>
                                    <th style={{ padding: '8px', border: '1px solid #333', textAlign: 'left', width: '50%' }}>Name</th>
                                    <th style={{ padding: '8px', border: '1px solid #333', textAlign: 'left', width: '30%' }}>Contact No.</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '8px', border: '1px solid #333', fontWeight: '500' }}>Father</td>
                                    <td style={{ padding: '8px', border: '1px solid #333' }}>
                                        <input type="text" name="fatherName" value={formData.fatherName} onChange={handleChange} style={inputStyle} />
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #333' }}>
                                        <input type="tel" name="fatherContact" value={formData.fatherContact} onChange={handleChange} style={inputStyle} />
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px', border: '1px solid #333', fontWeight: '500' }}>Mother</td>
                                    <td style={{ padding: '8px', border: '1px solid #333' }}>
                                        <input type="text" name="motherName" value={formData.motherName} onChange={handleChange} style={inputStyle} />
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #333' }}>
                                        <input type="tel" name="motherContact" value={formData.motherContact} onChange={handleChange} style={inputStyle} />
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px', border: '1px solid #333', fontWeight: '500' }}>Spouse</td>
                                    <td style={{ padding: '8px', border: '1px solid #333' }}>
                                        <input type="text" name="spouseName" value={formData.spouseName} onChange={handleChange} style={inputStyle} />
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #333' }}>
                                        <input type="tel" name="spouseContact" value={formData.spouseContact} onChange={handleChange} style={inputStyle} />
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px', border: '1px solid #333', fontWeight: '500' }}>Local Guardian</td>
                                    <td style={{ padding: '8px', border: '1px solid #333' }}>
                                        <input type="text" name="localGuardian" value={formData.localGuardian} onChange={handleChange} style={inputStyle} />
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #333' }}>
                                        <input type="tel" name="localGuardianContact" value={formData.localGuardianContact} onChange={handleChange} style={inputStyle} />
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px', border: '1px solid #333', fontWeight: '500' }}>Guardian Address</td>
                                    <td style={{ padding: '8px', border: '1px solid #333' }} colSpan="2">
                                        <input type="text" name="guardianAddress" value={formData.guardianAddress} onChange={handleChange} style={inputStyle} placeholder="Address of Local Guardian" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div style={{ textAlign: 'center', marginTop: '30px' }}>
                            <Button
                                type="submit"
                                variant="primary"
                                style={{
                                    margin: '0 auto',
                                    padding: '12px 50px',
                                    backgroundColor: '#333',
                                    borderColor: '#333'
                                }}
                            >
                                Continue to Rules
                            </Button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default HostelEnrollmentForm;

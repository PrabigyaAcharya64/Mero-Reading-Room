import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useLoading } from '../../context/GlobalLoadingContext';
import { Switch } from "@heroui/react";
import { doc, updateDoc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatBalance } from '../../utils/formatCurrency';
import { formatDate, formatDateForInput } from '../../utils/dateFormat';
import { X, Save, AlertTriangle, CheckCircle, Ban, UserCheck } from 'lucide-react';
import '../../styles/UserDetailView.css';
import logo from "../../assets/logo.png";
import EnrollmentPDF from '../../components/pdf/EnrollmentPDF';

function UserDetailView({ user, isOpen, onClose, onUpdate }) {
    const { setIsLoading } = useLoading();
    const [localUser, setLocalUser] = useState(user);
    const [isDataReady, setIsDataReady] = useState(false);
    const [balanceAmount, setBalanceAmount] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(null);
    const [syncStatus, setSyncStatus] = useState('');
    const [hasReadingRoom, setHasReadingRoom] = useState(false);
    const [enrollmentData, setEnrollmentData] = useState(null);

    const [seatAssignment, setSeatAssignment] = useState(null);



    useLayoutEffect(() => {
        const initData = async () => {
            if (user && isOpen) {
                setIsLoading(true);
                try {
                    setLocalUser(user);
                    await checkReadingRoomEnrollment();
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsLoading(false);
                    setIsDataReady(true);
                }
            }
        };

        if (user && isOpen) {
            initData();
        }
    }, [user, isOpen]);

    useEffect(() => {
        if (user) {
            // Fetch active seat assignment
            const q = query(
                collection(db, 'seatAssignments'),
                where('userId', '==', user.id)
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    setSeatAssignment(snapshot.docs[0].data());
                } else {
                    setSeatAssignment(null);
                }
            });
            return () => unsubscribe();
        }
    }, [user]);

    const checkReadingRoomEnrollment = async () => {
        if (!user?.id) return;

        try {
            // Fetch ALL enrollments for this user to get the latest data for the form
            // regardless of current status (e.g. might be 'active', 'pending', 'expired')
            const q = query(
                collection(db, 'readingRoomEnrollments'),
                where('userId', '==', user.id)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // Get the most recent enrollment
                const docs = snapshot.docs.map(d => d.data());
                // Sort by submittedAt descending if available
                docs.sort((a, b) => {
                    const dateA = a.submittedAt || a.declarationDate || '';
                    const dateB = b.submittedAt || b.declarationDate || '';
                    return dateB.localeCompare(dateA);
                });

                const latestEnrollment = docs[0];
                setEnrollmentData(latestEnrollment);

                // Autofill address if missing
                if (!localUser.currentAddress && latestEnrollment.currentAddress) {
                    setLocalUser(prev => ({ ...prev, currentAddress: latestEnrollment.currentAddress }));
                    // Optional: trigger save if you want it persisted immediately, 
                    // but usually better to let user confirmation via blur/save. 
                    // However, since handleBlur compares updates, we might need to manually trigger update if we want it saved.
                    // For now, just updating local state so it appears in the input.
                }

                // Determine if they effectively "have" a reading room based on status
                // If they have ANY enrollment that is not 'rejected', we can consider them as having some relationship
                setHasReadingRoom(true);
            } else {
                setHasReadingRoom(false);
                setEnrollmentData(null);
            }
        } catch (error) {
            console.error('Error checking reading room enrollment:', error);
        }
    };

    const handleFieldUpdate = async (field, value) => {
        if (!user?.id) return;

        setSyncStatus('Syncing...');

        try {
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                [field]: value,
                updatedAt: new Date().toISOString()
            });

            setSyncStatus('Saved ✓');
            setTimeout(() => setSyncStatus(''), 2000);

            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error updating field:', error);
            setSyncStatus('Error ✗');
            setTimeout(() => setSyncStatus(''), 3000);
        }
    };

    const handleInputChange = (field, value) => {
        setLocalUser(prev => ({ ...prev, [field]: value }));
    };

    const handleBlur = (field) => {
        if (localUser[field] !== user[field]) {
            handleFieldUpdate(field, localUser[field]);
        }
    };

    const submitBalanceUpdate = async () => {
        const amount = parseFloat(balanceAmount);
        if (isNaN(amount)) {
            alert('Please enter a valid amount');
            return;
        }

        setIsSaving(true);
        setSyncStatus('Updating balance...');

        try {
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                balance: amount,
                updatedAt: new Date().toISOString()
            });

            // Update local state to reflect the change immediately
            setLocalUser(prev => ({ ...prev, balance: amount }));

            setSyncStatus('Balance updated ✓');
            setTimeout(() => setSyncStatus(''), 2000);

            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error updating balance:', error);
            setSyncStatus('Error updating balance ✗');
            setTimeout(() => setSyncStatus(''), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleBan = async () => {
        setShowConfirmation({
            type: 'ban',
            message: `Are you sure you want to ${localUser.isBanned ? 'unban' : 'ban'} ${localUser.name}?`,
            action: async () => {
                setIsSaving(true);
                try {
                    const userRef = doc(db, 'users', user.id);
                    await updateDoc(userRef, {
                        isBanned: !localUser.isBanned,
                        updatedAt: new Date().toISOString()
                    });

                    setLocalUser(prev => ({ ...prev, isBanned: !prev.isBanned }));
                    setSyncStatus('Status updated ✓');
                    setTimeout(() => setSyncStatus(''), 2000);

                    if (onUpdate) onUpdate();
                } catch (error) {
                    console.error('Error toggling ban:', error);
                    alert('Failed to update ban status');
                } finally {
                    setIsSaving(false);
                    setShowConfirmation(null);
                }
            }
        });
    };

    const handleToggleVerify = async () => {
        setIsSaving(true);
        try {
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                verified: !localUser.verified,
                updatedAt: new Date().toISOString()
            });

            setLocalUser(prev => ({ ...prev, verified: !prev.verified }));
            setSyncStatus('Verification status updated ✓');
            setTimeout(() => setSyncStatus(''), 2000);

            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error toggling verification:', error);
            alert('Failed to update verification status');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen || !user || !isDataReady) return null;

    return (
        <div className="user-detail-overlay">
            <div className="user-detail-modal">
                {/* Header */}
                <div className="user-detail-header no-print">
                    <h2>User Management - {localUser.name}</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                {/* Sync Status Indicator */}
                {syncStatus && (
                    <div className={`sync-status no-print ${syncStatus.includes('✓') ? 'success' : syncStatus.includes('✗') ? 'error' : ''}`}>
                        {syncStatus}
                    </div>
                )}

                {/* Split Screen Content */}
                <div className="user-detail-content">
                    {/* LEFT PANEL - Control Center */}
                    <div className="control-panel no-print">
                        <h3>Control Center</h3>

                        {/* User Photo */}
                        <div className="control-section">
                            <div className="user-photo-large">
                                {(localUser.profileImage || localUser.photoUrl || localUser.image) ? (
                                    <img
                                        src={localUser.profileImage || localUser.photoUrl || localUser.image}
                                        alt={localUser.name}
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="photo-placeholder">{localUser.name?.charAt(0)?.toUpperCase()}</div>
                                )}
                            </div>
                        </div>

                        {/* Basic Info */}
                        <div className="control-section">
                            <h4>Basic Information</h4>

                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    value={localUser.name || ''}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    onBlur={() => handleBlur('name')}
                                    readOnly={true} // Name usually shouldn't be changed here easily
                                />
                            </div>

                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={localUser.email || ''}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    onBlur={() => handleBlur('email')}
                                    readOnly={true}
                                />
                            </div>

                            <div className="form-group">
                                <label>Phone Number</label>
                                <input
                                    type="tel"
                                    value={localUser.phoneNumber || ''}
                                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                                    onBlur={() => handleBlur('phoneNumber')}
                                />
                            </div>

                            <div className="form-group">
                                <label>Date of Birth</label>
                                <input
                                    type="date"
                                    value={formatDateForInput(localUser.dateOfBirth) || ''}
                                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                                    onBlur={() => handleBlur('dateOfBirth')}
                                />
                            </div>

                            <div className="form-group">
                                <label>MRR Number</label>
                                <input
                                    type="text"
                                    value={localUser.mrrNumber || ''}
                                    readOnly
                                    className="bg-gray-100 cursor-not-allowed"
                                />
                            </div>

                            <div className="form-group pb-2">
                                <label>Assigned Seat</label>
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    {seatAssignment ? (
                                        <div className="flex flex-col gap-1 text-sm">
                                            <div>
                                                <span className="font-bold text-blue-600">Active: </span>
                                                <span className="text-gray-700">{formatDate(seatAssignment.assignedAt)}</span>
                                            </div>
                                            <div className="text-gray-900 font-medium">
                                                Room: {seatAssignment.roomName || 'Reading Room'}
                                            </div>
                                            <div className="text-gray-900 font-medium">
                                                Seat: {seatAssignment.seatLabel || seatAssignment.seatId || '-'}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center text-gray-500 italic">
                                            <span>No active seat assignment</span>
                                        </div>
                                    )}
                                </div>
                            </div>


                            <div className="form-group">
                                <label>Current Address</label>
                                <input
                                    type="text"
                                    value={localUser.currentAddress || ''}
                                    onChange={(e) => handleInputChange('currentAddress', e.target.value)}
                                    onBlur={() => handleBlur('currentAddress')}
                                />
                            </div>
                        </div>

                        {/* Atomic Balance Tool */}
                        <div className="control-section balance-section">
                            <h4>Balance Management</h4>
                            <div className="current-balance">
                                <span>Current Balance:</span>
                                <strong>{formatBalance(localUser.balance || 0)}</strong>
                            </div>

                            <div className="balance-controls">
                                <input
                                    type="number"
                                    placeholder="Set New Balance"
                                    value={balanceAmount}
                                    onChange={(e) => setBalanceAmount(e.target.value)}
                                    step="0.01"
                                />
                                <button
                                    className="btn-primary"
                                    onClick={submitBalanceUpdate}
                                    disabled={isSaving || balanceAmount === ''}
                                >
                                    {isSaving ? 'Processing...' : 'Set Balance'}
                                </button>
                            </div>
                            <p className="help-text">Directly updates the user's wallet balance.</p>
                        </div>

                        {/* Status Toggles - Custom Premium Switches */}
                        <div className="control-section">
                            <h4>Account Status</h4>

                            <div className="toggle-group">
                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <UserCheck size={20} />
                                        <span>Account Verified</span>
                                    </div>
                                    <label className="custom-toggle">
                                        <input
                                            type="checkbox"
                                            checked={localUser.verified || false}
                                            onChange={handleToggleVerify}
                                            disabled={isSaving}
                                        />
                                        <span className="custom-slider"></span>
                                    </label>
                                </div>

                                <div className="toggle-item danger">
                                    <div className="toggle-info">
                                        <Ban size={20} />
                                        <span>Ban User</span>
                                    </div>
                                    <label className="custom-toggle danger">
                                        <input
                                            type="checkbox"
                                            checked={localUser.isBanned || false}
                                            onChange={handleToggleBan}
                                            disabled={isSaving}
                                        />
                                        <span className="custom-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Payment Timeline */}
                        <div className="control-section">
                            <h4>Payment Timeline</h4>
                            <div className="timeline-info">
                                <div className="timeline-item">
                                    <label>Last Payment:</label>
                                    <span>{localUser.lastPaymentDate ? formatDate(localUser.lastPaymentDate) : '-'}</span>
                                </div>
                                <div className="timeline-item">
                                    <label>Next Payment:</label>
                                    <span>
                                        {localUser.nextPaymentDate
                                            ? formatDate(localUser.nextPaymentDate)
                                            : localUser.nextPaymentDue
                                                ? formatDate(new Date(localUser.nextPaymentDue * 1000))
                                                : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL - Form Replica */}
                    {hasReadingRoom ? (
                        <div className="form-replica">
                            <div className="form-replica-content" id="printable-form" style={{ backgroundColor: 'white', padding: '40px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '1200px', margin: '20px auto' }}>
                                {/* Header */}
                                <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
                                    <img src={logo} alt="Logo" style={{ width: '80px', height: '80px', marginBottom: '10px', display: 'block', margin: '0 auto 10px auto' }} />
                                    <h1 style={{ margin: '10px 0', fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        Membership Registration Form
                                    </h1>
                                    <h2 style={{ margin: '5px 0', fontSize: '18px', fontWeight: '600' }}>
                                        Mero Reading Room
                                    </h2>
                                </div>

                                {/* Registration Fields - Two Column Layout */}
                                <table style={{ width: '100%', marginBottom: '30px', borderCollapse: 'collapse', border: '1px solid #333' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: '10px', border: '1px solid #333', width: '25%', fontWeight: '600' }}>Name:</td>
                                            <td style={{ padding: '10px', border: '1px solid #333', width: '25%' }}>
                                                <input
                                                    type="text"
                                                    value={enrollmentData?.name || localUser.name || ''}
                                                    readOnly
                                                    style={{ width: '100%', padding: '5px', border: '1px solid #ccc', background: '#fff' }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #333', width: '25%', fontWeight: '600' }}>College:</td>
                                            <td style={{ padding: '10px', border: '1px solid #333', width: '25%' }}>
                                                <input
                                                    type="text"
                                                    value={enrollmentData?.college || localUser.college || ''}
                                                    readOnly
                                                    style={{ width: '100%', padding: '5px', border: '1px solid #ccc', background: '#fff' }}
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>Mobile No:</td>
                                            <td style={{ padding: '10px', border: '1px solid #333' }}>
                                                <input
                                                    type="text"
                                                    value={enrollmentData?.mobileNo || localUser.phoneNumber || ''}
                                                    readOnly
                                                    style={{ width: '100%', padding: '5px', border: '1px solid #ccc', background: '#fff' }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>Current Address:</td>
                                            <td style={{ padding: '10px', border: '1px solid #333' }}>
                                                <input
                                                    type="text"
                                                    value={enrollmentData?.currentAddress || localUser.currentAddress || ''}
                                                    readOnly
                                                    style={{ width: '100%', padding: '5px', border: '1px solid #ccc', background: '#fff' }}
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>E-Mail:</td>
                                            <td style={{ padding: '10px', border: '1px solid #333' }}>
                                                <input
                                                    type="text"
                                                    value={enrollmentData?.email || localUser.email || ''}
                                                    readOnly
                                                    style={{ width: '100%', padding: '5px', border: '1px solid #ccc', background: '#fff' }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>Joining Date:</td>
                                            <td style={{ padding: '10px', border: '1px solid #333' }}>
                                                <input
                                                    type="text"
                                                    value={enrollmentData?.joiningDate ? formatDate(enrollmentData.joiningDate) : ''}
                                                    readOnly
                                                    style={{ width: '100%', padding: '5px', border: '1px solid #ccc', background: '#fff' }}
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>Preparing For:</td>
                                            <td style={{ padding: '10px', border: '1px solid #333' }}>
                                                <input
                                                    type="text"
                                                    value={enrollmentData?.preparingFor || localUser.preparingFor || ''}
                                                    readOnly
                                                    style={{ width: '100%', padding: '5px', border: '1px solid #ccc', background: '#fff' }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #333', fontWeight: '600' }}>DoB:</td>
                                            <td style={{ padding: '10px', border: '1px solid #333' }}>
                                                <input
                                                    type="text"
                                                    value={enrollmentData?.dob ? formatDate(enrollmentData.dob) : formatDate(localUser.dateOfBirth)}
                                                    readOnly
                                                    style={{ width: '100%', padding: '5px', border: '1px solid #ccc', background: '#fff' }}
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
                                            checked={true}
                                            readOnly
                                            style={{ marginTop: '3px', width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <span style={{ flex: 1 }}>
                                            I hereby declare that I have read, understood and agree to be bound by the aforementioned rules and regulations.
                                        </span>
                                    </label>
                                </div>

                                {/* Date and Signature */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px', alignItems: 'start' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Date:</label>
                                        <input
                                            type="text"
                                            value={formatDate(enrollmentData?.declarationDate || enrollmentData?.submittedAt)}
                                            readOnly
                                            style={{ width: '100%', padding: '8px', border: '1px solid #333', borderRadius: '4px', background: '#fff', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Signature:</label>
                                        <div style={{ padding: '4px', border: '1px solid #333', borderRadius: '4px', minHeight: '40px', overflow: 'hidden', boxSizing: 'border-box', background: '#fff' }}>
                                            {enrollmentData?.signatureUrl && (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                                    <img
                                                        src={enrollmentData.signatureUrl}
                                                        alt="Signature"
                                                        style={{ maxWidth: '180px', maxHeight: '60px', objectFit: 'contain' }}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Print Button */}
                                <div className="print-button-container no-print" style={{ textAlign: 'center' }}>
                                    <button className="btn-print" onClick={async () => {
                                        try {
                                            // Dynamic import to avoid SSR issues if any, though not strictly needed for SPA
                                            const { pdf } = await import('@react-pdf/renderer');
                                            const blob = await pdf(<EnrollmentPDF data={enrollmentData} user={localUser} />).toBlob();
                                            const url = URL.createObjectURL(blob);
                                            window.open(url, '_blank');
                                        } catch (err) {
                                            console.error('PDF Generation Error:', err);
                                            alert('Failed to generate PDF');
                                        }
                                    }}>
                                        Generate Document (Print)
                                    </button>
                                </div>
                                <style>{`
                                    @media print {
                                        button, .no-print {
                                            display: none !important;
                                        }
                                        body {
                                            background: white;
                                        }
                                        .user-detail-overlay {
                                            position: static;
                                            background: white;
                                            padding: 0;
                                        }
                                        .user-detail-modal {
                                            width: 100%;
                                            max-width: none;
                                            box-shadow: none;
                                            margin: 0;
                                            border-radius: 0;
                                        }
                                        .user-detail-content {
                                            display: block;
                                        }
                                        .control-panel {
                                            display: none;
                                        }
                                        .form-replica {
                                            flex: 1;
                                            border-left: none;
                                            padding: 0;
                                        }
                                        .form-replica-content {
                                            padding: 0;
                                        }
                                    }
                                `}</style>
                            </div>
                        </div>
                    ) : (
                        <div className="form-replica flex items-center justify-center bg-gray-50">
                            <div className="text-center p-8 text-gray-500">
                                <p>No reading room enrollment form available for this user.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Confirmation Modal */}
                {showConfirmation && (
                    <div className="confirmation-overlay">
                        <div className="confirmation-modal">
                            <div className="confirmation-icon">
                                <AlertTriangle size={48} color="#ef4444" />
                            </div>
                            <h3>Confirm Action</h3>
                            <p>{showConfirmation.message}</p>
                            <div className="confirmation-actions">
                                <button
                                    className="btn-cancel"
                                    onClick={() => setShowConfirmation(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-confirm"
                                    onClick={showConfirmation.action}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default UserDetailView;

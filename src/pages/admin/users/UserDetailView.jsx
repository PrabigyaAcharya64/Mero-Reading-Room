import { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../../../lib/firebase';
import { doc, updateDoc, collection, addDoc, query, where, getDocs, onSnapshot, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { pdf } from '@react-pdf/renderer';
import { formatBalance } from '../../../utils/formatCurrency';
import { formatDate, formatDateForInput } from '../../../utils/dateFormat';
import { uploadImageSecurely } from '../../../utils/imageUpload';
import EnrollmentPDF from '../../../components/pdf/EnrollmentPDF';
import HostelEnrollmentPDF from '../../../components/pdf/HostelEnrollmentPDF';
import logo from '../../../assets/logo.png';
import {
    X, AlertTriangle, Ban, UserCheck, BookOpen, Building2, Settings2,
    Shield, Wallet, RotateCcw, Trash2, CreditCard, BedDouble, Camera, User, Save,
    Download, Pencil
} from 'lucide-react';
import '../../../styles/UserDetailView.css';

// Helper: safely convert any value to a renderable string.
const safeStr = (val) => {
    if (val == null) return '-';
    if (typeof val === 'string') return val || '-';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val?.toDate === 'function') {
        try { return formatDate(val.toDate()); } catch { return '-'; }
    }
    if (val && typeof val === 'object' && 'seconds' in val) {
        try { return formatDate(new Date(val.seconds * 1000)); } catch { return '-'; }
    }
    if (val instanceof Date) {
        try { return formatDate(val); } catch { return '-'; }
    }
    return String(val);
};

// Extract a plain string value from a field (handles timestamps for input fields)
const rawStr = (val) => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val?.toDate === 'function') {
        try {
            const d = val.toDate();
            return d.toISOString().split('T')[0];
        } catch { return ''; }
    }
    if (val && typeof val === 'object' && 'seconds' in val) {
        try {
            const d = new Date(val.seconds * 1000);
            return d.toISOString().split('T')[0];
        } catch { return ''; }
    }
    return String(val);
};

function UserDetailView({ user, isOpen, onClose, onUpdate }) {
    const [activeTab, setActiveTab] = useState('overall');
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState(null);
    const [isProcessingBalance, setIsProcessingBalance] = useState(false);

    // Reading Room state
    const [seatAssignment, setSeatAssignment] = useState(null);
    const [rrEnrollment, setRrEnrollment] = useState(null);

    // Hostel state
    const [hostelAssignment, setHostelAssignment] = useState(null);
    const [hostelEnrollment, setHostelEnrollment] = useState(null);

    // Editable fields
    const [balanceInput, setBalanceInput] = useState('');
    const [fineInput, setFineInput] = useState('');
    const [hostelFineInput, setHostelFineInput] = useState('');

    // Editable personal info
    const [editFields, setEditFields] = useState({});
    const [photoUploading, setPhotoUploading] = useState(false);

    // Editable enrollment fields
    const [rrEditFields, setRrEditFields] = useState(null); // null = not initialized
    const [hostelEditFields, setHostelEditFields] = useState(null);
    const [rrEditing, setRrEditing] = useState(false);
    const [hostelEditing, setHostelEditing] = useState(false);

    // PDF generating
    const [pdfGenerating, setPdfGenerating] = useState(false);

    // Confirmation modal
    const [confirmAction, setConfirmAction] = useState(null);

    const showSync = (msg, type = 'info') => {
        setSyncStatus({ msg, type });
        setTimeout(() => setSyncStatus(null), 2500);
    };

    // Real-time user listener
    useEffect(() => {
        if (!user?.id) return;
        const unsub = onSnapshot(doc(db, 'users', user.id), (snap) => {
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() };
                setUserData(data);
                setEditFields(prev => {
                    if (Object.keys(prev).length === 0) {
                        return {
                            name: data.name || '',
                            email: data.email || '',
                            phoneNumber: data.phoneNumber || '',
                            address: data.address || data.currentAddress || '',
                            dateOfBirth: data.dateOfBirth || '',
                            college: data.college || '',
                            mrrNumber: data.mrrNumber || '',
                        };
                    }
                    return prev;
                });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [user?.id]);

    // Fetch seat / hostel assignments
    useEffect(() => {
        if (!user?.id) return;
        const fetchAssignments = async () => {
            try {
                const seatQ = query(collection(db, 'seatAssignments'), where('userId', '==', user.id));
                const seatSnap = await getDocs(seatQ);
                setSeatAssignment(seatSnap.empty ? null : { id: seatSnap.docs[0].id, ...seatSnap.docs[0].data() });

                const hostelQ = query(collection(db, 'hostelAssignments'), where('userId', '==', user.id));
                const hostelSnap = await getDocs(hostelQ);
                setHostelAssignment(hostelSnap.empty ? null : { id: hostelSnap.docs[0].id, ...hostelSnap.docs[0].data() });

                const rrQ = query(collection(db, 'readingRoomEnrollments'), where('userId', '==', user.id));
                const rrSnap = await getDocs(rrQ);
                const rrData = rrSnap.empty ? null : { id: rrSnap.docs[0].id, ...rrSnap.docs[0].data() };
                setRrEnrollment(rrData);

                const heQ = query(collection(db, 'hostelEnrollments'), where('userId', '==', user.id));
                const heSnap = await getDocs(heQ);
                const heData = heSnap.empty ? null : { id: heSnap.docs[0].id, ...heSnap.docs[0].data() };
                setHostelEnrollment(heData);
            } catch (err) {
                console.error('Error fetching assignments:', err);
            }
        };
        fetchAssignments();
    }, [user?.id]);

    // Initialize enrollment edit fields when data arrives
    useEffect(() => {
        if (rrEnrollment && !rrEditFields) {
            setRrEditFields({
                name: rawStr(rrEnrollment.name),
                college: rawStr(rrEnrollment.college),
                mobileNo: rawStr(rrEnrollment.mobileNo),
                currentAddress: rawStr(rrEnrollment.currentAddress),
                email: rawStr(rrEnrollment.email),
                joiningDate: rawStr(rrEnrollment.joiningDate),
                preparingFor: rawStr(rrEnrollment.preparingFor),
                dob: rawStr(rrEnrollment.dob),
            });
        }
    }, [rrEnrollment]);

    useEffect(() => {
        if (hostelEnrollment && !hostelEditFields) {
            setHostelEditFields({
                name: rawStr(hostelEnrollment.name),
                dob: rawStr(hostelEnrollment.dob),
                email: rawStr(hostelEnrollment.email),
                contactNo: rawStr(hostelEnrollment.contactNo),
                citizenshipId: rawStr(hostelEnrollment.citizenshipId),
                bloodGroup: rawStr(hostelEnrollment.bloodGroup),
                profession: rawStr(hostelEnrollment.profession),
                college: rawStr(hostelEnrollment.college),
                medicalIssue: rawStr(hostelEnrollment.medicalIssue),
                permanentAddress: rawStr(hostelEnrollment.permanentAddress),
                fatherName: rawStr(hostelEnrollment.fatherName),
                fatherContact: rawStr(hostelEnrollment.fatherContact),
                motherName: rawStr(hostelEnrollment.motherName),
                motherContact: rawStr(hostelEnrollment.motherContact),
                spouseName: rawStr(hostelEnrollment.spouseName),
                spouseContact: rawStr(hostelEnrollment.spouseContact),
                localGuardian: rawStr(hostelEnrollment.localGuardian),
                localGuardianContact: rawStr(hostelEnrollment.localGuardianContact),
                guardianAddress: rawStr(hostelEnrollment.guardianAddress),
            });
        }
    }, [hostelEnrollment]);

    const updateUser = useCallback(async (updates) => {
        try {
            await updateDoc(doc(db, 'users', user.id), { ...updates, updatedAt: new Date().toISOString() });
            showSync('Saved', 'success');
            onUpdate?.();
        } catch (err) {
            console.error('Update error:', err);
            showSync('Save failed', 'error');
        }
    }, [user?.id, onUpdate]);

    const handleEditChange = (field, value) => {
        setEditFields(prev => ({ ...prev, [field]: value }));
    };

    const handleAddBalance = async () => {
        const amount = parseFloat(balanceInput);
        if (!amount || amount <= 0) {
            showSync('Invalid amount', 'error');
            return;
        }

        setIsProcessingBalance(true);
        try {
            const topUpFn = httpsCallable(functions, 'topUpBalance');
            const result = await topUpFn({
                userId: user.id,
                amount: amount
            });

            if (result.data.success) {
                showSync('Balance added successfully', 'success');
                setBalanceInput('');
                // If a loan was deducted, maybe show a specific message?
                if (result.data.loanDeducted > 0) {
                    alert(`Balance added. NOTE: ${formatBalance(result.data.loanDeducted)} was automatically deducted for active loan.`);
                }
            } else {
                showSync('Failed to add balance', 'error');
            }
        } catch (error) {
            console.error('Balance add error:', error);
            showSync(`Error: ${error.message}`, 'error');
        } finally {
            setIsProcessingBalance(false);
        }
    };

    const handleSubtractBalance = async () => {
        const amount = parseFloat(balanceInput);
        if (!amount || amount <= 0) {
            showSync('Invalid amount', 'error');
            return;
        }

        const currentBal = userData.balance || 0;
        const newBal = currentBal - amount;

        setConfirmAction({
            title: 'Subtract Balance',
            description: `Are you sure you want to subtract ${formatBalance(amount)}? New balance will be ${formatBalance(newBal)}.`,
            action: async () => {
                await updateUser({ balance: newBal });
                setBalanceInput('');
            },
            successMsg: 'Balance updated'
        });
    };

    const savePersonalInfo = async () => {
        await updateUser({
            name: editFields.name,
            email: editFields.email,
            phoneNumber: editFields.phoneNumber,
            address: editFields.address,
            dateOfBirth: editFields.dateOfBirth,
            college: editFields.college,
            mrrNumber: editFields.mrrNumber,
        });
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showSync('Photo must be under 5MB', 'error'); return; }
        setPhotoUploading(true);
        try {
            const url = await uploadImageSecurely(file);
            await updateUser({ photoUrl: url, profileImage: url });
            showSync('Photo updated', 'success');
        } catch (err) {
            console.error('Photo upload error:', err);
            showSync('Photo upload failed', 'error');
        } finally {
            setPhotoUploading(false);
        }
    };

    // Save enrollment edits
    const saveRrEnrollment = async () => {
        if (!rrEnrollment?.id) return;
        try {
            await updateDoc(doc(db, 'readingRoomEnrollments', rrEnrollment.id), {
                ...rrEditFields,
                updatedAt: new Date().toISOString()
            });
            setRrEnrollment(prev => ({ ...prev, ...rrEditFields }));
            setRrEditing(false);
            showSync('Reading Room enrollment saved', 'success');
        } catch (err) {
            showSync('Save failed', 'error');
        }
    };

    const saveHostelEnrollment = async () => {
        try {
            if (hostelEnrollment?.id) {
                await updateDoc(doc(db, 'hostelEnrollments', hostelEnrollment.id), {
                    ...hostelEditFields,
                    updatedAt: new Date().toISOString()
                });
                setHostelEnrollment(prev => ({ ...prev, ...hostelEditFields }));
            } else {
                // Create new enrollment
                const newEnrollment = {
                    ...hostelEditFields,
                    userId: user.id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                const docRef = await addDoc(collection(db, 'hostelEnrollments'), newEnrollment);
                setHostelEnrollment({ id: docRef.id, ...newEnrollment });
            }
            setHostelEditing(false);
            showSync('Hostel enrollment saved', 'success');
        } catch (err) {
            console.error('Save error:', err);
            showSync('Save failed', 'error');
        }
    };

    // PDF Generation
    const downloadRrPdf = async () => {
        setPdfGenerating(true);
        try {
            const enrollData = rrEditFields || rrEnrollment || {};
            const blob = await pdf(
                <EnrollmentPDF data={{ ...rrEnrollment, ...enrollData }} user={userData || user} />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ReadingRoom_Enrollment_${(userData || user)?.name || 'User'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            showSync('PDF downloaded', 'success');
        } catch (err) {
            console.error('PDF error:', err);
            showSync('PDF generation failed', 'error');
        } finally {
            setPdfGenerating(false);
        }
    };

    const downloadHostelPdf = async () => {
        setPdfGenerating(true);
        try {
            const enrollData = hostelEditFields || hostelEnrollment || {};
            const blob = await pdf(
                <HostelEnrollmentPDF data={{ ...hostelEnrollment, ...enrollData }} user={userData || user} />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Hostel_Enrollment_${(userData || user)?.name || 'User'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            showSync('PDF downloaded', 'success');
        } catch (err) {
            console.error('PDF error:', err);
            showSync('PDF generation failed', 'error');
        } finally {
            setPdfGenerating(false);
        }
    };

    const executeConfirmAction = async () => {
        if (!confirmAction) return;
        try {
            await confirmAction.action();
            showSync(confirmAction.successMsg || 'Done', 'success');
        } catch (err) {
            showSync('Action failed', 'error');
        }
        setConfirmAction(null);
    };

    if (!isOpen) return null;
    const u = userData || user;

    // ─── Inline table styles ───
    const labelCell = { padding: '10px', border: '1px solid #333', fontWeight: 'bold', backgroundColor: '#f9fafb', width: '20%', verticalAlign: 'middle' };
    const valueCell = { padding: '10px', border: '1px solid #333', width: '30%' };
    const inputStyle = { width: '100%', padding: '6px 8px', border: '1px solid #ccc', outline: 'none', boxSizing: 'border-box', borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit' };
    const sectionHeaderStyle = { backgroundColor: '#333', color: 'white', padding: '8px 15px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px', marginTop: '20px', marginBottom: '0' };
    const readOnlyStyle = { fontSize: '14px' };

    // Helper for rendering editable or read-only cell
    const EditableCell = ({ editing, value, field, onChange, type = 'text' }) => {
        if (editing) {
            return <input type={type} value={value || ''} onChange={(e) => onChange(field, e.target.value)} style={inputStyle} />;
        }
        return <span style={readOnlyStyle}>{safeStr(value)}</span>;
    };

    // ────────────────────────────────────
    //  TAB: OVERALL
    // ────────────────────────────────────
    const renderOverallTab = () => (
        <div className="udv-tab-content-inner">
            {/* ── Personal Information (Editable) ── */}
            <div className="udv-card">
                <div className="udv-card-header">
                    <User size={16} /> Personal Information
                </div>
                <div className="udv-card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ position: 'relative', width: '70px', height: '70px', flexShrink: 0 }}>
                            {(u.profileImage || u.photoUrl) ? (
                                <img src={u.profileImage || u.photoUrl} alt={u.name} referrerPolicy="no-referrer"
                                    style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb' }} />
                            ) : (
                                <div style={{ width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)', color: 'white' }}>
                                    {(u.name || 'U').charAt(0).toUpperCase()}
                                </div>
                            )}
                            <label style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '26px', height: '26px', borderRadius: '50%', background: '#007AFF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                                <Camera size={12} />
                                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                            </label>
                        </div>
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '1rem' }}>{u.name || 'Unknown'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#999' }}>{u.mrrNumber || 'No MRR Number'}</div>
                            {photoUploading && <div style={{ fontSize: '0.6875rem', color: '#007AFF', marginTop: '4px' }}>Uploading...</div>}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {[
                            { label: 'Full Name', field: 'name', type: 'text' },
                            { label: 'Email', field: 'email', type: 'email' },
                            { label: 'Phone Number', field: 'phoneNumber', type: 'tel' },
                            { label: 'Address', field: 'address', type: 'text' },
                            { label: 'Date of Birth', field: 'dateOfBirth', type: 'date' },
                            { label: 'College / Institution', field: 'college', type: 'text' },
                            { label: 'MRR Number', field: 'mrrNumber', type: 'text' },
                        ].map(f => (
                            <div key={f.field} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{f.label}</label>
                                <input type={f.type} value={editFields[f.field] || ''} onChange={(e) => handleEditChange(f.field, e.target.value)}
                                    style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff', color: '#1a1a1a', boxSizing: 'border-box', outline: 'none' }} />
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '14px', textAlign: 'right' }}>
                        <button className="udv-btn-sm" onClick={savePersonalInfo} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}>
                            <Save size={14} /> Save Changes
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Balance Management ── */}
            <div className="udv-card">
                <div className="udv-card-header"><Wallet size={16} /> Balance Management</div>
                <div className="udv-card-body">
                    <div className="udv-balance-display">
                        <span>Current Balance</span>
                        <strong className={(u.balance || 0) < 0 ? 'negative' : ''}>{formatBalance(u.balance || 0)}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
                        <input
                            type="number"
                            placeholder="Amount"
                            value={balanceInput}
                            onChange={(e) => setBalanceInput(e.target.value)}
                            style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                            className="udv-btn-sm success"
                            disabled={!balanceInput || isProcessingBalance}
                            onClick={handleAddBalance}
                            style={{ backgroundColor: '#10b981', color: 'white', border: 'none' }}
                        >
                            {isProcessingBalance ? 'Processing...' : 'Add (+)'}
                        </button>
                        <button
                            className="udv-btn-sm danger"
                            disabled={!balanceInput || isProcessingBalance}
                            onClick={handleSubtractBalance}
                            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none' }}
                        >
                            Subtract (-)
                        </button>
                    </div>
                    <p style={{ fontSize: '11px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
                        Note: "Add" will typically top-up the wallet. If the user has an active loan, it will be automatically deducted from this amount.
                    </p>
                </div>
            </div>

            {/* ── Account Status ── */}
            <div className="udv-card">
                <div className="udv-card-header"><Shield size={16} /> Account Status</div>
                <div className="udv-card-body">
                    <div className="udv-toggle-row">
                        <div className="udv-toggle-label"><UserCheck size={16} /><div><span>Verified</span><p>User can access the platform</p></div></div>
                        <label className="udv-switch"><input type="checkbox" checked={u.verified || false} onChange={(e) => updateUser({ verified: e.target.checked })} /><span className="udv-slider" /></label>
                    </div>
                    <div className="udv-toggle-row">
                        <div className="udv-toggle-label"><Ban size={16} /><div><span>Banned</span><p>Block all access to the account</p></div></div>
                        <label className="udv-switch danger">
                            <input type="checkbox" checked={u.banned || false} onChange={(e) => {
                                if (e.target.checked) { setConfirmAction({ title: 'Ban User', description: `This will block ${u.name || 'this user'} from accessing the platform.`, action: () => updateUser({ banned: true }), successMsg: 'User banned' }); } else { updateUser({ banned: false }); }
                            }} />
                            <span className="udv-slider" />
                        </label>
                    </div>
                </div>
            </div>

            {/* ── Role Management ── */}
            <div className="udv-card">
                <div className="udv-card-header"><Settings2 size={16} /> Role Management</div>
                <div className="udv-card-body">
                    <div className="udv-role-chips">
                        {[
                            { value: 'client', icon: <UserCheck size={18} />, label: 'Client', desc: 'Standard member access' },
                            { value: 'admin', icon: <Shield size={18} />, label: 'Admin', desc: 'Full platform control' },
                            { value: 'canteen', icon: <CreditCard size={18} />, label: 'Canteen', desc: 'Canteen management only' }
                        ].map(r => (
                            <button key={r.value} className={`udv-role-chip ${(u.role || 'client') === r.value ? 'active' : ''}`}
                                onClick={() => { if ((u.role || 'client') !== r.value) { setConfirmAction({ title: `Change role to ${r.label}`, description: `This user will get ${r.desc.toLowerCase()}.`, action: () => updateUser({ role: r.value }), successMsg: `Role changed to ${r.label}` }); } }}>
                                {r.icon}
                                <div className="udv-role-text"><strong>{r.label}</strong><small>{r.desc}</small></div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Loan Overview ── */}
            <div className="udv-card">
                <div className="udv-card-header"><Wallet size={16} /> Loan Overview</div>
                <div className="udv-card-body">
                    {u.loan?.has_active_loan ? (
                        <div className="udv-loan-info">
                            <div className="udv-balance-display">
                                <span>Active Loan Balance</span>
                                <strong className="negative">{formatBalance(u.loan.current_balance || 0)}</strong>
                            </div>
                            <button className="udv-btn-sm danger" onClick={() => setConfirmAction({ title: 'Reset Loan', description: 'This will clear the active loan and reset the balance to zero.', action: () => updateUser({ loan: { has_active_loan: false, current_balance: 0 } }), successMsg: 'Loan reset' })}>
                                <RotateCcw size={14} /> Reset Loan
                            </button>
                        </div>
                    ) : (<p className="udv-muted">No active loan</p>)}
                </div>
            </div>

            {/* ── Registration Flags ── */}
            <div className="udv-card">
                <div className="udv-card-header"><Settings2 size={16} /> Registration Flags</div>
                <div className="udv-card-body">
                    <div className="udv-toggle-row">
                        <div className="udv-toggle-label"><span>Registration Completed</span></div>
                        <label className="udv-switch"><input type="checkbox" checked={u.registrationCompleted || false} onChange={(e) => updateUser({ registrationCompleted: e.target.checked })} /><span className="udv-slider" /></label>
                    </div>
                    <div className="udv-toggle-row">
                        <div className="udv-toggle-label"><span>Enrollment Completed</span></div>
                        <label className="udv-switch"><input type="checkbox" checked={u.enrollmentCompleted || false} onChange={(e) => updateUser({ enrollmentCompleted: e.target.checked })} /><span className="udv-slider" /></label>
                    </div>
                </div>
            </div>

            {/* ── Danger Zone ── */}
            <div className="udv-card udv-danger-card">
                <div className="udv-card-header danger"><AlertTriangle size={16} /> Danger Zone</div>
                <div className="udv-card-body">
                    <button className="udv-btn-danger" onClick={() => setConfirmAction({
                        title: 'Reset All Enrollments', description: 'This will delete all enrollment data for this user. This action cannot be undone.',
                        action: async () => {
                            await updateUser({ registrationCompleted: false, enrollmentCompleted: false, hostelRegistrationPaid: false });
                            if (rrEnrollment?.id) await deleteDoc(doc(db, 'readingRoomEnrollments', rrEnrollment.id));
                            if (hostelEnrollment?.id) await deleteDoc(doc(db, 'hostelEnrollments', hostelEnrollment.id));
                        }, successMsg: 'Enrollments reset'
                    })}>
                        <Trash2 size={14} /> Reset All Enrollments
                    </button>
                </div>
            </div>
        </div>
    );

    // ────────────────────────────────────
    //  TAB: READING ROOM (editable + PDF)
    // ────────────────────────────────────
    const renderReadingRoomTab = () => {
        if (!rrEnrollment && !seatAssignment) {
            return (
                <div className="udv-empty-state">
                    <BookOpen size={40} />
                    <h4>Not Enrolled in Reading Room</h4>
                    <p>This user has not submitted a reading room enrollment form.</p>
                </div>
            );
        }

        const fields = rrEditFields || {};
        const enrollment = rrEnrollment || {};
        const isEditing = rrEditing;
        const onChange = (field, val) => setRrEditFields(prev => ({ ...prev, [field]: val }));

        return (
            <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: 'white', padding: '40px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {/* Action bar */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                    {rrEnrollment && (
                        <>
                            <button className="udv-btn-sm" onClick={() => { if (isEditing) { saveRrEnrollment(); } else { setRrEditing(true); } }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {isEditing ? <><Save size={14} /> Save</> : <><Pencil size={14} /> Edit</>}
                            </button>
                            {isEditing && (
                                <button className="udv-btn-sm danger" onClick={() => {
                                    setRrEditFields({
                                        name: rawStr(rrEnrollment.name), college: rawStr(rrEnrollment.college), mobileNo: rawStr(rrEnrollment.mobileNo),
                                        currentAddress: rawStr(rrEnrollment.currentAddress), email: rawStr(rrEnrollment.email), joiningDate: rawStr(rrEnrollment.joiningDate),
                                        preparingFor: rawStr(rrEnrollment.preparingFor), dob: rawStr(rrEnrollment.dob),
                                    });
                                    setRrEditing(false);
                                }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <X size={14} /> Cancel
                                </button>
                            )}
                            <button className="udv-btn-sm" onClick={downloadRrPdf} disabled={pdfGenerating}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#333' }}>
                                <Download size={14} /> {pdfGenerating ? 'Generating...' : 'Download PDF'}
                            </button>
                        </>
                    )}
                </div>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
                    <img src={logo} alt="Logo" style={{ width: '80px', height: '80px', marginBottom: '10px', display: 'block', margin: '0 auto 10px auto' }} />
                    <h1 style={{ margin: '10px 0', fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>Membership Registration Form</h1>
                    <h2 style={{ margin: '5px 0', fontSize: '18px', fontWeight: '600' }}>Mero Reading Room</h2>
                </div>

                <table style={{ width: '100%', marginBottom: '30px', borderCollapse: 'collapse', border: '1px solid #333' }}>
                    <tbody>
                        <tr>
                            <td style={labelCell}>Name:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.name : (enrollment.name || u.name)} field="name" onChange={onChange} /></td>
                            <td style={labelCell}>College:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.college : (enrollment.college || u.college)} field="college" onChange={onChange} /></td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Mobile No:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.mobileNo : (enrollment.mobileNo || u.phoneNumber)} field="mobileNo" onChange={onChange} type="tel" /></td>
                            <td style={labelCell}>Current Address:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.currentAddress : (enrollment.currentAddress || u.address)} field="currentAddress" onChange={onChange} /></td>
                        </tr>
                        <tr>
                            <td style={labelCell}>E-Mail:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.email : (enrollment.email || u.email)} field="email" onChange={onChange} type="email" /></td>
                            <td style={labelCell}>Joining Date:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.joiningDate : enrollment.joiningDate} field="joiningDate" onChange={onChange} type="date" /></td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Preparing For:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.preparingFor : enrollment.preparingFor} field="preparingFor" onChange={onChange} /></td>
                            <td style={labelCell}>DoB:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.dob : (enrollment.dob || u.dateOfBirth)} field="dob" onChange={onChange} type="date" /></td>
                        </tr>
                    </tbody>
                </table>

                {/* Seat Assignment */}
                {seatAssignment && (
                    <>
                        <div style={sectionHeaderStyle}>Seat Assignment</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: '20px' }}>
                            <tbody>
                                <tr>
                                    <td style={labelCell}>Room:</td>
                                    <td style={valueCell}><span style={readOnlyStyle}>{safeStr(seatAssignment.roomName || seatAssignment.roomId)}</span></td>
                                    <td style={labelCell}>Seat:</td>
                                    <td style={valueCell}><span style={readOnlyStyle}>{safeStr(seatAssignment.seatNumber || seatAssignment.seatId)}</span></td>
                                </tr>
                                <tr>
                                    <td style={labelCell}>Assigned:</td>
                                    <td style={valueCell}><span style={readOnlyStyle}>{safeStr(seatAssignment.assignedAt)}</span></td>
                                    <td style={labelCell}>Room Type:</td>
                                    <td style={valueCell}><span style={readOnlyStyle}>{safeStr(seatAssignment.roomType)}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </>
                )}

                {/* Payment Controls */}
                <div style={sectionHeaderStyle}>Payment Controls</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: '20px' }}>
                    <tbody>
                        <tr>
                            <td style={labelCell}>Next Payment Due:</td>
                            <td style={{ ...valueCell, width: '80%' }}>
                                <input type="date" value={formatDateForInput(u.nextPaymentDue) || ''} onChange={(e) => updateUser({ nextPaymentDue: e.target.value })} style={inputStyle} />
                            </td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Fine Amount:</td>
                            <td style={valueCell}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '600', minWidth: '80px' }}>{formatBalance(u.fine || 0)}</span>
                                    <input type="number" placeholder="Set fine" value={fineInput} onChange={(e) => setFineInput(e.target.value)} style={{ ...inputStyle, maxWidth: '120px' }} />
                                    <button className="udv-btn-sm" disabled={!fineInput} onClick={() => { updateUser({ fine: parseFloat(fineInput) }); setFineInput(''); }}>Set</button>
                                    <button className="udv-btn-sm danger" onClick={() => updateUser({ fine: 0 })}>Reset</button>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Grace Period:</td>
                            <td style={valueCell}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={u.gracePeriod || false} onChange={(e) => updateUser({ gracePeriod: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                                    <span style={{ fontSize: '14px' }}>Enable grace period</span>
                                </label>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Signature */}
                {enrollment.signatureUrl && (
                    <div style={{ display: 'flex', gap: '40px', marginBottom: '30px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Declaration Date:</label>
                            <span style={{ fontSize: '14px' }}>{safeStr(enrollment.declarationDate)}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Signature:</label>
                            <img src={enrollment.signatureUrl} alt="Signature" style={{ maxWidth: '200px', maxHeight: '100px', border: '1px solid #ccc', padding: '5px' }} />
                        </div>
                    </div>
                )}

                {seatAssignment && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button className="udv-btn-danger" onClick={() => setConfirmAction({
                            title: 'Remove Seat Assignment', description: 'This will unassign the user from their current seat.',
                            action: async () => { await deleteDoc(doc(db, 'seatAssignments', seatAssignment.id)); setSeatAssignment(null); }, successMsg: 'Seat removed'
                        })}><Trash2 size={14} /> Remove Seat Assignment</button>
                    </div>
                )}
            </div>
        );
    };

    // ────────────────────────────────────
    //  TAB: HOSTEL (editable + PDF)
    // ────────────────────────────────────
    const renderHostelTab = () => {
        if (!hostelEnrollment && !hostelAssignment) {
            return (
                <div className="udv-empty-state">
                    <Building2 size={40} />
                    <h4>Not Enrolled in Hostel</h4>
                    <p>This user has not submitted a hostel enrollment form.</p>
                </div>
            );
        }

        const fields = hostelEditFields || {};
        const enrollment = hostelEnrollment || {};
        const isEditing = hostelEditing;
        const onChange = (field, val) => setHostelEditFields(prev => ({ ...prev, [field]: val }));

        return (
            <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: 'white', padding: '40px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {/* Action bar */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                    {(hostelEnrollment || hostelAssignment) && (
                        <>
                            <button className="udv-btn-sm" onClick={() => {
                                if (isEditing) {
                                    saveHostelEnrollment();
                                } else {
                                    // Initialize edit fields if missing (empty form for creation)
                                    if (!hostelEditFields && !hostelEnrollment) {
                                        setHostelEditFields({});
                                    }
                                    setHostelEditing(true);
                                }
                            }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {isEditing ? <><Save size={14} /> Save</> : <><Pencil size={14} /> {hostelEnrollment ? 'Edit' : 'Create Form'}</>}
                            </button>
                            {isEditing && (
                                <button className="udv-btn-sm danger" onClick={() => {
                                    setHostelEditFields({
                                        name: rawStr(hostelEnrollment.name), dob: rawStr(hostelEnrollment.dob), email: rawStr(hostelEnrollment.email),
                                        contactNo: rawStr(hostelEnrollment.contactNo), citizenshipId: rawStr(hostelEnrollment.citizenshipId),
                                        bloodGroup: rawStr(hostelEnrollment.bloodGroup), profession: rawStr(hostelEnrollment.profession),
                                        college: rawStr(hostelEnrollment.college), medicalIssue: rawStr(hostelEnrollment.medicalIssue),
                                        permanentAddress: rawStr(hostelEnrollment.permanentAddress),
                                        fatherName: rawStr(hostelEnrollment.fatherName), fatherContact: rawStr(hostelEnrollment.fatherContact),
                                        motherName: rawStr(hostelEnrollment.motherName), motherContact: rawStr(hostelEnrollment.motherContact),
                                        spouseName: rawStr(hostelEnrollment.spouseName), spouseContact: rawStr(hostelEnrollment.spouseContact),
                                        localGuardian: rawStr(hostelEnrollment.localGuardian), localGuardianContact: rawStr(hostelEnrollment.localGuardianContact),
                                        guardianAddress: rawStr(hostelEnrollment.guardianAddress),
                                    });
                                    setHostelEditing(false);
                                }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <X size={14} /> Cancel
                                </button>
                            )}
                            <button className="udv-btn-sm" onClick={downloadHostelPdf} disabled={pdfGenerating}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#333' }}>
                                <Download size={14} /> {pdfGenerating ? 'Generating...' : 'Download PDF'}
                            </button>
                        </>
                    )}
                </div>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
                    <img src={logo} alt="Logo" style={{ width: '80px', height: '80px', marginBottom: '10px', display: 'block', margin: '0 auto 10px auto' }} />
                    <h1 style={{ margin: '10px 0', fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>Hostel Admission Form</h1>
                    <h2 style={{ margin: '5px 0', fontSize: '18px', fontWeight: '600' }}>Mero Reading Room & Hostel</h2>
                </div>

                {/* Personal Information */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: '20px' }}>
                    <tbody>
                        <tr>
                            <td style={labelCell}>Full Name:</td>
                            <td style={valueCell} colSpan="3"><EditableCell editing={isEditing} value={isEditing ? fields.name : (enrollment.name || u.name)} field="name" onChange={onChange} /></td>
                        </tr>
                        <tr>
                            <td style={labelCell}>DOB:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.dob : (enrollment.dob || u.dateOfBirth)} field="dob" onChange={onChange} type="date" /></td>
                            <td style={labelCell}>Blood Group:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.bloodGroup : enrollment.bloodGroup} field="bloodGroup" onChange={onChange} /></td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Contact No:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.contactNo : (enrollment.contactNo || u.phoneNumber)} field="contactNo" onChange={onChange} type="tel" /></td>
                            <td style={labelCell}>Email:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.email : (enrollment.email || u.email)} field="email" onChange={onChange} type="email" /></td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Citizenship No:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.citizenshipId : enrollment.citizenshipId} field="citizenshipId" onChange={onChange} /></td>
                            <td style={labelCell}>Profession:</td>
                            <td style={valueCell}><EditableCell editing={isEditing} value={isEditing ? fields.profession : enrollment.profession} field="profession" onChange={onChange} /></td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Institution:</td>
                            <td style={valueCell} colSpan="3"><EditableCell editing={isEditing} value={isEditing ? fields.college : (enrollment.college || u.college)} field="college" onChange={onChange} /></td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Medical Issues:</td>
                            <td style={valueCell} colSpan="3"><EditableCell editing={isEditing} value={isEditing ? fields.medicalIssue : enrollment.medicalIssue} field="medicalIssue" onChange={onChange} /></td>
                        </tr>
                    </tbody>
                </table>

                {/* Address */}
                <div style={sectionHeaderStyle}>Address Details</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: '20px' }}>
                    <tbody>
                        <tr>
                            <td style={{ ...labelCell, width: '20%' }}>Permanent Address:</td>
                            <td style={{ ...valueCell, width: '80%' }}><EditableCell editing={isEditing} value={isEditing ? fields.permanentAddress : (enrollment.permanentAddress || u.address)} field="permanentAddress" onChange={onChange} /></td>
                        </tr>
                    </tbody>
                </table>

                {/* Guardian Information */}
                <div style={sectionHeaderStyle}>Guardian Information</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: '20px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#eee' }}>
                            <th style={{ padding: '8px', border: '1px solid #333', textAlign: 'left', width: '15%' }}>Relation</th>
                            <th style={{ padding: '8px', border: '1px solid #333', textAlign: 'left', width: '45%' }}>Name</th>
                            <th style={{ padding: '8px', border: '1px solid #333', textAlign: 'left', width: '40%' }}>Contact No.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { relation: 'Father', nameField: 'fatherName', contactField: 'fatherContact' },
                            { relation: 'Mother', nameField: 'motherName', contactField: 'motherContact' },
                            { relation: 'Spouse', nameField: 'spouseName', contactField: 'spouseContact' },
                            { relation: 'Local Guardian', nameField: 'localGuardian', contactField: 'localGuardianContact' }
                        ].map((g, i) => (
                            <tr key={i}>
                                <td style={{ padding: '8px', border: '1px solid #333', fontWeight: '500' }}>{g.relation}</td>
                                <td style={{ padding: '8px', border: '1px solid #333', fontSize: '14px' }}>
                                    <EditableCell editing={isEditing} value={isEditing ? fields[g.nameField] : enrollment[g.nameField]} field={g.nameField} onChange={onChange} />
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #333', fontSize: '14px' }}>
                                    <EditableCell editing={isEditing} value={isEditing ? fields[g.contactField] : enrollment[g.contactField]} field={g.contactField} onChange={onChange} type="tel" />
                                </td>
                            </tr>
                        ))}
                        <tr>
                            <td style={{ padding: '8px', border: '1px solid #333', fontWeight: '500' }}>Guardian Address</td>
                            <td style={{ padding: '8px', border: '1px solid #333', fontSize: '14px' }} colSpan="2">
                                <EditableCell editing={isEditing} value={isEditing ? fields.guardianAddress : enrollment.guardianAddress} field="guardianAddress" onChange={onChange} />
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Room Assignment */}
                {hostelAssignment && (
                    <>
                        <div style={sectionHeaderStyle}>Room Assignment</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: '20px' }}>
                            <tbody>
                                <tr>
                                    <td style={labelCell}>Room:</td>
                                    <td style={valueCell}><span style={readOnlyStyle}>{safeStr(hostelAssignment.roomName || hostelAssignment.roomId)}</span></td>
                                    <td style={labelCell}>Bed:</td>
                                    <td style={valueCell}><span style={readOnlyStyle}>{safeStr(hostelAssignment.bedNumber || hostelAssignment.bedId)}</span></td>
                                </tr>
                                <tr>
                                    <td style={labelCell}>Floor:</td>
                                    <td style={valueCell}><span style={readOnlyStyle}>{safeStr(hostelAssignment.floor)}</span></td>
                                    <td style={labelCell}>Assigned:</td>
                                    <td style={valueCell}><span style={readOnlyStyle}>{safeStr(hostelAssignment.assignedAt)}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </>
                )}

                {/* Payment Controls */}
                <div style={sectionHeaderStyle}>Payment Controls</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #333', marginBottom: '20px' }}>
                    <tbody>
                        <tr>
                            <td style={labelCell}>Next Payment Due:</td>
                            <td style={{ ...valueCell, width: '80%' }}>
                                <input type="date" value={formatDateForInput(u.hostelNextPaymentDue) || ''} onChange={(e) => updateUser({ hostelNextPaymentDue: e.target.value })} style={inputStyle} />
                            </td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Fine Amount:</td>
                            <td style={valueCell}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '600', minWidth: '80px' }}>{formatBalance(u.hostelFine || 0)}</span>
                                    <input type="number" placeholder="Set fine" value={hostelFineInput} onChange={(e) => setHostelFineInput(e.target.value)} style={{ ...inputStyle, maxWidth: '120px' }} />
                                    <button className="udv-btn-sm" disabled={!hostelFineInput} onClick={() => { updateUser({ hostelFine: parseFloat(hostelFineInput) }); setHostelFineInput(''); }}>Set</button>
                                    <button className="udv-btn-sm danger" onClick={() => updateUser({ hostelFine: 0 })}>Reset</button>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Grace Period:</td>
                            <td style={valueCell}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={u.hostelGracePeriod || false} onChange={(e) => updateUser({ hostelGracePeriod: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                                    <span style={{ fontSize: '14px' }}>Enable grace period</span>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <td style={labelCell}>Registration Paid:</td>
                            <td style={valueCell}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={u.hostelRegistrationPaid || false} onChange={(e) => updateUser({ hostelRegistrationPaid: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                                    <span style={{ fontSize: '14px' }}>Mark registration as paid</span>
                                </label>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Photo */}
                {enrollment.photoUrl && (
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <img src={enrollment.photoUrl} alt="User Photo" style={{ width: '150px', height: '180px', objectFit: 'cover', border: '1px solid #333' }} />
                    </div>
                )}

                {/* Remove Assignment */}
                {hostelAssignment && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button className="udv-btn-danger" onClick={() => setConfirmAction({
                            title: 'Remove Hostel Assignment', description: 'This will unassign the user from their hostel room.',
                            action: async () => { await deleteDoc(doc(db, 'hostelAssignments', hostelAssignment.id)); setHostelAssignment(null); }, successMsg: 'Hostel assignment removed'
                        })}><Trash2 size={14} /> Remove Hostel Assignment</button>
                    </div>
                )}
            </div>
        );
    };

    // ────────────────────────────────────
    //  MAIN RENDER
    // ────────────────────────────────────
    return (
        <div className="udv-overlay">
            <div className="udv-modal">
                <div className="udv-header">
                    <h2>{u.name || 'User Details'}</h2>
                    <button className="udv-close-btn" onClick={onClose}><X size={18} /></button>
                </div>

                {syncStatus && (<div className={`udv-sync ${syncStatus.type}`}>{syncStatus.msg}</div>)}

                <div className="udv-tabs">
                    <button className={`udv-tab ${activeTab === 'overall' ? 'active' : ''}`} onClick={() => setActiveTab('overall')}>
                        <Settings2 size={16} /> Overall
                    </button>
                    <button className={`udv-tab ${activeTab === 'readingroom' ? 'active' : ''}`} onClick={() => setActiveTab('readingroom')}>
                        <BookOpen size={16} /> Reading Room
                        <span className={`udv-dot ${seatAssignment || rrEnrollment ? 'active' : ''}`} />
                    </button>
                    <button className={`udv-tab ${activeTab === 'hostel' ? 'active' : ''}`} onClick={() => setActiveTab('hostel')}>
                        <BedDouble size={16} /> Hostel
                        <span className={`udv-dot ${hostelAssignment || hostelEnrollment ? 'active' : ''}`} />
                    </button>
                </div>

                <div className="udv-body">
                    {loading ? (
                        <div className="udv-loading">Loading...</div>
                    ) : (
                        <>
                            {activeTab === 'overall' && renderOverallTab()}
                            {activeTab === 'readingroom' && renderReadingRoomTab()}
                            {activeTab === 'hostel' && renderHostelTab()}
                        </>
                    )}
                </div>

                {confirmAction && (
                    <div className="udv-confirm-overlay">
                        <div className="udv-confirm-modal">
                            <AlertTriangle size={32} color="#FF3B30" />
                            <h3>{confirmAction.title}</h3>
                            <p>{confirmAction.description}</p>
                            <div className="udv-confirm-actions">
                                <button className="udv-btn-cancel" onClick={() => setConfirmAction(null)}>Cancel</button>
                                <button className="udv-btn-confirm" onClick={executeConfirmAction}>Confirm</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default UserDetailView;

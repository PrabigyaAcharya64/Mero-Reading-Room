import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Save, Settings, ArrowLeft } from 'lucide-react';
import { useAdminHeader } from '../../context/AdminHeaderContext';
import '../../styles/StandardLayout.css';

function CanteenSettings({ onBack }) {
    const { setHeader } = useAdminHeader();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [staffDiscount, setStaffDiscount] = useState(0);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // If we are in the main admin layout context, this sets the header
        setHeader({
            title: 'Canteen Settings',
            onBack: onBack
        });
        loadSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadSettings = async () => {
        try {
            const configDoc = await getDoc(doc(db, 'settings', 'config'));
            if (configDoc.exists()) {
                const data = configDoc.data();
                const discount = data.CANTEEN_DISCOUNTS?.staff || 0;
                setStaffDiscount(discount);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            setMessage('Error loading settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            const configRef = doc(db, 'settings', 'config');
            // We use dot notation to update nested field without overwriting other config
            await updateDoc(configRef, {
                "CANTEEN_DISCOUNTS.staff": Number(staffDiscount)
            });

            setMessage('Settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            // Fallback: if doc doesn't exist or update fails deeply
            try {
                await setDoc(configRef, {
                    CANTEEN_DISCOUNTS: {
                        staff: Number(staffDiscount)
                    }
                }, { merge: true });
                setMessage('Settings saved successfully!');
            } catch (retryError) {
                console.error('Error saving settings:', retryError);
                setMessage('Failed to save settings');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="std-container">
            {/* Simple Header for standalone view if not in Admin Layout */}
            {!setHeader && (
                <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <ArrowLeft size={24} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>Canteen Settings</h2>
                </div>
            )}

            <main className="std-body" style={{ maxWidth: '600px', margin: '24px auto' }}>
                <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', color: '#374151' }}>
                        <Settings size={24} />
                        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Discount Configuration</h2>
                    </div>

                    <form onSubmit={handleSave}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                                Staff Discount Percentage (%)
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={staffDiscount}
                                    onChange={(e) => setStaffDiscount(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '15px'
                                    }}
                                />
                                <span style={{ color: '#6b7280', fontSize: '14px' }}>%</span>
                            </div>
                            <p style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
                                This discount will be automatically applied to all orders placed by users with the 'Staff' canteen type.
                            </p>
                        </div>

                        <Button type="submit" variant="primary" loading={saving} fullWidth>
                            <Save size={18} /> Save Settings
                        </Button>

                        {message && (
                            <div style={{
                                marginTop: '16px',
                                padding: '10px',
                                borderRadius: '8px',
                                backgroundColor: message.includes('success') ? '#ecfdf5' : '#fef2f2',
                                color: message.includes('success') ? '#047857' : '#b91c1c',
                                fontSize: '14px',
                                textAlign: 'center'
                            }}>
                                {message}
                            </div>
                        )}
                    </form>
                </div>
            </main>
        </div>
    );
}

export default CanteenSettings;

import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { Save, RefreshCw } from 'lucide-react';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';

function Settings({ onBack }) { // onBack prop is now unused but kept for compatibility if passed
    const { config, updateConfig, loading } = useConfig();
    const [formData, setFormData] = useState(null);
    const [saving, setSaving] = useState(false);

    // Sync formData with config when config loads or changes
    useEffect(() => {
        if (config) {
            setFormData(JSON.parse(JSON.stringify(config)));
        }
    }, [config]);

    const handleChange = (section, key, value, subSection = null) => {
        setFormData(prev => {
            const temp = { ...prev };
            if (subSection) {
                temp[section][subSection][key] = value;
            } else {
                temp[section][key] = value;
            }
            return temp;
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        const result = await updateConfig(formData);
        setSaving(false);
        if (result.success) {
            window.alert("Settings saved successfully!");
        } else {
            window.alert("Failed to save settings: " + result.error?.message);
        }
    };

    // Show loader ONLY if we have absolutely no data yet
    if (loading && !formData) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <LoadingSpinner />
            </div>
        );
    }

    // Safety fallback
    if (!formData) return null;

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>

            <form onSubmit={handleSave}>
                {/* Reading Room Section */}
                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#333' }}>
                        Reading Room Configuration
                    </h2>
                    <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: '1fr 1fr' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                Registration Fee (One-time)
                            </label>
                            <input
                                type="number"
                                value={formData.READING_ROOM?.REGISTRATION_FEE || 0}
                                onChange={(e) => handleChange('READING_ROOM', 'REGISTRATION_FEE', Number(e.target.value))}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                Non-AC Monthly Fee
                            </label>
                            <input
                                type="number"
                                value={formData.READING_ROOM?.MONTHLY_FEE?.NON_AC || 0}
                                onChange={(e) => handleChange('READING_ROOM', 'NON_AC', Number(e.target.value), 'MONTHLY_FEE')}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                AC Monthly Fee
                            </label>
                            <input
                                type="number"
                                value={formData.READING_ROOM?.MONTHLY_FEE?.AC || 0}
                                onChange={(e) => handleChange('READING_ROOM', 'AC', Number(e.target.value), 'MONTHLY_FEE')}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                    </div>
                </section>

                {/* Hostel Section */}
                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#333' }}>
                        Hostel Configuration
                    </h2>
                    <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: '1fr 1fr' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                Registration Fee
                            </label>
                            <input
                                type="number"
                                value={formData.HOSTEL?.REGISTRATION_FEE || 0}
                                onChange={(e) => handleChange('HOSTEL', 'REGISTRATION_FEE', Number(e.target.value))}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                Refundable Deposit
                            </label>
                            <input
                                type="number"
                                value={formData.HOSTEL?.REFUNDABLE_DEPOSIT || 0}
                                onChange={(e) => handleChange('HOSTEL', 'REFUNDABLE_DEPOSIT', Number(e.target.value))}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                    </div>
                </section>

                {/* Discounts Section */}
                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#333' }}>
                        Discounts & Loyalty
                    </h2>
                    <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: '1fr 1fr' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                Referral Discount (%)
                            </label>
                            <input
                                type="number"
                                value={formData.DISCOUNTS?.REFERRAL_DISCOUNT_PERCENT || 0}
                                onChange={(e) => handleChange('DISCOUNTS', 'REFERRAL_DISCOUNT_PERCENT', Number(e.target.value))}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                Bulk Booking Discount (%)
                            </label>
                            <input
                                type="number"
                                value={formData.DISCOUNTS?.BULK_BOOKING_DISCOUNT || 0}
                                onChange={(e) => handleChange('DISCOUNTS', 'BULK_BOOKING_DISCOUNT', Number(e.target.value))}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                Bundle Discount (Flat Amount)
                            </label>
                            <input
                                type="number"
                                value={formData.DISCOUNTS?.BUNDLE_DISCOUNT || 0}
                                onChange={(e) => handleChange('DISCOUNTS', 'BUNDLE_DISCOUNT', Number(e.target.value))}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                    </div>
                </section>

                {/* SMS Section */}
                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#333' }}>
                        SMS Notifications
                    </h2>

                    <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                            Daily Send Hour (0-23)
                        </label>
                        <input
                            type="number"
                            min="0" max="23"
                            value={formData.SMS?.SEND_HOUR ?? 10}
                            onChange={(e) => handleChange('SMS', 'SEND_HOUR', Number(e.target.value))}
                            style={{ width: '100px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                        <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                            Hour of the day to send automated expiry warnings (Kathmandu Time)
                        </p>
                    </div>

                    <div style={{ display: 'grid', gap: '30px', gridTemplateColumns: '1fr 1fr' }}>
                        {/* Reading Room SMS */}
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>Reading Room Messages</h3>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                    Warning Message (3 days before)
                                </label>
                                <textarea
                                    value={formData.SMS?.RR_WARNING_TEMPLATE || formData.SMS?.WARNING_TEMPLATE || ''}
                                    onChange={(e) => handleChange('SMS', 'RR_WARNING_TEMPLATE', e.target.value)}
                                    placeholder="Hello {{name}}, your Reading Room subscription expires on {{date}}. Please renew."
                                    rows="4"
                                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    Use <strong>{'{{name}}'}</strong> and <strong>{'{{date}}'}</strong> as variables.
                                </p>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                    Grace Period End Message
                                </label>
                                <textarea
                                    value={formData.SMS?.RR_GRACE_END_TEMPLATE || formData.SMS?.GRACE_END_TEMPLATE || ''}
                                    onChange={(e) => handleChange('SMS', 'RR_GRACE_END_TEMPLATE', e.target.value)}
                                    placeholder="Hello {{name}}, your Reading Room grace period ends on {{date}}."
                                    rows="4"
                                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                            </div>
                        </div>

                        {/* Hostel SMS */}
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>Hostel Messages</h3>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                    Warning Message (3 days before)
                                </label>
                                <textarea
                                    value={formData.SMS?.HOSTEL_WARNING_TEMPLATE || formData.SMS?.WARNING_TEMPLATE || ''}
                                    onChange={(e) => handleChange('SMS', 'HOSTEL_WARNING_TEMPLATE', e.target.value)}
                                    placeholder="Hello {{name}}, your Hostel subscription expires on {{date}}. Please pay to avoid penalties."
                                    rows="4"
                                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    Use <strong>{'{{name}}'}</strong> and <strong>{'{{date}}'}</strong> as variables.
                                </p>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                    Grace Period End Message
                                </label>
                                <textarea
                                    value={formData.SMS?.HOSTEL_GRACE_END_TEMPLATE || formData.SMS?.GRACE_END_TEMPLATE || ''}
                                    onChange={(e) => handleChange('SMS', 'HOSTEL_GRACE_END_TEMPLATE', e.target.value)}
                                    placeholder="Hello {{name}}, your Hostel grace period ends on {{date}}."
                                    rows="4"
                                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                            </div>
                        </div>
                    </div>
                </section>


                <div style={{ marginTop: '40px', display: 'flex', gap: '20px', justifyContent: 'flex-end', position: 'sticky', bottom: '20px', backgroundColor: 'white', padding: '20px', borderTop: '1px solid #eee', boxShadow: '0 -2px 10px rgba(0,0,0,0.05)' }}>
                    <Button
                        type="submit"
                        variant="primary"
                        loading={saving}
                        disabled={saving}
                        style={{ padding: '12px 40px' }}
                    >
                        <Save size={18} style={{ marginRight: '8px' }} />
                        Save Changes
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormData(JSON.parse(JSON.stringify(config)))} // Reset to current config
                        disabled={saving}
                    >
                        <RefreshCw size={18} style={{ marginRight: '8px' }} />
                        Reset
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default Settings;

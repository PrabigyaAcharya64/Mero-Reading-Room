import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import { Save, RefreshCw } from 'lucide-react';
import '../../styles/StandardLayout.css';

function Settings({ onBack }) {
    const { config, updateConfig, loading } = useConfig();


    const [formData, setFormData] = useState(() => {
        if (config) {
            return JSON.parse(JSON.stringify(config));
        }
        return null;
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (config && !formData) {
            setFormData(JSON.parse(JSON.stringify(config)));
        }
    }, [config, formData]);

    const handleChange = (category, field, value, subField = null) => {
        setFormData(prev => {
            const newData = { ...prev };
            if (!newData[category]) newData[category] = {}; // Ensure category exists

            if (subField) {
                if (!newData[category][field]) newData[category][field] = {};
                // Handle numeric vs string fields
                // SMS Templates are strings, Fees are numbers
                if (category === 'SMS') {
                    newData[category][field][subField] = value;
                } else {
                    newData[category][field][subField] = field === 'DAILY_INTEREST_RATE' ? parseFloat(value) : (parseInt(value) || 0);
                }
            } else {
                // Special handling for float values like interest rate
                if (field === 'DAILY_INTEREST_RATE') {
                    newData[category][field] = parseFloat(value) || 0;
                } else if (category === 'SMS') {
                    // SMS fields like WARNING_TEMPLATE are strings, SEND_HOUR is int
                    if (field === 'SEND_HOUR') {
                        newData[category][field] = parseInt(value) || 0;
                    } else {
                        newData[category][field] = value;
                    }
                } else {
                    newData[category][field] = parseInt(value) || 0;
                }
            }
            return newData;
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const result = await updateConfig(formData);
            if (result.success) {
                // User requested alert instead of inline message
                window.alert('Settings updated successfully!');
            } else {
                throw new Error("Update failed");
            }
        } catch (error) {
            console.error('Save error:', error);
            setMessage({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading || !formData) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="std-container" style={{ paddingBottom: '80px' }}>
            <main className="std-body">
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>

                    <form onSubmit={handleSave}>
                        {/* Reading Room Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">Reading Room Fees</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Fee</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">रु</span>
                                        <input
                                            type="number"
                                            value={formData.READING_ROOM.REGISTRATION_FEE}
                                            onChange={(e) => handleChange('READING_ROOM', 'REGISTRATION_FEE', e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Fee (Non-AC)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">रु</span>
                                        <input
                                            type="number"
                                            value={formData.READING_ROOM.MONTHLY_FEE.NON_AC}
                                            onChange={(e) => handleChange('READING_ROOM', 'MONTHLY_FEE', e.target.value, 'NON_AC')}
                                            className="w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Fee (AC)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">रु</span>
                                        <input
                                            type="number"
                                            value={formData.READING_ROOM.MONTHLY_FEE.AC}
                                            onChange={(e) => handleChange('READING_ROOM', 'MONTHLY_FEE', e.target.value, 'AC')}
                                            className="w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hostel Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">Hostel Fees</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Fee</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">रु</span>
                                        <input
                                            type="number"
                                            value={formData.HOSTEL.REGISTRATION_FEE}
                                            onChange={(e) => handleChange('HOSTEL', 'REGISTRATION_FEE', e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Refundable Deposit</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">रु</span>
                                        <input
                                            type="number"
                                            value={formData.HOSTEL.REFUNDABLE_DEPOSIT}
                                            onChange={(e) => handleChange('HOSTEL', 'REFUNDABLE_DEPOSIT', e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Wallet Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">Wallet Settings</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Load Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">रु</span>
                                        <input
                                            type="number"
                                            value={formData.WALLET.MIN_LOAD_AMOUNT}
                                            onChange={(e) => handleChange('WALLET', 'MIN_LOAD_AMOUNT', e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Loan Settings Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">Loan Settings</h2>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Loan Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">रु</span>
                                        <input
                                            type="number"
                                            value={formData.LOAN?.MAX_AMOUNT || 0}
                                            onChange={(e) => handleChange('LOAN', 'MAX_AMOUNT', e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Deadline (Days)</label>
                                    <input
                                        type="number"
                                        value={formData.LOAN?.DEADLINE_DAYS || 0}
                                        onChange={(e) => handleChange('LOAN', 'DEADLINE_DAYS', e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Daily Interest Rate (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.LOAN?.DAILY_INTEREST_RATE || 0}
                                            onChange={(e) => handleChange('LOAN', 'DAILY_INTEREST_RATE', e.target.value)}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SMS Notification Settings */}
                        {/* SMS Notification Settings */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">SMS Notifications</h2>
                            <p className="text-sm text-gray-500 mb-4">Configure automated expiry notifications sent via DICE SMS.</p>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Send Hour (0-23)</label>
                                    <div className="text-xs text-gray-500 mb-1">Hour of day to run the check (Kathmandu Time). E.g., 10 for 10 AM.</div>
                                    <input
                                        type="number"
                                        min="0"
                                        max="23"
                                        value={formData.SMS?.SEND_HOUR ?? 0}
                                        onChange={(e) => handleChange('SMS', 'SEND_HOUR', e.target.value)}
                                        className="w-full md:w-1/3 px-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>

                                {/* Reading Room Templates */}
                                <div className="border-t pt-4">
                                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Reading Room Templates</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Warning (3 Days Left)</label>
                                            <div className="text-xs text-gray-500 mb-1">Use <code>{`{{name}}`}</code> for user name and <code>{`{{date}}`}</code> for expiry date.</div>
                                            <textarea
                                                rows={2}
                                                value={formData.SMS?.RR_WARNING_TEMPLATE || formData.SMS?.WARNING_TEMPLATE || ''}
                                                onChange={(e) => handleChange('SMS', 'RR_WARNING_TEMPLATE', e.target.value)}
                                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                                placeholder="Hello {{name}}, your Reading Room plan expires on {{date}}."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period End (Expired 3 Days Ago)</label>
                                            <textarea
                                                rows={2}
                                                value={formData.SMS?.RR_GRACE_END_TEMPLATE || formData.SMS?.GRACE_END_TEMPLATE || ''}
                                                onChange={(e) => handleChange('SMS', 'RR_GRACE_END_TEMPLATE', e.target.value)}
                                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                                placeholder="Hi {{name}}, your Reading Room grace period has ended."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Hostel Templates */}
                                <div className="border-t pt-4">
                                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Hostel Templates</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Warning (3 Days Left)</label>
                                            <textarea
                                                rows={2}
                                                value={formData.SMS?.HOSTEL_WARNING_TEMPLATE || formData.SMS?.WARNING_TEMPLATE || ''}
                                                onChange={(e) => handleChange('SMS', 'HOSTEL_WARNING_TEMPLATE', e.target.value)}
                                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                                placeholder="Hello {{name}}, your Hostel plan expires on {{date}}."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period End (Expired 3 Days Ago)</label>
                                            <textarea
                                                rows={2}
                                                value={formData.SMS?.HOSTEL_GRACE_END_TEMPLATE || formData.SMS?.GRACE_END_TEMPLATE || ''}
                                                onChange={(e) => handleChange('SMS', 'HOSTEL_GRACE_END_TEMPLATE', e.target.value)}
                                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                                                placeholder="Hi {{name}}, your Hostel grace period has ended."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{
                            position: 'fixed',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            padding: '16px 24px',
                            borderTop: '1px solid #eee',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            zIndex: 100,
                            boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
                        }}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormData(JSON.parse(JSON.stringify(config)))}
                                disabled={saving}
                            >
                                <RefreshCw size={18} className="mr-2" /> Reset
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={saving}
                                disabled={saving}
                            >
                                <Save size={18} className="mr-2" /> Save Changes
                            </Button>
                        </div>
                    </form>
                </div>
            </main >
        </div >
    );
}

export default Settings;

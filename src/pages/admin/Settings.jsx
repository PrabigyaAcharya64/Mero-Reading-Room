import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import { Save, RefreshCw } from 'lucide-react';
import '../../styles/StandardLayout.css'; // Reusing standard styles

function Settings({ onBack }) {
    const { config, updateConfig, loading } = useConfig();
    const [formData, setFormData] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Load initial data when config is ready
    useEffect(() => {
        if (config) {
            setFormData(JSON.parse(JSON.stringify(config))); // Deep copy
        }
    }, [config]);

    const handleChange = (category, field, value, subField = null) => {
        setFormData(prev => {
            const newData = { ...prev };
            if (subField) {
                newData[category][field][subField] = parseInt(value) || 0;
            } else {
                newData[category][field] = parseInt(value) || 0;
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
                setMessage({ type: 'success', text: 'Settings updated successfully!' });
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

                    {message.text && (
                        <div style={{
                            marginBottom: '24px',
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: message.type === 'error' ? '#fee2e2' : '#dcfce7',
                            color: message.type === 'error' ? '#dc2626' : '#16a34a',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {message.text}
                        </div>
                    )}

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
            </main>
        </div>
    );
}

export default Settings;

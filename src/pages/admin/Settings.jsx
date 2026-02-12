import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { Save, RefreshCw } from 'lucide-react';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageTransition from '../../components/PageTransition';
import { useAdminHeader } from '../../context/AdminHeaderContext';

// Robust Default Configuration
const DEFAULT_FORM_STATE = {
    READING_ROOM: {
        REGISTRATION_FEE: 1000,
        MONTHLY_FEE: {
            NON_AC: 3500,
            AC: 3750
        }
    },
    HOSTEL: {
        REGISTRATION_FEE: 4000,
        REFUNDABLE_DEPOSIT: 5000
    },
    DISCOUNTS: {
        REFERRAL_DISCOUNT_PERCENT: 5,
        BULK_BOOKING_DISCOUNT: 10,
        BUNDLE_DISCOUNT: 500
    },
    SMS: {
        SEND_HOUR: 10,
        RR_WARNING_TEMPLATE: "Hello {{name}}, your Reading Room subscription expires on {{date}}. Please renew.",
        RR_GRACE_END_TEMPLATE: "Hello {{name}}, your Reading Room grace period ends on {{date}}.",
        HOSTEL_WARNING_TEMPLATE: "Hello {{name}}, your Hostel subscription expires on {{date}}. Please pay to avoid penalties.",
        HOSTEL_GRACE_END_TEMPLATE: "Hello {{name}}, your Hostel grace period ends on {{date}}."
    }
};

const deepMerge = (target, source) => {
    const output = { ...target };
    if (source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

function Settings({ onBack, onDataLoaded }) {
    const { config, updateConfig, loading } = useConfig();

    // 1. Initialize State with a deep copy of defaults
    const [formData, setFormData] = useState(() => JSON.parse(JSON.stringify(DEFAULT_FORM_STATE)));

    // Notify parent layout that page is ready (turns off global loader)
    useEffect(() => {
        if (onDataLoaded) {
            onDataLoaded();
        }
    }, [onDataLoaded]);

    // 2. Track if we have synced with server to prevent overwriting user edits later
    const [hasSynced, setHasSynced] = useState(false);

    const [saving, setSaving] = useState(false);
    const { setHeader } = useAdminHeader();

    // 3. Sync ONLY once when config first loads
    useEffect(() => {
        if (config && !hasSynced) {
            setFormData(prev => deepMerge(prev, config));
            setHasSynced(true);
        }
    }, [config, hasSynced]);

    // Handle Save (Moved to global header)
    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        const result = await updateConfig(formData);
        setSaving(false);
        if (result.success) {
            window.alert("Settings saved successfully!");
        } else {
            window.alert("Failed to save settings: " + result.error?.message);
        }
    };

    // Set Header Buttons
    useEffect(() => {
        setHeader({
            title: 'System Settings',
            onBack: null, // explicitly remove back button logic if any
            actionBar: (
                <div className="flex gap-4 justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormData(JSON.parse(JSON.stringify(DEFAULT_FORM_STATE)))} // Simplified reset
                        disabled={saving}
                        className="!px-6"
                    >
                        <RefreshCw size={18} className="mr-2" />
                        Reset Defaults
                    </Button>
                    <Button
                        type="button" // changed from submit since form is below
                        onClick={handleSave}
                        variant="primary"
                        loading={saving}
                        disabled={saving}
                        className="!px-8"
                    >
                        <Save size={18} className="mr-2" />
                        Save Changes
                    </Button>
                </div>
            )
        });

        // Cleanup: Remove action bar when leaving this page
        return () => {
            setHeader({ title: '', actionBar: null, rightElement: null, onBack: null });
        };
    }, [setHeader, saving, formData, handleSave]); // Depend on formData/handleSave so closure is fresh


    const handleChange = (section, key, value, subSection = null) => {
        setFormData(prev => {
            const newState = { ...prev };
            newState[section] = { ...prev[section] };

            if (subSection) {
                newState[section][subSection] = { ...(prev[section]?.[subSection] || {}) };
                newState[section][subSection][key] = value;
            } else {
                newState[section][key] = value;
            }
            return newState;
        });
    };

    // 5. BLOCKING LOADER: Only show if we have NO defaults AND we are loading
    const isBlockingLoad = loading && !config && !formData;

    if (isBlockingLoad) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <LoadingSpinner />
            </div>
        );
    }

    if (!formData) return null;

    return (
        <PageTransition>
            <div className="std-container">
                {/* PageHeader removed as requested */}

                <main className="std-body">
                    <form onSubmit={(e) => e.preventDefault()} className="max-w-4xl mx-auto space-y-8 pb-20">
                        {/* Reading Room Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                            <h2 className="text-lg font-bold mb-6 text-gray-800 border-b pb-2">
                                Reading Room Configuration
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Registration Fee (One-time)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.READING_ROOM?.REGISTRATION_FEE ?? DEFAULT_FORM_STATE.READING_ROOM.REGISTRATION_FEE}
                                        onChange={(e) => handleChange('READING_ROOM', 'REGISTRATION_FEE', Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Non-AC Monthly Fee
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.READING_ROOM?.MONTHLY_FEE?.NON_AC ?? DEFAULT_FORM_STATE.READING_ROOM.MONTHLY_FEE.NON_AC}
                                        onChange={(e) => handleChange('READING_ROOM', 'NON_AC', Number(e.target.value), 'MONTHLY_FEE')}
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        AC Monthly Fee
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.READING_ROOM?.MONTHLY_FEE?.AC ?? DEFAULT_FORM_STATE.READING_ROOM.MONTHLY_FEE.AC}
                                        onChange={(e) => handleChange('READING_ROOM', 'AC', Number(e.target.value), 'MONTHLY_FEE')}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Hostel Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                            <h2 className="text-lg font-bold mb-6 text-gray-800 border-b pb-2">
                                Hostel Configuration
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Registration Fee
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.HOSTEL?.REGISTRATION_FEE ?? DEFAULT_FORM_STATE.HOSTEL.REGISTRATION_FEE}
                                        onChange={(e) => handleChange('HOSTEL', 'REGISTRATION_FEE', Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Refundable Deposit
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.HOSTEL?.REFUNDABLE_DEPOSIT ?? DEFAULT_FORM_STATE.HOSTEL.REFUNDABLE_DEPOSIT}
                                        onChange={(e) => handleChange('HOSTEL', 'REFUNDABLE_DEPOSIT', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Discounts Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                            <h2 className="text-lg font-bold mb-6 text-gray-800 border-b pb-2">
                                Discounts & Loyalty
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Referral Discount (%)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.DISCOUNTS?.REFERRAL_DISCOUNT_PERCENT ?? DEFAULT_FORM_STATE.DISCOUNTS.REFERRAL_DISCOUNT_PERCENT}
                                        onChange={(e) => handleChange('DISCOUNTS', 'REFERRAL_DISCOUNT_PERCENT', Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Bulk Booking Discount (%)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.DISCOUNTS?.BULK_BOOKING_DISCOUNT ?? DEFAULT_FORM_STATE.DISCOUNTS.BULK_BOOKING_DISCOUNT}
                                        onChange={(e) => handleChange('DISCOUNTS', 'BULK_BOOKING_DISCOUNT', Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-700">
                                        Bundle Discount (Flat Amount)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.DISCOUNTS?.BUNDLE_DISCOUNT ?? DEFAULT_FORM_STATE.DISCOUNTS.BUNDLE_DISCOUNT}
                                        onChange={(e) => handleChange('DISCOUNTS', 'BUNDLE_DISCOUNT', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SMS Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                            <h2 className="text-lg font-bold mb-6 text-gray-800 border-b pb-2">
                                SMS Notifications
                            </h2>

                            <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <label className="block mb-2 text-sm font-medium text-gray-700">
                                    Daily Send Hour (0-23)
                                </label>
                                <input
                                    type="number"
                                    min="0" max="23"
                                    className="w-32 p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.SMS?.SEND_HOUR ?? DEFAULT_FORM_STATE.SMS.SEND_HOUR}
                                    onChange={(e) => handleChange('SMS', 'SEND_HOUR', Number(e.target.value))}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Hour of the day to send automated expiry warnings (Kathmandu Time)
                                </p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Reading Room SMS */}
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                        Reading Room Messages
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block mb-2 text-sm font-medium text-gray-700">
                                                Warning Message (3 days before)
                                            </label>
                                            <textarea
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                value={formData.SMS?.RR_WARNING_TEMPLATE ?? formData.SMS?.WARNING_TEMPLATE ?? DEFAULT_FORM_STATE.SMS.RR_WARNING_TEMPLATE}
                                                onChange={(e) => handleChange('SMS', 'RR_WARNING_TEMPLATE', e.target.value)}
                                                rows="4"
                                            />
                                            <p className="mt-1 text-xs text-gray-500">
                                                Use <strong>{'{{name}}'}</strong> and <strong>{'{{date}}'}</strong> as variables.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block mb-2 text-sm font-medium text-gray-700">
                                                Grace Period End Message
                                            </label>
                                            <textarea
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                value={formData.SMS?.RR_GRACE_END_TEMPLATE ?? formData.SMS?.GRACE_END_TEMPLATE ?? DEFAULT_FORM_STATE.SMS.RR_GRACE_END_TEMPLATE}
                                                onChange={(e) => handleChange('SMS', 'RR_GRACE_END_TEMPLATE', e.target.value)}
                                                rows="4"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Hostel SMS */}
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                        Hostel Messages
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block mb-2 text-sm font-medium text-gray-700">
                                                Warning Message (3 days before)
                                            </label>
                                            <textarea
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                value={formData.SMS?.HOSTEL_WARNING_TEMPLATE ?? formData.SMS?.WARNING_TEMPLATE ?? DEFAULT_FORM_STATE.SMS.HOSTEL_WARNING_TEMPLATE}
                                                onChange={(e) => handleChange('SMS', 'HOSTEL_WARNING_TEMPLATE', e.target.value)}
                                                rows="4"
                                            />
                                            <p className="mt-1 text-xs text-gray-500">
                                                Use <strong>{'{{name}}'}</strong> and <strong>{'{{date}}'}</strong> as variables.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block mb-2 text-sm font-medium text-gray-700">
                                                Grace Period End Message
                                            </label>
                                            <textarea
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                value={formData.SMS?.HOSTEL_GRACE_END_TEMPLATE ?? formData.SMS?.GRACE_END_TEMPLATE ?? DEFAULT_FORM_STATE.SMS.HOSTEL_GRACE_END_TEMPLATE}
                                                onChange={(e) => handleChange('SMS', 'HOSTEL_GRACE_END_TEMPLATE', e.target.value)}
                                                rows="4"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Buttons removed from bottom */}
                    </form>
                </main>
            </div>
        </PageTransition>
    );
}

export default Settings;

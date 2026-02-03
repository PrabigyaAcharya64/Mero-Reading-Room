
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, collection, addDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore'; // Import writeBatch
import { useLoading } from '../../context/GlobalLoadingContext';
import { Trash2, Plus, Save, Search, Check } from 'lucide-react'; // Add icons
import '../../styles/StandardLayout.css';

const DiscountManagement = ({ onDataLoaded }) => {
    const { setIsLoading } = useLoading();
    const [activeTab, setActiveTab] = useState('settings');

    // Settings State
    const [settings, setSettings] = useState({
        REFERRAL_PERCENT: 5,
        BULK_PERCENT: 10,
        BUNDLE_FIXED: 500,
        LOYALTY_THRESHOLD: 50
    });

    // Coupons State
    const [coupons, setCoupons] = useState([]);
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [newCoupon, setNewCoupon] = useState({
        code: '',
        type: 'percentage', // percentage | flat
        value: 10,
        minAmount: 0,
        expiryDate: '',
        usageLimit: 0,
        stackable: false,
        applicableServices: [], // Admin must select
        targetType: 'all', // all | specific
        allowedUsers: [] // Array of user IDs
    });

    // User Selection State
    const [availableUsers, setAvailableUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);

    // Initial Load
    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const docRef = doc(db, 'settings', 'discounts');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }
            } catch (err) {
                console.error("Error loading settings:", err);
            } finally {
                setIsLoading(false);
                if (onDataLoaded) onDataLoaded();
            }
        };

        const fetchCoupons = () => {
            const q = query(collection(db, 'coupons'), orderBy('code'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCoupons(list);
            });
            return unsubscribe;
        };

        // Fetch Users for selection
        const fetchUsers = () => {
            const q = query(collection(db, 'users'), orderBy('name'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const users = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setAvailableUsers(users);
                setFilteredUsers(users);
            });
            return unsubscribe;
        };

        fetchSettings();
        const unsubCoupons = fetchCoupons();
        const unsubUsers = fetchUsers();

        return () => {
            unsubCoupons();
            unsubUsers();
        };
    }, [setIsLoading, onDataLoaded]);

    // Filter users when search changes
    useEffect(() => {
        if (!userSearch) {
            setFilteredUsers(availableUsers);
        } else {
            const lower = userSearch.toLowerCase();
            const filtered = availableUsers.filter(u =>
                (u.name && u.name.toLowerCase().includes(lower)) ||
                (u.mrrNumber && u.mrrNumber.toLowerCase().includes(lower)) ||
                (u.email && u.email.toLowerCase().includes(lower))
            );
            setFilteredUsers(filtered);
        }
    }, [userSearch, availableUsers]);

    // Handle Settings Save
    const handleSaveSettings = async () => {
        setIsLoading(true);
        try {
            await setDoc(doc(db, 'settings', 'discounts'), settings);
            alert('Settings saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to save settings.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Coupon Create
    const handleCreateCoupon = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const couponRef = doc(collection(db, 'coupons'));

            const couponData = {
                ...newCoupon,
                createdAt: new Date().toISOString(),
                usedCount: 0
            };

            // Remove allowedUsers if targetType is all
            if (newCoupon.targetType === 'all') {
                delete couponData.allowedUsers;
            }

            batch.set(couponRef, couponData);

            // Create Notifications for specific users
            if (newCoupon.targetType === 'specific' && newCoupon.allowedUsers.length > 0) {
                const now = new Date().toISOString();
                newCoupon.allowedUsers.forEach(userId => {
                    const notifRef = doc(collection(db, 'notifications'));
                    batch.set(notifRef, {
                        userId: userId,
                        title: 'New Coupon Available!',
                        message: `You've received a ${newCoupon.type === 'percentage' ? newCoupon.value + '%' : 'Rs ' + newCoupon.value} discount coupon: ${newCoupon.code}`,
                        type: 'coupon',
                        relatedId: newCoupon.code,
                        read: false,
                        createdAt: now
                    });
                });
            }

            await batch.commit();

            setShowCouponModal(false);
            setNewCoupon({
                code: '',
                type: 'percentage',
                value: 10,
                minAmount: 0,
                expiryDate: '',
                usageLimit: 0,
                stackable: false,
                applicableServices: [],
                targetType: 'all',
                allowedUsers: []
            });
            alert('Coupon created and users notified!');
        } catch (err) {
            console.error(err);
            alert('Error creating coupon.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Coupon Delete
    const handleDeleteCoupon = async (id) => {
        if (!window.confirm('Are you sure you want to delete this coupon?')) return;
        try {
            await deleteDoc(doc(db, 'coupons', id));
        } catch (err) {
            console.error(err);
            alert('Error deleting coupon.');
        }
    };

    return (
        <div className="std-container">


            <main className="std-body">
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                    <button
                        onClick={() => setActiveTab('settings')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: activeTab === 'settings' ? '#000' : 'transparent',
                            color: activeTab === 'settings' ? '#fff' : '#000',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        General Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('coupons')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: activeTab === 'coupons' ? '#000' : 'transparent',
                            color: activeTab === 'coupons' ? '#fff' : '#000',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Manage Coupons
                    </button>
                </div>

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div className="card" style={{ maxWidth: '600px', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
                        <h3>Automated Discount Configuration</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Referral Discount (%)</label>
                                <input
                                    type="number"
                                    value={settings.REFERRAL_PERCENT}
                                    onChange={(e) => setSettings({ ...settings, REFERRAL_PERCENT: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Bulk Booking Discount (6+ Months) (%)</label>
                                <input
                                    type="number"
                                    value={settings.BULK_PERCENT}
                                    onChange={(e) => setSettings({ ...settings, BULK_PERCENT: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Bundle Discount (Fixed Amount)</label>
                                <input
                                    type="number"
                                    value={settings.BUNDLE_FIXED}
                                    onChange={(e) => setSettings({ ...settings, BUNDLE_FIXED: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Loyalty Threshold (Meals)</label>
                                <input
                                    type="number"
                                    value={settings.LOYALTY_THRESHOLD}
                                    onChange={(e) => setSettings({ ...settings, LOYALTY_THRESHOLD: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                            </div>

                            <button
                                onClick={handleSaveSettings}
                                className="btn btn-black"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '10px' }}
                            >
                                <Save size={18} /> Save Settings
                            </button>
                        </div>
                    </div>
                )}

                {/* Coupons Tab */}
                {activeTab === 'coupons' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                            <button
                                className="btn btn-black"
                                onClick={() => setShowCouponModal(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Plus size={18} /> New Coupon
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                            {coupons.map(coupon => (
                                <div key={coupon.id} style={{ padding: '15px', border: '1px solid #eee', borderRadius: '8px', position: 'relative', backgroundColor: 'white' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 5px 0', fontSize: '18px', fontFamily: 'monospace' }}>{coupon.code}</h4>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                backgroundColor: '#f3f4f6',
                                                fontSize: '12px',
                                                marginBottom: '10px'
                                            }}>
                                                {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `Rs. ${coupon.value} OFF`}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteCoupon(coupon.id)}
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                                        {coupon.minAmount > 0 && <div>Min Spend: Rs. {coupon.minAmount}</div>}
                                        {coupon.expiryDate && <div>Expires: {new Date(coupon.expiryDate).toLocaleDateString()}</div>}
                                        <div>Usage: {coupon.usedCount} / {coupon.usageLimit || '∞'}</div>
                                        <div>Stackable: {coupon.stackable ? 'Yes' : 'No'}</div>
                                        <div style={{ marginTop: '5px' }}>
                                            {coupon.applicableServices?.map(s => (
                                                <span key={s} style={{ marginRight: '5px', fontSize: '11px', border: '1px solid #ddd', padding: '1px 4px', borderRadius: '3px' }}>
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {coupons.length === 0 && (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#999' }}>
                                    No coupons created yet.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Create Coupon Modal */}
            {showCouponModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ marginTop: 0 }}>Create Coupon</h2>

                        <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>Code *</label>
                                <input required type="text" value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} placeholder="e.g. SUMMER2024" />
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>Type</label>
                                    <select value={newCoupon.type} onChange={e => setNewCoupon({ ...newCoupon, type: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="flat">Flat Amount (Rs)</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>Value ({newCoupon.type === 'percentage' ? '%' : 'Rs'}) *</label>
                                    <input required type="number" value={newCoupon.value} onChange={e => setNewCoupon({ ...newCoupon, value: e.target.value === '' ? '' : parseFloat(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>Expiry Date</label>
                                <input type="datetime-local" value={newCoupon.expiryDate} onChange={e => setNewCoupon({ ...newCoupon, expiryDate: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>Min Spend (Rs)</label>
                                    <input type="number" value={newCoupon.minAmount} onChange={e => setNewCoupon({ ...newCoupon, minAmount: e.target.value === '' ? '' : parseFloat(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px' }}>Usage Limit (0 = ∞)</label>
                                    <input type="number" value={newCoupon.usageLimit} onChange={e => setNewCoupon({ ...newCoupon, usageLimit: e.target.value === '' ? '' : parseInt(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer', marginBottom: '15px' }}>
                                    <input type="checkbox" checked={newCoupon.stackable} onChange={e => setNewCoupon({ ...newCoupon, stackable: e.target.checked })} />
                                    <span>Stackable (Can combine with other discounts)</span>
                                </label>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>Applicable Services *</label>
                                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                    {[
                                        { id: 'readingRoom', label: 'Reading Room' },
                                        { id: 'hostel', label: 'Hostel' },
                                        { id: 'canteen', label: 'Canteen' }
                                    ].map(service => (
                                        <label key={service.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={newCoupon.applicableServices.includes(service.id)}
                                                onChange={(e) => {
                                                    const current = newCoupon.applicableServices;
                                                    let updated;
                                                    if (e.target.checked) {
                                                        updated = [...current, service.id];
                                                    } else {
                                                        updated = current.filter(id => id !== service.id);
                                                    }
                                                    setNewCoupon({ ...newCoupon, applicableServices: updated });
                                                }}
                                            />
                                            {service.label}
                                        </label>
                                    ))}
                                </div>
                                {newCoupon.applicableServices.length === 0 && (
                                    <p style={{ color: 'red', fontSize: '11px', marginTop: '4px' }}>Please select at least one service.</p>
                                )}
                            </div>

                            {/* Target Audience Section */}
                            <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>Target Audience</label>
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="targetType"
                                            value="all"
                                            checked={newCoupon.targetType === 'all'}
                                            onChange={() => setNewCoupon({ ...newCoupon, targetType: 'all', allowedUsers: [] })}
                                        />
                                        Everyone
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="targetType"
                                            value="specific"
                                            checked={newCoupon.targetType === 'specific'}
                                            onChange={() => setNewCoupon({ ...newCoupon, targetType: 'specific' })}
                                        />
                                        Specific Users
                                    </label>
                                </div>

                                {newCoupon.targetType === 'specific' && (
                                    <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                                        <div style={{ position: 'relative', marginBottom: '10px' }}>
                                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                                            <input
                                                type="text"
                                                placeholder="Search users..."
                                                value={userSearch}
                                                onChange={(e) => setUserSearch(e.target.value)}
                                                style={{ width: '100%', padding: '8px 8px 8px 32px', borderRadius: '4px', border: '1px solid #ddd' }}
                                            />
                                        </div>

                                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px', backgroundColor: 'white' }}>
                                            {filteredUsers.map(user => {
                                                const isSelected = newCoupon.allowedUsers.includes(user.id);
                                                return (
                                                    <div
                                                        key={user.id}
                                                        onClick={() => {
                                                            const current = newCoupon.allowedUsers;
                                                            let updated;
                                                            if (isSelected) {
                                                                updated = current.filter(id => id !== user.id);
                                                            } else {
                                                                updated = [...current, user.id];
                                                            }
                                                            setNewCoupon({ ...newCoupon, allowedUsers: updated });
                                                        }}
                                                        style={{
                                                            padding: '8px 12px',
                                                            borderBottom: '1px solid #f5f5f5',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            backgroundColor: isSelected ? '#f0f9ff' : 'white'
                                                        }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: '500' }}>{user.name || 'Unknown'}</div>
                                                            <div style={{ fontSize: '11px', color: '#666' }}>{user.mrrNumber || user.email}</div>
                                                        </div>
                                                        {isSelected && <Check size={16} color="#0284c7" />}
                                                    </div>
                                                );
                                            })}
                                            {filteredUsers.length === 0 && (
                                                <div style={{ padding: '15px', textAlign: 'center', fontSize: '12px', color: '#888' }}>
                                                    No users found.
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px', textAlign: 'right' }}>
                                            {newCoupon.allowedUsers.length} user(s) selected
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <button type="button" onClick={() => setShowCouponModal(false)} className="btn btn-outline">Cancel</button>
                                <button type="submit" className="btn btn-black">Create Coupon</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiscountManagement;

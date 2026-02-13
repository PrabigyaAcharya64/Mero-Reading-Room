import React, { useState, useEffect } from 'react';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp,
    query,
    orderBy,
    where
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../auth/AuthProvider';
import {
    Plus,
    Trash2,
    Edit3,
    Check,
    X,
    Search,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    Lock,
    ChevronLeft
} from 'lucide-react';
import { useLoading } from '../../../context/GlobalLoadingContext';
import '../../../styles/AdminBalanceLoad.css'; // Reusing existing styles for consistency

const EXPENSE_CATEGORIES = [
    'Electricity',
    'Repairs & Maintenance',
    'Salaries',
    'Rent',
    'Supplies',
    'Utilities',
    'Marketing',
    'Other'
];

const EARNING_CATEGORIES = [
    'Hostel',
    'Reading Room',
    'Canteen',
    'Grants',
    'Donations',
    'Investments',
    'Other'
];

export default function ExpenseEarningManagement({ onDataLoaded }) {
    const { user } = useAuth();
    const { setIsLoading } = useLoading();
    const [activeTab, setActiveTab] = useState('expense'); // 'expense' or 'earning'
    const [items, setItems] = useState([]);
    // Removed local loading state to rely on global loader for transitions
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: ''
    });

    // Form State
    const [formData, setFormData] = useState({
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Initialize default category when tab changes
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            category: activeTab === 'expense' ? EXPENSE_CATEGORIES[0] : EARNING_CATEGORIES[0]
        }));
    }, [activeTab]);

    // Fetch Data based on Active Tab
    useEffect(() => {
        // Trigger global loading on tab change
        setIsLoading(true);

        const unsubscribers = [];

        if (activeTab === 'expense') {
            // 1. Manual Expenses
            const manualsQ = query(collection(db, 'manual_expenses'), orderBy('date', 'desc'));
            // 2. Inventory Assignments (System Expenses)
            const inventoryQ = query(collection(db, 'inventory_purchases'), orderBy('purchaseDate', 'desc'));

            // Combine logic
            let manuals = [];
            let inventory = [];

            const updateExpenses = () => {
                const combined = [
                    ...manuals.map(m => ({ ...m, type: 'manual', isSystem: false })),
                    ...inventory.map(i => ({
                        id: i.id,
                        category: 'Inventory',
                        description: `Purchase: ${i.itemName}`,
                        amount: i.totalCost || (i.quantity * i.unitPrice) || 0,
                        date: i.purchaseDate?.toDate?.() || new Date(i.purchaseDate || i.createdAt),
                        type: 'system',
                        isSystem: true
                    }))
                ].sort((a, b) => b.date - a.date);

                setItems(combined);
                setIsLoading(false);
                onDataLoaded?.();
            };

            const unsubManual = onSnapshot(manualsQ, (snapshot) => {
                manuals = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt || doc.data().date)
                }));
                updateExpenses();
            });
            unsubscribers.push(unsubManual);

            const unsubInventory = onSnapshot(inventoryQ, (snapshot) => {
                inventory = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                updateExpenses();
            });
            unsubscribers.push(unsubInventory);

        } else {
            // EARNINGS
            // 1. Manual Earnings
            const manualsQ = query(collection(db, 'manual_earnings'), orderBy('date', 'desc'));
            // 2. Transactions (Hostel + Reading Room)
            const txnsQ = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
            // 3. Orders (Canteen)
            const ordersQ = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

            let manuals = [];
            let txns = [];
            let orders = [];

            const updateEarnings = () => {
                const combined = [
                    ...manuals.map(m => ({ ...m, type: 'manual', isSystem: false })),
                    ...txns
                        .filter(t => ['hostel', 'hostel_renewal', 'reading_room', 'reading_room_renewal'].includes(t.type))
                        .map(t => ({
                            id: t.id,
                            category: (t.type === 'hostel' || t.type === 'hostel_renewal') ? 'Hostel' : 'Reading Room',
                            description: (t.type === 'hostel' || t.type === 'hostel_renewal') ? 'App Hostel Payment' : 'App Reading Room Payment',
                            amount: t.amount || 0,
                            date: t.createdAt?.toDate?.() || new Date(t.createdAt || t.date),
                            type: 'system',
                            isSystem: true
                        })),
                    ...orders
                        .filter(o => o.status === 'completed' || o.status === 'success')
                        .map(o => ({
                            id: o.id,
                            category: 'Canteen',
                            description: 'App Canteen Payment',
                            amount: o.total || o.amount || 0,
                            date: o.createdAt?.toDate?.() || new Date(o.createdAt),
                            type: 'system',
                            isSystem: true
                        }))
                ].sort((a, b) => b.date - a.date);

                setItems(combined);
                setIsLoading(false);
                onDataLoaded?.();
            };

            const unsubManual = onSnapshot(manualsQ, (snapshot) => {
                manuals = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: doc.data().date?.toDate?.() || new Date(doc.data().date)
                }));
                updateEarnings();
            });
            unsubscribers.push(unsubManual);

            const unsubTxns = onSnapshot(txnsQ, (snapshot) => {
                txns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateEarnings();
            });
            unsubscribers.push(unsubTxns);

            const unsubOrders = onSnapshot(ordersQ, (snapshot) => {
                orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateEarnings();
            });
            unsubscribers.push(unsubOrders);
        }

        return () => unsubscribers.forEach(u => u());
    }, [activeTab, onDataLoaded, setIsLoading]); // Depend only on activeTab

    const resetForm = () => {
        setFormData({
            category: activeTab === 'expense' ? EXPENSE_CATEGORIES[0] : EARNING_CATEGORIES[0],
            description: '',
            amount: '',
            date: new Date().toISOString().split('T')[0]
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const collectionName = activeTab === 'expense' ? 'manual_expenses' : 'manual_earnings';

        const data = {
            category: formData.category,
            description: formData.description,
            amount: Number(formData.amount),
            date: new Date(formData.date),
            type: activeTab, // informative
            updatedAt: serverTimestamp()
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, collectionName, editingId), data);
            } else {
                await addDoc(collection(db, collectionName), {
                    ...data,
                    createdAt: serverTimestamp(),
                    createdBy: user?.uid || 'admin'
                });
            }
            resetForm();
        } catch (error) {
            console.error(`Error saving ${activeTab}:`, error);
            alert(`Error saving ${activeTab}. Please try again.`);
        }
    };

    const handleEdit = (item) => {
        if (item.isSystem) return; // Prevent editing system entries
        setFormData({
            category: item.category,
            description: item.description || '',
            amount: item.amount.toString(),
            date: item.date.toISOString().split('T')[0]
        });
        setEditingId(item.id);
        setShowForm(true);
    };

    const handleDelete = async (item) => {
        if (item.isSystem) {
            alert("System entries cannot be deleted from here. Please manage them in their respective sections (Hostel/Canteen/etc).");
            return;
        }
        if (window.confirm(`Are you sure you want to delete this ${activeTab}?`)) {
            try {
                const collectionName = activeTab === 'expense' ? 'manual_expenses' : 'manual_earnings';
                await deleteDoc(doc(db, collectionName, item.id));
            } catch (error) {
                console.error(`Error deleting ${activeTab}:`, error);
            }
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const filteredItems = items.filter(item => {
        if (!dateRange.startDate && !dateRange.endDate) return true;

        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);

        const start = dateRange.startDate ? new Date(dateRange.startDate) : null;
        if (start) start.setHours(0, 0, 0, 0);

        const end = dateRange.endDate ? new Date(dateRange.endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;

        return true;
    });

    return (
        <div className="abl-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header & Tabs */}
            <div style={{ marginBottom: '24px' }}>
                <a href="/admin/account-dashboard" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#6b7280',
                    textDecoration: 'none',
                    fontWeight: 500,
                    marginBottom: '16px',
                    fontSize: '14px'
                }}>
                    <ChevronLeft size={16} />
                    Back to Dashboard
                </a>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="abl-tabs">
                        <button
                            className={`abl-tab-btn ${activeTab === 'expense' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('expense'); setShowForm(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <TrendingDown size={16} />
                            Expenses
                        </button>
                        <button
                            className={`abl-tab-btn ${activeTab === 'earning' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('earning'); setShowForm(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <TrendingUp size={16} />
                            Earnings
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {/* Date Range Picker instead of Search */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '4px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>From:</span>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                style={{ border: 'none', fontSize: '13px', color: '#374151', outline: 'none' }}
                            />
                            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>To:</span>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                style={{ border: 'none', fontSize: '13px', color: '#374151', outline: 'none' }}
                            />
                            {(dateRange.startDate || dateRange.endDate) && (
                                <button
                                    onClick={() => setDateRange({ startDate: '', endDate: '' })}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    title="Clear Filter"
                                >
                                    <X size={14} color="#9ca3af" />
                                </button>
                            )}
                        </div>
                        <button
                            className="expense-btn primary"
                            onClick={() => setShowForm(true)}
                            style={{
                                backgroundColor: '#111827',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 16px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: 500
                            }}
                        >
                            <Plus size={18} />
                            Add {activeTab === 'expense' ? 'Expense' : 'Earning'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <>
                    <div className="expense-modal-overlay" onClick={resetForm} style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(4px)'
                    }}></div>
                    <div className="expense-modal" style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        background: 'white', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '500px', zIndex: 1001,
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                {editingId ? 'Edit' : 'Add'} {activeTab === 'expense' ? 'Expense' : 'Earning'}
                            </h2>
                            <button onClick={resetForm} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                <X size={20} color="#6b7280" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="expense-form-group">
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Category</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                    required
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                >
                                    {(activeTab === 'expense' ? EXPENSE_CATEGORIES : EARNING_CATEGORIES).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="expense-form-group">
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Amount (रु)</label>
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        required
                                        min="0"
                                        placeholder="0"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                    />
                                </div>
                                <div className="expense-form-group">
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                        required
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                    />
                                </div>
                            </div>

                            <div className="expense-form-group">
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Optional description"
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                                <button type="button" onClick={resetForm} style={{
                                    padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer'
                                }}>Cancel</button>
                                <button type="submit" style={{
                                    padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#111827', color: 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}>
                                    <Check size={16} />
                                    {editingId ? 'Update' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* Data Table */}
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <tr>
                            <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Date</th>
                            <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Category</th>
                            <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Description</th>
                            <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                            <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Loading state is now handled globally, so we can just show list or empty state */}
                        {filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '32px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                                        <DollarSign size={24} />
                                        <p>No {activeTab}s found.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((item) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '16px', fontSize: '14px', color: '#374151' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar size={14} className="text-gray-400" />
                                            {formatDate(item.date)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px', fontSize: '14px', color: '#111827', fontWeight: 500 }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '12px',
                                            background: item.isSystem ? '#dbeafe' : '#f3f4f6',
                                            fontSize: '12px',
                                            color: item.isSystem ? '#1e40af' : '#374151',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            {item.category}

                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', fontSize: '14px', color: '#6b7280' }}>
                                        {item.description || '-'}
                                    </td>
                                    <td style={{ padding: '16px', fontSize: '14px', color: activeTab === 'expense' ? '#ef4444' : '#10b981', fontWeight: 600, textAlign: 'right' }}>
                                        {activeTab === 'expense' ? '-' : '+'} रु {item.amount.toLocaleString()}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        {item.isSystem ? (
                                            <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>System Generated</span>
                                        ) : (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
                                                    title="Edit"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

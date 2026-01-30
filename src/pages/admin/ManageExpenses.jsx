import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit3, Check, Calendar, DollarSign } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../auth/AuthProvider';

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

export default function ManageExpenses({ onClose }) {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        category: 'Electricity',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Fetch expenses
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'manual_expenses'), (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate?.() || new Date(doc.data().date)
            }));
            // Sort by date descending
            items.sort((a, b) => b.date - a.date);
            setExpenses(items);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setFormData({
            category: 'Electricity',
            description: '',
            amount: '',
            date: new Date().toISOString().split('T')[0]
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const data = {
            category: formData.category,
            description: formData.description,
            amount: Number(formData.amount),
            date: new Date(formData.date),
            updatedAt: serverTimestamp()
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'manual_expenses', editingId), data);
            } else {
                await addDoc(collection(db, 'manual_expenses'), {
                    ...data,
                    createdAt: serverTimestamp(),
                    createdBy: user?.uid || 'admin'
                });
            }
            resetForm();
        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Error saving expense. Please try again.');
        }
    };

    const handleEdit = (expense) => {
        setFormData({
            category: expense.category,
            description: expense.description || '',
            amount: expense.amount.toString(),
            date: expense.date.toISOString().split('T')[0]
        });
        setEditingId(expense.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            try {
                await deleteDoc(doc(db, 'manual_expenses', id));
            } catch (error) {
                console.error('Error deleting expense:', error);
            }
        }
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getCategoryColor = (category) => {
        const colors = {
            'Electricity': '#f59e0b',
            'Repairs & Maintenance': '#ef4444',
            'Salaries': '#8b5cf6',
            'Rent': '#3b82f6',
            'Supplies': '#10b981',
            'Utilities': '#06b6d4',
            'Marketing': '#ec4899',
            'Other': '#6b7280'
        };
        return colors[category] || '#6b7280';
    };

    return (
        <>
            <div className="expense-modal-overlay" onClick={onClose}></div>
            <div className="expense-modal">
                <div className="expense-modal-header">
                    <h2>Manage Expenses</h2>
                    <button className="expense-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="expense-modal-content">
                    {/* Add New Expense Button */}
                    {!showForm && (
                        <button className="add-expense-btn" onClick={() => setShowForm(true)}>
                            <Plus size={18} />
                            Add New Expense
                        </button>
                    )}

                    {/* Add/Edit Form */}
                    {showForm && (
                        <form className="expense-form" onSubmit={handleSubmit}>
                            <div className="expense-form-row">
                                <div className="expense-form-group">
                                    <label>Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                        required
                                    >
                                        {EXPENSE_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="expense-form-group">
                                    <label>Amount (रु)</label>
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        required
                                        min="1"
                                        placeholder="Enter amount"
                                    />
                                </div>
                            </div>

                            <div className="expense-form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Optional description"
                                />
                            </div>

                            <div className="expense-form-group">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="expense-form-actions">
                                <button type="button" className="expense-btn secondary" onClick={resetForm}>
                                    Cancel
                                </button>
                                <button type="submit" className="expense-btn primary">
                                    <Check size={16} />
                                    {editingId ? 'Update' : 'Add'} Expense
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Expenses List */}
                    <div className="expenses-list">
                        <h3 className="expenses-list-title">Recent Expenses</h3>
                        {loading ? (
                            <div className="expenses-loading">Loading...</div>
                        ) : expenses.length === 0 ? (
                            <div className="expenses-empty">
                                <DollarSign size={32} />
                                <p>No expenses recorded yet</p>
                                <p className="expenses-empty-hint">Click "Add New Expense" to get started</p>
                            </div>
                        ) : (
                            <div className="expenses-items">
                                {expenses.map(expense => (
                                    <div key={expense.id} className="expense-item">
                                        <div className="expense-item-left">
                                            <div
                                                className="expense-item-dot"
                                                style={{ backgroundColor: getCategoryColor(expense.category) }}
                                            ></div>
                                            <div className="expense-item-info">
                                                <span className="expense-item-category">{expense.category}</span>
                                                {expense.description && (
                                                    <span className="expense-item-desc">{expense.description}</span>
                                                )}
                                                <span className="expense-item-date">{formatDate(expense.date)}</span>
                                            </div>
                                        </div>
                                        <div className="expense-item-right">
                                            <span className="expense-item-amount">रु {expense.amount.toLocaleString()}</span>
                                            <div className="expense-item-actions">
                                                <button onClick={() => handleEdit(expense)} title="Edit">
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(expense.id)} title="Delete" className="delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .expense-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    z-index: 1000;
                }
                
                .expense-modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border-radius: 16px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 85vh;
                    overflow: hidden;
                    z-index: 1001;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                }
                
                .expense-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .expense-modal-header h2 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #111827;
                }
                
                .expense-modal-close {
                    background: none;
                    border: none;
                    color: #6b7280;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 6px;
                    transition: background 0.2s;
                }
                
                .expense-modal-close:hover {
                    background: #f3f4f6;
                    color: #111827;
                }
                
                .expense-modal-content {
                    padding: 24px;
                    overflow-y: auto;
                    flex: 1;
                }
                
                .add-expense-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    width: 100%;
                    padding: 14px;
                    background: #f9fafb;
                    border: 2px dashed #d1d5db;
                    border-radius: 12px;
                    color: #6b7280;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 20px;
                }
                
                .add-expense-btn:hover {
                    border-color: #111827;
                    color: #111827;
                    background: #f3f4f6;
                }
                
                .expense-form {
                    background: #f9fafb;
                    padding: 20px;
                    border-radius: 12px;
                    margin-bottom: 20px;
                }
                
                .expense-form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                
                .expense-form-group {
                    margin-bottom: 16px;
                }
                
                .expense-form-group label {
                    display: block;
                    font-size: 13px;
                    font-weight: 500;
                    color: #374151;
                    margin-bottom: 6px;
                }
                
                .expense-form-group input,
                .expense-form-group select {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 14px;
                    color: #111827;
                    background: white;
                    transition: border-color 0.2s;
                }
                
                .expense-form-group input:focus,
                .expense-form-group select:focus {
                    outline: none;
                    border-color: #111827;
                }
                
                .expense-form-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 8px;
                }
                
                .expense-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .expense-btn.primary {
                    background: #111827;
                    color: white;
                    border: none;
                }
                
                .expense-btn.primary:hover {
                    background: #374151;
                }
                
                .expense-btn.secondary {
                    background: white;
                    color: #6b7280;
                    border: 1px solid #d1d5db;
                }
                
                .expense-btn.secondary:hover {
                    background: #f9fafb;
                    color: #111827;
                }
                
                .expenses-list-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #111827;
                    margin: 0 0 12px 0;
                }
                
                .expenses-loading,
                .expenses-empty {
                    text-align: center;
                    padding: 32px;
                    color: #9ca3af;
                }
                
                .expenses-empty svg {
                    opacity: 0.5;
                    margin-bottom: 8px;
                }
                
                .expenses-empty p {
                    margin: 0;
                    font-size: 14px;
                }
                
                .expenses-empty-hint {
                    font-size: 13px !important;
                    margin-top: 4px !important;
                }
                
                .expenses-items {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .expense-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 14px 16px;
                    background: #f9fafb;
                    border-radius: 10px;
                    transition: background 0.2s;
                }
                
                .expense-item:hover {
                    background: #f3f4f6;
                }
                
                .expense-item-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .expense-item-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                
                .expense-item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .expense-item-category {
                    font-size: 14px;
                    font-weight: 500;
                    color: #111827;
                }
                
                .expense-item-desc {
                    font-size: 12px;
                    color: #6b7280;
                }
                
                .expense-item-date {
                    font-size: 11px;
                    color: #9ca3af;
                }
                
                .expense-item-right {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                
                .expense-item-amount {
                    font-size: 14px;
                    font-weight: 600;
                    color: #ef4444;
                }
                
                .expense-item-actions {
                    display: flex;
                    gap: 4px;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                
                .expense-item:hover .expense-item-actions {
                    opacity: 1;
                }
                
                .expense-item-actions button {
                    background: none;
                    border: none;
                    padding: 6px;
                    border-radius: 6px;
                    color: #6b7280;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .expense-item-actions button:hover {
                    background: white;
                    color: #111827;
                }
                
                .expense-item-actions button.delete:hover {
                    background: #fef2f2;
                    color: #dc2626;
                }
                
                @media (max-width: 640px) {
                    .expense-form-row {
                        grid-template-columns: 1fr;
                    }
                    
                    .expense-item-actions {
                        opacity: 1;
                    }
                }
            `}</style>
        </>
    );
}

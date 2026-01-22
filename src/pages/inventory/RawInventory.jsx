import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, increment, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import '../../styles/RawInventory.css';

const RawInventory = ({ onBack }) => {
    const [inventoryItems, setInventoryItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState({
        itemName: '',
        currentQty: '',
        unitPrice: '',
        lowStockThreshold: '5'
    });

    useEffect(() => {
        const q = query(collection(db, 'raw_materials'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInventoryItems(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleConsume = async (id, currentQty) => {
        if (currentQty <= 0) return;

        try {
            const itemRef = doc(db, 'raw_materials', id);
            await updateDoc(itemRef, {
                currentQty: increment(-1)
            });
        } catch (error) {
            console.error("Error updating stock:", error);
        }
    };

    const handleDelete = async (id, itemName) => {
        if (window.confirm(`Are you sure you want to delete "${itemName}"? This cannot be undone.`)) {
            try {
                await deleteDoc(doc(db, 'raw_materials', id));
            } catch (error) {
                console.error("Error deleting item:", error);
            }
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, 'raw_materials'), {
                itemName: newItem.itemName,
                currentQty: Number(newItem.currentQty),
                unitPrice: Number(newItem.unitPrice),
                lowStockThreshold: Number(newItem.lowStockThreshold),
                lastPurchased: new Date().toISOString().split('T')[0],
                createdAt: serverTimestamp()
            });
            setShowAddModal(false);
            setNewItem({ itemName: '', currentQty: '', unitPrice: '', lowStockThreshold: '5' });
        } catch (error) {
            console.error("Error adding item:", error);
        }
    };

    if (loading) {
        return (
            <div className="inventory-loading">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="raw-inventory-page">
            <div className="page-header-simple">
                <div className="header-left">
                    <EnhancedBackButton onBack={onBack} />
                    <h1 className="simple-title">Raw Inventory</h1>
                </div>
                <button
                    className="add-item-btn-simple"
                    onClick={() => setShowAddModal(true)}
                >
                    + Add Item
                </button>
            </div>

            <div className="inventory-table-container simple-container">
                <table className="inventory-table-simple">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Status</th>
                            <th>Current Qty</th>
                            <th>Unit Price</th>
                            <th>Last Restocked</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventoryItems.map((item) => {
                            const threshold = item.lowStockThreshold || 5;
                            const isLowStock = item.currentQty <= threshold;
                            return (
                                <tr key={item.id} className={`inventory-row-simple ${isLowStock ? 'row-alert' : ''}`}>
                                    <td className="item-name-cell">
                                        {item.itemName}
                                    </td>
                                    <td>
                                        {isLowStock ? (
                                            <span className="status-badge-simple danger">LOW STOCK</span>
                                        ) : (
                                            <span className="status-badge-simple success">OK</span>
                                        )}
                                    </td>
                                    <td className="qty-cell">
                                        <span className={`qty-value-simple ${isLowStock ? 'text-danger' : ''}`}>
                                            {item.currentQty}
                                        </span>
                                    </td>
                                    <td>Rs. {item.unitPrice}</td>
                                    <td>{item.lastPurchased || '-'}</td>
                                    <td>
                                        <div className="action-buttons-simple">
                                            <button
                                                className="consume-btn-simple"
                                                onClick={() => handleConsume(item.id, item.currentQty)}
                                                disabled={item.currentQty <= 0}
                                            >
                                                Consumed (-1)
                                            </button>
                                            <button
                                                className="delete-icon-btn"
                                                onClick={() => handleDelete(item.id, item.itemName)}
                                                title="Delete"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {inventoryItems.length === 0 && (
                            <tr>
                                <td colSpan="6" className="empty-state-simple">
                                    No items found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showAddModal && (
                <div className="modal-backdrop-simple">
                    <div className="modal-simple">
                        <div className="modal-header-simple">
                            <h2>Add New Material</h2>
                            <button className="close-btn-simple" onClick={() => setShowAddModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleAddItem}>
                            <div className="form-group-simple">
                                <label>Item Name</label>
                                <input
                                    type="text"
                                    value={newItem.itemName}
                                    onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-row-simple">
                                <div className="form-group-simple">
                                    <label>Quantity</label>
                                    <input
                                        type="number"
                                        value={newItem.currentQty}
                                        onChange={(e) => setNewItem({ ...newItem, currentQty: e.target.value })}
                                        required
                                        min="0"
                                    />
                                </div>
                                <div className="form-group-simple">
                                    <label>Price (Rs)</label>
                                    <input
                                        type="number"
                                        value={newItem.unitPrice}
                                        onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                                        required
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="form-group-simple">
                                <label>Low Stock Threshold</label>
                                <input
                                    type="number"
                                    value={newItem.lowStockThreshold}
                                    onChange={(e) => setNewItem({ ...newItem, lowStockThreshold: e.target.value })}
                                    min="1"
                                />
                            </div>
                            <div className="modal-actions-simple">
                                <button type="button" className="btn-simple secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn-simple primary">Add Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RawInventory;

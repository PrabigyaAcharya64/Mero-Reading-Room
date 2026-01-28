import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, increment, addDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/RawInventory.css';
import '../../styles/StandardLayout.css';

const RawInventory = ({ onBack, onDataLoaded }) => {
    const [inventoryItems, setInventoryItems] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState({
        itemName: '',
        currentQty: '',
        unitPrice: '',
        lowStockThreshold: '5'
    });

    useEffect(() => {
        const q = query(collection(db, 'raw_materials'));

        // Standard Batch Reveal Pattern - signal parent when loaded
        getDocs(q).finally(() => {
            onDataLoaded?.();
        });

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInventoryItems(items);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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


    return (
        <div className="std-container">
            <PageHeader title="Raw Inventory" onBack={onBack} rightElement={
                <button
                    className="add-item-btn-simple"
                    onClick={() => setShowAddModal(true)}
                >
                    + Add Item
                </button>
            } />

            <main className="std-body">

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
                                                    className="action-btn consume"
                                                    onClick={() => handleConsume(item.id, item.currentQty)}
                                                    disabled={item.currentQty <= 0}
                                                    title="Consume Stock (-1)"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="action-icon">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-9 9.375-9-9.375M11.25 12V3.75" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    onClick={() => handleDelete(item.id, item.itemName)}
                                                    title="Delete Item"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="action-icon">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                    </svg>
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
            </main>
        </div>
    );
};

export default RawInventory;

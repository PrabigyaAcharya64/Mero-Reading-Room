import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, addDoc, deleteDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import PageHeader from '../../components/PageHeader';
import FullScreenLoader from '../../components/FullScreenLoader';
import '../../styles/DryInventory.css';
import '../../styles/StandardLayout.css';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

const DryInventory = ({ onBack }) => {
    const [inventoryItems, setInventoryItems] = useState([]);
    const [menuItemIds, setMenuItemIds] = useState(new Set());
    const [loading, setLoading] = useState(true);

    // Sync Modal State
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [syncFormData, setSyncFormData] = useState({
        imageURL: '',
        productDescription: '',
        displayPrice: ''
    });

    // Add Item Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [newItem, setNewItem] = useState({
        itemName: '',
        salePrice: '',
        stockCount: '',
        category: 'Snacks'
    });

    useEffect(() => {
        const q = query(collection(db, 'canteen_items'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInventoryItems(items);
            setLoading(false);
        });

        // Listen to menuItems to track what is currently "In Menu"
        const menuQ = query(collection(db, 'menuItems'), where('stockRefId', '!=', null));
        const menuUnsubscribe = onSnapshot(menuQ, (snapshot) => {
            const stockIds = new Set();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.stockRefId) {
                    stockIds.add(data.stockRefId);
                }
            });
            setMenuItemIds(stockIds);
        });

        return () => {
            unsubscribe();
            menuUnsubscribe();
        };
    }, []);

    const handleRemoveFromMenu = async (item) => {
        if (window.confirm(`Remove "${item.itemName}" from the menu?`)) {
            try {
                const menuQ = query(collection(db, 'menuItems'), where('stockRefId', '==', item.id));
                const menuSnapshot = await getDocs(menuQ);

                const deletePromises = menuSnapshot.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
            } catch (error) {
                console.error("Error removing from menu:", error);
                alert("Failed to remove from menu.");
            }
        }
    };

    // --- Sync Logic ---
    const handleOpenSync = (item) => {
        setSelectedItem(item);
        setSyncFormData({
            imageURL: item.imageURL || '',
            productDescription: item.description || '',
            displayPrice: item.salePrice || ''
        });
        setShowSyncModal(true);
    };

    const handleCloseSync = () => {
        setShowSyncModal(false);
        setSelectedItem(null);
    };

    const handleSyncInputChange = (e) => {
        const { name, value } = e.target;
        setSyncFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleConfirmSync = async (e) => {
        e.preventDefault();
        if (!selectedItem) return;

        try {
            // First check if this item is already in menuItems (to update it) or if we need to create a new one
            // Since we don't have the menu item ID stored in inventory (only the reverse), we query for it
            const menuQ = query(collection(db, 'menuItems'), where('stockRefId', '==', selectedItem.id));
            const menuSnapshot = await getDocs(menuQ);

            const menuData = {
                name: selectedItem.itemName, // Mapped to 'name' for menuItems schema
                category: selectedItem.category,
                price: Number(syncFormData.displayPrice),
                description: syncFormData.productDescription,
                photoURL: syncFormData.imageURL, // Mapped to 'photoURL' for menuItems schema
                stockRefId: selectedItem.id,
                isFixed: true, // Inventory items are treated as fixed menu items
                createdAt: new Date().toISOString()
            };

            if (!menuSnapshot.empty) {
                // Update existing
                const menuItemId = menuSnapshot.docs[0].id;
                await setDoc(doc(db, 'menuItems', menuItemId), menuData, { merge: true });
            } else {
                // Create new
                await addDoc(collection(db, 'menuItems'), menuData);
            }

            const inventoryRef = doc(db, 'canteen_items', selectedItem.id);
            await updateDoc(inventoryRef, {
                lastSynced: new Date().toISOString(),
                imageURL: syncFormData.imageURL,
                description: syncFormData.productDescription
            });

            handleCloseSync();
        } catch (error) {
            console.error("Error syncing to menu:", error);
        }
    };

    const handleDelete = async (id, itemName) => {
        if (window.confirm(`Are you sure you want to delete "${itemName}"? This cannot be undone.`)) {
            try {
                // Delete from inventory
                await deleteDoc(doc(db, 'canteen_items', id));

                // Delete matching menu item if exists
                const menuQ = query(collection(db, 'menuItems'), where('stockRefId', '==', id));
                const menuSnapshot = await getDocs(menuQ);

                const deletePromises = menuSnapshot.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
            } catch (error) {
                console.error("Error deleting item:", error);
                alert("Failed to delete item.");
            }
        }
    };

    // --- Image Upload Logic (ImgBB) ---
    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const uploadImageToImgBB = async (file) => {
        if (!file) return null;

        try {
            // Convert file to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const base64String = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
                    resolve(base64String);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const base64Image = await base64Promise;

            const formData = new FormData();
            formData.append('image', base64Image);
            // key is appended in URL for ImgBB when using base64 in some examples, 
            // but MenuManagement uses URL param for key and FormData for image.

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                return data.data.url;
            } else {
                console.error("ImgBB upload error:", data);
                alert(`Upload failed: ${data.error?.message || 'Unknown error'}`);
                return null;
            }
        } catch (error) {
            console.error("Error uploading to ImgBB:", error);
            alert("Error uploading image. Please try again.");
            return null;
        }
    };

    // --- Edit Item Logic ---
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editFormData, setEditFormData] = useState({
        itemName: '',
        category: '',
        stockCount: 0,
        salePrice: 0
    });

    const handleEditClick = (item) => {
        setEditingItem(item);
        setEditFormData({
            itemName: item.itemName,
            category: item.category,
            stockCount: item.stockCount,
            salePrice: item.salePrice
        });
        setShowEditModal(true);
    };

    const handleUpdateItem = async (e) => {
        e.preventDefault();
        if (!editingItem) return;

        setUploading(true); // Reusing uploading state for spinner
        try {
            const itemRef = doc(db, 'canteen_items', editingItem.id);
            await updateDoc(itemRef, {
                itemName: editFormData.itemName,
                category: editFormData.category,
                stockCount: Number(editFormData.stockCount),
                salePrice: Number(editFormData.salePrice),
                lastUpdated: serverTimestamp()
            });

            // Optional: Update linked menu item if name/price changed? 
            // For now, let's keep it simple as synced items might drift or be manually re-synced.
            // But usually, you'd want price updates to propagate if linked.
            // Let's do a quick check if it's in menu and update basic fields.
            const menuQ = query(collection(db, 'menuItems'), where('stockRefId', '==', editingItem.id));
            const menuSnapshot = await getDocs(menuQ);
            if (!menuSnapshot.empty) {
                const menuDoc = menuSnapshot.docs[0];
                await updateDoc(menuDoc.ref, {
                    name: editFormData.itemName,
                    category: editFormData.category, // Menu items largely map 1:1 here?
                    price: Number(editFormData.salePrice)
                });
            }

            setShowEditModal(false);
            setEditingItem(null);
        } catch (error) {
            console.error("Error updating item:", error);
            alert("Failed to update item.");
        } finally {
            setUploading(false);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
            let imageURL = '';
            if (imageFile) {
                imageURL = await uploadImageToImgBB(imageFile);
            }

            await addDoc(collection(db, 'canteen_items'), {
                itemName: newItem.itemName,
                salePrice: Number(newItem.salePrice),
                stockCount: Number(newItem.stockCount),
                category: newItem.category,
                imageURL: imageURL || '', // Use uploaded URL or empty string
                createdAt: serverTimestamp()
            });
            setShowAddModal(false);
            setNewItem({ itemName: '', salePrice: '', stockCount: '', category: 'Snacks' });
            setImageFile(null);
        } catch (error) {
            console.error("Error adding item:", error);
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return <FullScreenLoader text="Loading dry inventory..." />;
    }

    return (
        <div className="std-container">
            <PageHeader title="Dry Inventory" onBack={onBack} rightElement={
                <button
                    className="add-item-btn-simple"
                    onClick={() => setShowAddModal(true)}
                >
                    + Add Product
                </button>
            } />

            <main className="std-body">

                <div className="inventory-table-container simple-container">
                    <table className="inventory-table-simple">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Item Name</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Stock</th>
                                <th>Price</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventoryItems.map((item) => {
                                const isSoldOut = item.stockCount === 0;
                                return (
                                    <tr key={item.id} className={`inventory-row-simple ${isSoldOut ? 'row-alert' : ''}`}>
                                        <td>
                                            <div className="params-cell-image">
                                                {item.imageURL ? (
                                                    <img
                                                        src={item.imageURL}
                                                        alt={item.itemName}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.parentElement.classList.add('image-error');
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="no-image-placeholder">{item.itemName.charAt(0)}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="item-name-cell">
                                            {item.itemName}
                                        </td>
                                        <td>{item.category}</td>
                                        <td>
                                            {menuItemIds.has(item.id) && (
                                                <span className="status-badge-simple success">IN MENU</span>
                                            )}
                                            {isSoldOut && (
                                                <span className="status-badge-simple danger" style={{ marginLeft: '0.5rem' }}>SOLD OUT</span>
                                            )}
                                        </td>
                                        <td className="qty-cell">
                                            <span className={`qty-value-simple ${isSoldOut ? 'text-danger' : ''}`}>
                                                {item.stockCount}
                                            </span>
                                        </td>
                                        <td>Rs. {item.salePrice}</td>
                                        <td>

                                            <div className="action-buttons-simple">
                                                {menuItemIds.has(item.id) ? (
                                                    <button
                                                        className="sync-btn-simple"
                                                        onClick={() => handleRemoveFromMenu(item)}
                                                        style={{
                                                            width: 'auto',
                                                            margin: 0,
                                                            padding: '0.4rem 0.8rem',
                                                            background: '#000',
                                                            color: '#fff'
                                                        }}
                                                        title="Remove from Menu"
                                                    >
                                                        In Menu
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="sync-btn-simple"
                                                        onClick={() => handleOpenSync(item)}
                                                        disabled={isSoldOut}
                                                        style={{ width: 'auto', margin: 0, padding: '0.4rem 0.8rem' }}
                                                    >
                                                        Add to Menu
                                                    </button>
                                                )}

                                                <button
                                                    className="edit-icon-btn"
                                                    onClick={() => handleEditClick(item)}
                                                    title="Edit Item"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '0.4rem',
                                                        marginRight: '0.2rem'
                                                    }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem' }}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                    </svg>
                                                </button>

                                                <button
                                                    className="delete-icon-btn"
                                                    onClick={() => handleDelete(item.id, item.itemName)}
                                                    title="Delete Item"
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
                                    <td colSpan="7" className="empty-state-simple">
                                        No items found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* --- Modals --- */}

                {showSyncModal && (
                    <div className="modal-backdrop-simple">
                        <div className="modal-simple">
                            <div className="modal-header-simple">
                                <h2>Sync to Menu</h2>
                                <button className="close-btn-simple" onClick={handleCloseSync}>&times;</button>
                            </div>
                            <form onSubmit={handleConfirmSync}>
                                <div className="form-group-simple">
                                    <label>Display Price (Rs.)</label>
                                    <input
                                        type="number"
                                        name="displayPrice"
                                        value={syncFormData.displayPrice}
                                        onChange={handleSyncInputChange}
                                        required
                                    />
                                </div>
                                <div className="form-group-simple">
                                    <label>Description</label>
                                    <textarea
                                        name="productDescription"
                                        value={syncFormData.productDescription}
                                        onChange={handleSyncInputChange}
                                        rows="3"
                                    />
                                </div>
                                <div className="form-group-simple">
                                    <label>Image URL (Optional override)</label>
                                    <input
                                        type="url"
                                        name="imageURL"
                                        value={syncFormData.imageURL}
                                        onChange={handleSyncInputChange}
                                    />
                                </div>

                                <div className="modal-actions-simple">
                                    <button type="button" className="btn-simple secondary" onClick={handleCloseSync}>Cancel</button>
                                    <button type="submit" className="btn-simple primary">Publish</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showEditModal && (
                    <div className="modal-backdrop-simple">
                        <div className="modal-simple">
                            <div className="modal-header-simple">
                                <h2>Edit Product</h2>
                                <button className="close-btn-simple" onClick={() => setShowEditModal(false)}>&times;</button>
                            </div>
                            <form onSubmit={handleUpdateItem}>
                                <div className="form-group-simple">
                                    <label>Product Name</label>
                                    <input
                                        type="text"
                                        value={editFormData.itemName}
                                        onChange={(e) => setEditFormData({ ...editFormData, itemName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-row-simple">
                                    <div className="form-group-simple">
                                        <label>Price (Rs)</label>
                                        <input
                                            type="number"
                                            value={editFormData.salePrice}
                                            onChange={(e) => setEditFormData({ ...editFormData, salePrice: e.target.value })}
                                            required
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group-simple">
                                        <label>Stock</label>
                                        <input
                                            type="number"
                                            value={editFormData.stockCount}
                                            onChange={(e) => setEditFormData({ ...editFormData, stockCount: e.target.value })}
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div className="form-group-simple">
                                    <label>Category</label>
                                    <select
                                        value={editFormData.category}
                                        onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #000' }}
                                    >
                                        <option value="Snacks">Snacks</option>
                                        <option value="Drinks">Drinks</option>
                                        <option value="Stationery">Stationery</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="modal-actions-simple">
                                    <button type="button" className="btn-simple secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                                    <button
                                        type="submit"
                                        className="btn-simple primary"
                                        disabled={uploading}
                                    >
                                        {uploading ? 'Updating...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showAddModal && (
                    <div className="modal-backdrop-simple">
                        <div className="modal-simple">
                            <div className="modal-header-simple">
                                <h2>Add New Product</h2>
                                <button className="close-btn-simple" onClick={() => setShowAddModal(false)}>&times;</button>
                            </div>
                            <form onSubmit={handleAddItem}>
                                <div className="form-group-simple">
                                    <label>Product Name</label>
                                    <input
                                        type="text"
                                        value={newItem.itemName}
                                        onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Improved Image Upload */}
                                <div className="form-group-simple">
                                    <label>Product Image</label>
                                    <div className="file-input-wrapper">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            id="product-image-upload"
                                            className="hidden-file-input"
                                        />
                                        <label htmlFor="product-image-upload" className="file-upload-label">
                                            {imageFile ? imageFile.name : 'Choose Image (ImgBB)...'}
                                        </label>
                                    </div>
                                </div>

                                <div className="form-row-simple">
                                    <div className="form-group-simple">
                                        <label>Price (Rs)</label>
                                        <input
                                            type="number"
                                            value={newItem.salePrice}
                                            onChange={(e) => setNewItem({ ...newItem, salePrice: e.target.value })}
                                            required
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group-simple">
                                        <label>Stock</label>
                                        <input
                                            type="number"
                                            value={newItem.stockCount}
                                            onChange={(e) => setNewItem({ ...newItem, stockCount: e.target.value })}
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div className="form-group-simple">
                                    <label>Category</label>
                                    <select
                                        value={newItem.category}
                                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #000' }}
                                    >
                                        <option value="Snacks">Snacks</option>
                                        <option value="Drinks">Drinks</option>
                                        <option value="Stationery">Stationery</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="modal-actions-simple">
                                    <button type="button" className="btn-simple secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                                    <button
                                        type="submit"
                                        className="btn-simple primary"
                                        disabled={uploading}
                                    >
                                        {uploading ? 'Uploading...' : 'Add Product'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DryInventory;

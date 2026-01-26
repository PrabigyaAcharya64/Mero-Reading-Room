import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { validateMenuItemName, validatePrice, validateDescription, validateCategory } from '../../utils/validation';
import { getBusinessDate } from '../../utils/dateUtils';
import FullScreenLoader from '../../components/FullScreenLoader';
import Button from '../../components/Button';
import PageHeader from '../../components/PageHeader';
import { Plus, Trash2, Star, Check, X, Camera, LayoutGrid, ListChecks } from 'lucide-react';
import '../../styles/MenuManagement.css';
import '../../styles/StandardLayout.css';
import { uploadImageSecurely } from '../../utils/imageUpload';

function MenuManagement({ onBack, isSidebarOpen, onToggleSidebar }) {
  const { user } = useAuth();

  const [menuItems, setMenuItems] = useState([]);
  const [todaysMenu, setTodaysMenu] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category: 'Breakfast',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const initData = async () => {
      setPageLoading(true);
      await Promise.all([loadMenuItems(), loadTodaysMenu()]);
      setPageLoading(false);
    };
    initData();
  }, []);

  useEffect(() => {
    // If not in select mode, we don't automatically sync selectedItems with todaysMenu
    // unless we just loaded them. 
    if (!isSelectMode) {
      const todaysMenuIds = todaysMenu.map(item => item.id);
      setSelectedItems(todaysMenuIds);
    }
  }, [todaysMenu, isSelectMode]);

  const loadMenuItems = async () => {
    try {
      const menuItemsRef = collection(db, 'menuItems');
      const snapshot = await getDocs(menuItemsRef);
      if (snapshot && snapshot.docs) {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        setMenuItems(items);
      } else {
        setMenuItems([]);
      }
    } catch (error) {
      console.error('Error loading menu items:', error);
      setMessage(`Error loading menu items: ${error.message}`);
    }
  };

  const loadTodaysMenu = async () => {
    try {
      const today = getBusinessDate();
      const todaysMenuRef = doc(db, 'todaysMenu', today);
      const todaysMenuDoc = await getDoc(todaysMenuRef);
      if (todaysMenuDoc.exists()) {
        const data = todaysMenuDoc.data();
        setTodaysMenu(data.items || []);
      } else {
        setTodaysMenu([]);
      }
    } catch (error) {
      console.error('Error loading today\'s menu:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage('Image size should be less than 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const nameVal = validateMenuItemName(formData.name);
    const priceVal = validatePrice(formData.price, 0, 10000);
    const descVal = validateDescription(formData.description, 500);
    const catVal = validateCategory(formData.category);

    if (!nameVal.valid || !priceVal.valid || !descVal.valid || !catVal.valid) {
      setMessage(nameVal.error || priceVal.error || descVal.error || catVal.error);
      setLoading(false);
      return;
    }

    try {
      let photoURL = null;
      if (photoFile) {
        photoURL = await uploadImageSecurely(photoFile);
      }

      await addDoc(collection(db, 'menuItems'), {
        name: nameVal.sanitized,
        price: priceVal.sanitized,
        description: descVal.sanitized,
        category: catVal.sanitized,
        photoURL: photoURL,
        createdAt: new Date().toISOString(),
      });

      setFormData({ name: '', price: '', description: '', category: 'Breakfast' });
      setPhotoFile(null);
      setPhotoPreview(null);
      setMessage('Menu item added successfully!');
      loadMenuItems();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await deleteDoc(doc(db, 'menuItems', itemId));
      setMessage('Item deleted!');
      loadMenuItems();
    } catch (error) {
      setMessage('Error deleting item');
    }
  };

  const handleToggleSelection = (itemId) => {
    setSelectedItems(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };

  const handleToggleFixed = async (itemId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), { isFixed: !currentStatus });
      setMenuItems(prev => prev.map(item => item.id === itemId ? { ...item, isFixed: !currentStatus } : item));
    } catch (error) {
      setMessage("Failed to update status");
    }
  };

  const handleSetTodaysMenu = async () => {
    setLoading(true);
    try {
      const today = getBusinessDate();
      const itemsToSet = menuItems.filter(item => selectedItems.includes(item.id)).map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        description: item.description,
        category: item.category || 'Breakfast',
        photoURL: item.photoURL || null,
      }));

      await setDoc(doc(db, 'todaysMenu', today), {
        date: today,
        items: itemsToSet,
        updatedAt: new Date().toISOString(),
      });

      setTodaysMenu(itemsToSet);
      setMessage(`Today's special updated!`);
      setIsSelectMode(false);
    } catch (error) {
      setMessage("Error publishing menu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="std-container">
      <PageHeader title="Menu Management" onBack={onBack} isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />

      {pageLoading && <FullScreenLoader text="Loading Canteen..." />}

      <main className="std-body mm-grid-layout">
        {/* Sidebar: Add Form */}
        <aside className="mm-form-section">
          <h2 className="mm-section-title">Add New Dish</h2>
          <form onSubmit={handleAddMenuItem} className="mm-form">
            <div className="mm-input-group">
              <label className="mm-label">Dish Name</label>
              <input type="text" name="name" className="mm-input" value={formData.name} onChange={handleInputChange} placeholder="e.g., Dal Bhat" required />
            </div>

            <div className="mm-input-group">
              <label className="mm-label">Price (रु)</label>
              <input type="number" name="price" className="mm-input" value={formData.price} onChange={handleInputChange} placeholder="150" step="0.01" required />
            </div>

            <div className="mm-input-group">
              <label className="mm-label">Category</label>
              <select name="category" className="mm-select" value={formData.category} onChange={handleInputChange} required>
                <option value="Breakfast">Breakfast</option>
                <option value="Meal">Meal</option>
                <option value="Dinner">Dinner</option>
                <option value="Snacks">Snacks</option>
                <option value="Drinks">Drinks</option>
              </select>
            </div>

            <div className="mm-input-group">
              <label className="mm-label">Description</label>
              <textarea name="description" className="mm-textarea" value={formData.description} onChange={handleInputChange} placeholder="Write a short description..." rows="3" required />
            </div>

            <div className="mm-input-group">
              <label className="mm-label">Photo</label>
              <div className="mm-file-input-wrapper">
                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} id="photo-upload" />
                <label htmlFor="photo-upload" style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Camera size={24} className="text-gray-400" />
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      {photoFile ? photoFile.name : 'Upload Dish Photo'}
                    </span>
                  </div>
                </label>
              </div>
              {photoPreview && (
                <div className="mm-preview-container">
                  <img src={photoPreview} alt="Preview" className="mm-preview-img" />
                  <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="mm-remove-preview"><X size={16} /></button>
                </div>
              )}
            </div>

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              <Plus size={18} /> Create Menu Item
            </Button>
          </form>
          {message && <div className={`mm-message ${message.toLowerCase().includes('success') || message.toLowerCase().includes('published') || message.toLowerCase().includes('updated') ? 'success' : 'error'}`}>{message}</div>}
        </aside>

        {/* Content: List Management */}
        <section className="mm-content-section">
          <div className="mm-toolbar">
            <div className="mm-toolbar-left">
              <h2>Master Catalog</h2>
              <p>{menuItems.length} items available • {todaysMenu.length} currently in Special Menu</p>
            </div>
            <div className="mm-toolbar-actions">
              {isSelectMode ? (
                <>
                  <Button variant="ghost" onClick={() => { setIsSelectMode(false); setSelectedItems(todaysMenu.map(i => i.id)); }}>Cancel</Button>
                  <Button variant="primary" onClick={handleSetTodaysMenu} loading={loading} disabled={selectedItems.length === 0}>
                    Save Changes ({selectedItems.length})
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setIsSelectMode(true)}>
                  <ListChecks size={18} /> Edit Special Menu
                </Button>
              )}
            </div>
          </div>

          <div className="mm-grid">
            {menuItems.map((item) => {
              const isSelected = selectedItems.includes(item.id);
              const isInSpecial = todaysMenu.some(m => m.id === item.id);

              return (
                <div key={item.id} className={`mm-card ${isSelected && isSelectMode ? 'isSelected' : ''}`} onClick={() => isSelectMode && handleToggleSelection(item.id)}>
                  {isSelectMode && (
                    <div className="mm-select-indicator">
                      <Check className="mm-indicator-icon" />
                    </div>
                  )}
                  
                  <div className="mm-card-image-wrapper">
                    {item.photoURL ? (
                      <img src={item.photoURL} alt={item.name} className="mm-card-img" />
                    ) : (
                      <div className="mm-no-image">No Image</div>
                    )}
                    <span className="mm-category-tag">{item.category}</span>
                  </div>

                  <div className="mm-card-content">
                    <h3 className="mm-card-title">{item.name}</h3>
                    <p className="mm-card-desc">{item.description}</p>
                    <div className="mm-card-footer">
                      <div className="mm-card-price">रु {Number(item.price).toFixed(0)}</div>
                      {isInSpecial && <span className="mm-card-badge">Current Special</span>}
                      {item.isFixed && <Star size={14} fill="currentColor" className="text-yellow-500" title="Fixed Item" />}
                    </div>
                  </div>

                  {!isSelectMode && (
                    <div className="mm-card-overlay">
                      <Button variant="outline" onClick={(e) => { e.stopPropagation(); handleToggleFixed(item.id, item.isFixed); }} fullWidth>
                        <Star size={16} /> {item.isFixed ? 'Remove Star' : 'Star Item'}
                      </Button>
                      <Button variant="danger" onClick={(e) => { e.stopPropagation(); handleDeleteMenuItem(item.id); }} fullWidth>
                        <Trash2 size={16} /> Delete Forever
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {menuItems.length === 0 && (
            <div className="abl-empty" style={{ background: 'var(--color-surface)', padding: 'var(--spacing-40)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
              <LayoutGrid size={48} className="text-gray-300" style={{ marginBottom: '16px' }} />
              <h3>Catalog is Empty</h3>
              <p>Start adding dishes to build your menu catalog.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default MenuManagement;

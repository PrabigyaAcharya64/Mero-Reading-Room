import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { validateMenuItemName, validatePrice, validateDescription, validateCategory } from '../../utils/validation';
import { getBusinessDate } from '../../utils/dateUtils';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import { Plus, Trash2, Star, Check, X, Camera, LayoutGrid, ListChecks, Eye, ArrowLeft, Settings2 } from 'lucide-react';
import CanteenPreviewAdmin from './CanteenPreviewAdmin';
import { useAdminHeader } from '../../context/AdminHeaderContext';
import '../../styles/MenuManagement.css';
import '../../styles/StandardLayout.css';
import { uploadImageSecurely } from '../../utils/imageUpload';
function MenuManagement({ onBack, onDataLoaded }) {
  const { setHeader } = useAdminHeader();
  const [menuItems, setMenuItems] = useState([]);
  const [todaysMenu, setTodaysMenu] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category: 'Breakfast',
    targetTypes: [], // ['mrr', 'mrr_hostel', 'hostel', 'staff'] (empty = all)
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Daily Specials Config State
  const [showSpecialsConfig, setShowSpecialsConfig] = useState(false);
  const [dailySpecialsConfig, setDailySpecialsConfig] = useState({}); // { itemId: { isHostelSpecial: bool, isStaffSpecial: bool } }

  useEffect(() => {
    setHeader({ title: 'Menu Management' });
    const initData = async () => {
      try {
        await Promise.all([loadMenuItems(), loadTodaysMenu()]);
      } catch (error) {
        console.error("Error loading menu data:", error);
      } finally {
        onDataLoaded?.();
      }
    };
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // Initialize config from existing today's menu to preserve flags if re-editing
        const initialConfig = {};
        (data.items || []).forEach(item => {
          initialConfig[item.id] = {
            isHostelSpecial: item.isHostelSpecial || false,
            isStaffSpecial: item.isStaffSpecial || false
          };
        });
        setDailySpecialsConfig(initialConfig);
      } else {
        setTodaysMenu([]);
        setDailySpecialsConfig({});
      }
    } catch (error) {
      console.error('Error loading today\'s menu:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'targetTypes') {
        // Handle multi-select for target types via checkboxes
        setFormData(prev => {
          const current = prev.targetTypes || [];
          if (checked) return { ...prev, targetTypes: [...current, value] };
          return { ...prev, targetTypes: current.filter(t => t !== value) };
        });
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
        targetTypes: formData.targetTypes || [],
        // isHostelSpecial/isStaffSpecial are now transient daily flags, not persistent on item
        photoURL: photoURL,
        createdAt: new Date().toISOString(),
      });

      setFormData({ name: '', price: '', description: '', category: 'Breakfast', targetTypes: [] });
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

  const handleOpenSpecialsConfig = () => {
    // Initialize config for any newly selected items that don't have config yet
    setDailySpecialsConfig(prev => {
      const newConfig = { ...prev };
      selectedItems.forEach(id => {
        if (!newConfig[id]) {
          newConfig[id] = { isHostelSpecial: false, isStaffSpecial: false };
        }
      });
      return newConfig;
    });
    setShowSpecialsConfig(true);
  };

  const handleToggleSpecialFlag = (itemId, flagName) => {
    // If not selected, select it first
    if (!selectedItems.includes(itemId)) {
      setSelectedItems(prev => [...prev, itemId]);
    }

    setDailySpecialsConfig(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [flagName]: !prev[itemId]?.[flagName]
      }
    }));
  };

  const handlePublishTodaysMenu = async () => {
    setLoading(true);
    try {
      const today = getBusinessDate();
      const itemsToSet = menuItems
        .filter(item => selectedItems.includes(item.id))
        .map(item => {
          // Defaults if not configured
          const config = dailySpecialsConfig[item.id] || { isHostelSpecial: false, isStaffSpecial: false };
          return {
            id: item.id || '',
            name: item.name || 'Unknown',
            price: item.price !== undefined ? item.price : 0,
            description: item.description || '',
            category: item.category || 'Breakfast',
            targetTypes: item.targetTypes || [],
            photoURL: item.photoURL === undefined ? null : item.photoURL,
            // Daily transient flags from local state with strict boolean cast
            isHostelSpecial: Boolean(config.isHostelSpecial),
            isStaffSpecial: Boolean(config.isStaffSpecial)
          };
        });

      await setDoc(doc(db, 'todaysMenu', today), {
        date: today,
        items: itemsToSet,
        updatedAt: new Date().toISOString(),
      });

      setTodaysMenu(itemsToSet);
      setMessage(`Today's Special published with ${itemsToSet.length} items!`);
      // setIsSelectMode(false); // Keep select mode active for continued editing
    } catch (error) {
      setMessage("Error publishing menu");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (showPreview) {
    return <CanteenPreviewAdmin onBack={() => setShowPreview(false)} />;
  }

  return (
    <div className="std-container">
      <main className="std-body mm-grid-layout">
        {/* Sidebar: Add Form */}
        <aside className="mm-form-section">
          {/* ... sidebar content same as before ... */}
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
              <label className="mm-label">Target Users (Empty = All)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {['mrr', 'mrr_hostel', 'hostel', 'staff'].map(type => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="targetTypes"
                      value={type}
                      checked={(formData.targetTypes || []).includes(type)}
                      onChange={handleInputChange}
                    />
                    {type === 'mrr_hostel' ? 'MRR+Hostel' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </label>
                ))}
              </div>
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
              <p>{menuItems.length} items available • {selectedItems.length} selected for Today</p>
            </div>
            <div className="mm-toolbar-actions">
              <Button variant="outline" onClick={() => setShowPreview(true)}>
                <Eye size={18} /> Preview
              </Button>
              {/* Publish Button Always Visible/Active if items changed */}
              <Button variant="primary" onClick={handlePublishTodaysMenu} loading={loading}>
                <Check size={18} /> Publish Updates
              </Button>
            </div>
          </div>

          <div className="mm-grid">
            {menuItems.map((item) => {
              const isSelected = selectedItems.includes(item.id);
              // Check existing daily config or fallback to todaysMenu data (if not yet edited locally)
              const todayItem = todaysMenu.find(m => m.id === item.id);

              const config = dailySpecialsConfig[item.id] || {
                isHostelSpecial: todayItem?.isHostelSpecial || false,
                isStaffSpecial: todayItem?.isStaffSpecial || false
              };

              // Sync local config initial state if needed
              if (!dailySpecialsConfig[item.id] && todayItem) {
                // Side-effect in render is bad, but for simplicty we rely on init in useEffect. 
                // Here we just use the derived value.
              }

              return (
                <div key={item.id} className={`mm-card ${isSelected ? 'isSelected' : ''}`}>
                  {isSelected && (
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
                    {item.targetTypes && item.targetTypes.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {item.targetTypes.map(t => (
                          <span key={t} style={{ fontSize: '9px', padding: '2px 4px', background: '#e0f2fe', color: '#0284c7', borderRadius: '4px' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mm-card-footer">
                      <div className="mm-card-price">रु {Number(item.price).toFixed(0)}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {config.isHostelSpecial && (
                        <span style={{ fontSize: '10px', background: '#7c3aed', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>★ Hostel Special</span>
                      )}
                      {config.isStaffSpecial && (
                        <span style={{ fontSize: '10px', background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>★ Staff Special</span>
                      )}
                    </div>
                  </div>

                  {/* Move actions OUT of the absolute overlay so they don't hide the content */}
                  <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* 1. Toggle General Selection */}
                    <Button
                      variant={isSelected ? "primary" : "outline"}
                      onClick={(e) => { e.stopPropagation(); handleToggleSelection(item.id); }}
                      fullWidth
                      size="sm"
                    >
                      {isSelected ? "Remove from Today" : "Add to Today's Menu"}
                    </Button>

                    {/* Display special toggles ONLY if selected for today */}
                    {isSelected && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <Button
                          variant={config.isHostelSpecial ? "secondary" : "ghost"}
                          onClick={(e) => { e.stopPropagation(); handleToggleSpecialFlag(item.id, 'isHostelSpecial'); }}
                          size="sm"
                          style={config.isHostelSpecial ? { backgroundColor: '#dbc7fd', color: '#5b21b6', borderColor: '#7c3aed', fontSize: '12px', padding: '4px' } : { border: '1px solid #ddd', fontSize: '12px', padding: '4px' }}
                        >
                          {config.isHostelSpecial ? "Hostel ★" : "Hostel Special"}
                        </Button>
                        <Button
                          variant={config.isStaffSpecial ? "secondary" : "ghost"}
                          onClick={(e) => { e.stopPropagation(); handleToggleSpecialFlag(item.id, 'isStaffSpecial'); }}
                          size="sm"
                          style={config.isStaffSpecial ? { backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#10b981', fontSize: '12px', padding: '4px' } : { border: '1px solid #ddd', fontSize: '12px', padding: '4px' }}
                        >
                          {config.isStaffSpecial ? "Staff ★" : "Staff Special"}
                        </Button>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>

                    <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteMenuItem(item.id); }} fullWidth>
                      <Trash2 size={14} /> Delete Item
                    </Button>
                  </div>
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

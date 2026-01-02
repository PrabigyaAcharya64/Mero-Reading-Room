import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, getDoc, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { validateMenuItemName, validatePrice, validateDescription, validateCategory } from '../../utils/validation';
import LoadingSpinner from '../../components/LoadingSpinner';

import EnhancedBackButton from '../../components/EnhancedBackButton';
import '../../styles/MenuManagement.css';

const IMGBB_API_KEY = 'f3836c3667cc5c73c64e1aa4f0849566';



function MenuManagement({ onBack }) {
  const { user } = useAuth();

  const [menuItems, setMenuItems] = useState([]);
  const [todaysMenu, setTodaysMenu] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // Array of item IDs
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category: 'Breakfast', // Default category
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadMenuItems();
    loadTodaysMenu();
  }, []);

  // Update selected items when today's menu changes
  useEffect(() => {
    const todaysMenuIds = todaysMenu.map(item => item.id);
    setSelectedItems(todaysMenuIds);
  }, [todaysMenu]);

  const loadMenuItems = async () => {
    try {
      const menuItemsRef = collection(db, 'menuItems');

      // Add timeout to prevent hanging (increased to 15 seconds for first load)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      const snapshot = await Promise.race([
        getDocs(menuItemsRef),
        timeoutPromise
      ]);

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
      // Handle different error types
      if (error?.code === 'permission-denied') {
        console.error('Permission denied: Firestore security rules are blocking access.');
        setMessage('Permission denied. Please check Firestore security rules in Firebase Console.');
        setMenuItems([]);
      } else if (error?.code === 'unavailable' || error?.code === 'failed-precondition' || error?.message?.includes('offline')) {
        console.warn('Firestore is offline. Menu items will load when connection is restored.');
        setMessage('Offline: Menu items will load when connection is restored.');
        setMenuItems([]);
      } else if (error?.message?.includes('timeout')) {
        console.warn('Menu items loading timed out. Please check Firestore configuration.');
        setMessage('Firestore connection timeout. Please check your network and Firestore configuration.');
        setMenuItems([]);
      } else {
        console.error('Error loading menu items:', error);
        setMessage(`Error loading menu items: ${error?.message || 'Unknown error'}. Please check Firestore security rules.`);
        setMenuItems([]);
      }
    }
  };

  const loadTodaysMenu = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const todaysMenuRef = doc(db, 'todaysMenu', today);

      // Add timeout to prevent hanging (increased to 15 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      const todaysMenuDoc = await Promise.race([
        getDoc(todaysMenuRef),
        timeoutPromise
      ]);

      if (todaysMenuDoc && todaysMenuDoc.exists()) {
        const data = todaysMenuDoc.data();
        if (data && data.items) {
          setTodaysMenu(data.items);
        } else {
          setTodaysMenu([]);
        }
      } else {
        setTodaysMenu([]);
      }
    } catch (error) {
      // Handle different error types
      if (error?.code === 'permission-denied') {
        console.error('Permission denied: Firestore security rules are blocking access.');
        setTodaysMenu([]);
      } else if (error?.code === 'unavailable' || error?.code === 'failed-precondition' || error?.message?.includes('offline')) {
        console.warn('Firestore is offline. Menu will load when connection is restored.');
        setTodaysMenu([]);
      } else if (error?.message?.includes('timeout')) {
        console.warn('Today\'s menu loading timed out. Please check Firestore configuration.');
        setTodaysMenu([]);
      } else {
        console.error('Error loading today\'s menu:', error);
        setTodaysMenu([]);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage('Image size should be less than 5MB');
        return;
      }
      setPhotoFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage('');

    // Validate all inputs
    const nameValidation = validateMenuItemName(formData.name);
    if (!nameValidation.valid) {
      setMessage(nameValidation.error);
      setLoading(false);
      return;
    }

    const priceValidation = validatePrice(formData.price, 0, 10000);
    if (!priceValidation.valid) {
      setMessage(priceValidation.error);
      setLoading(false);
      return;
    }

    const descriptionValidation = validateDescription(formData.description, 500);
    if (!descriptionValidation.valid) {
      setMessage(descriptionValidation.error);
      setLoading(false);
      return;
    }

    const categoryValidation = validateCategory(formData.category);
    if (!categoryValidation.valid) {
      setMessage(categoryValidation.error);
      setLoading(false);
      return;
    }

    try {

      let photoURL = null;

      // Upload photo to imgBB if provided
      if (photoFile) {
        try {
          // Convert file to base64
          const reader = new FileReader();
          const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => {
              const base64String = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
              resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(photoFile);
          });

          const base64Image = await base64Promise;

          // Upload to imgBB using FormData
          const uploadFormData = new FormData();
          uploadFormData.append('image', base64Image);

          const uploadTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Upload timeout')), 30000)
          );

          const uploadResponse = await Promise.race([
            fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
              method: 'POST',
              body: uploadFormData
            }),
            uploadTimeoutPromise
          ]);

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed with status: ${uploadResponse.status}`);
          }

          const result = await uploadResponse.json();

          if (result.success && result.data) {
            photoURL = result.data.url; // Use the direct image URL
          } else {
            throw new Error(result.error?.message || 'Upload failed');
          }
        } catch (error) {
          console.error('Error uploading photo to imgBB:', error);
          if (error?.message?.includes('timeout')) {
            setMessage('Photo upload timed out. Please try again.');
            setLoading(false);
            return;
          } else {
            setMessage(`Error uploading photo: ${error?.message || 'Unknown error'}. Menu item will be saved without photo.`);
            // Continue without photo
          }
        }
      }

      // Add timeout to prevent hanging (increased to 15 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      await Promise.race([
        addDoc(collection(db, 'menuItems'), {
          name: nameValidation.sanitized,
          price: priceValidation.sanitized,
          description: descriptionValidation.sanitized,
          category: categoryValidation.sanitized,
          photoURL: photoURL,
          createdAt: new Date().toISOString(),
        }),
        timeoutPromise
      ]);

      setFormData({ name: '', price: '', description: '', category: 'Breakfast' });
      setPhotoFile(null);
      setPhotoPreview(null);
      setMessage('Menu item added successfully!');
      loadMenuItems();
    } catch (error) {
      console.error('Error adding menu item:', error);
      if (error?.code === 'permission-denied') {
        setMessage('Permission denied. Please check Firestore security rules. You must be authenticated.');
      } else if (error?.code === 'unavailable' || error?.code === 'failed-precondition' || error?.message?.includes('offline')) {
        setMessage('Offline: Menu item will be saved when connection is restored.');
      } else if (error?.message?.includes('timeout')) {
        setMessage('Request timed out. Please check your connection and try again.');
      } else {
        setMessage(`Error adding menu item: ${error?.message || 'Unknown error'}. Please check Firestore security rules.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this menu item?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'menuItems', itemId));
      setMessage('Menu item deleted successfully!');
      loadMenuItems();
    } catch (error) {
      console.error('Error deleting menu item:', error);
      setMessage('Error deleting menu item');
    }
  };

  const handleToggleSelection = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleToggleFixed = async (itemId, currentStatus) => {
      try {
          const itemRef = doc(db, 'menuItems', itemId);
          await updateDoc(itemRef, {
              isFixed: !currentStatus
          });
          
          // Optimistically update local state
          setMenuItems(prev => prev.map(item => 
              item.id === itemId ? { ...item, isFixed: !currentStatus } : item
          ));
          
      } catch (error) {
          console.error("Error updating fixed status:", error);
          setMessage("Failed to update fixed status");
      }
  };

  const handleSelectAll = () => {
    setSelectedItems(menuItems.map(item => item.id));
  };

  const handleDeselectAll = () => {
    setSelectedItems([]);
  };

  const handleSetTodaysMenu = async () => {
    if (selectedItems.length === 0) {
      setMessage('Please select at least one menu item to set as today\'s menu.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const todaysMenuRef = doc(db, 'todaysMenu', today);

      // Get only selected items
      const itemsToSet = menuItems
        .filter(item => selectedItems.includes(item.id))
        .map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          description: item.description,
          category: item.category || 'Breakfast', // Default to Breakfast if category is missing
          photoURL: item.photoURL || null,
        }));

      // Add timeout to prevent hanging (increased to 15 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      await Promise.race([
        setDoc(todaysMenuRef, {
          date: today,
          items: itemsToSet,
          updatedAt: new Date().toISOString(),
        }),
        timeoutPromise
      ]);

      setTodaysMenu(itemsToSet);
      setMessage(`Today's menu set successfully with ${itemsToSet.length} item(s)!`);
    } catch (error) {
      console.error('Error setting today\'s menu:', error);
      if (error?.code === 'permission-denied') {
        setMessage('Permission denied. Please check Firestore security rules. You must be authenticated.');
      } else if (error?.code === 'unavailable' || error?.code === 'failed-precondition' || error?.message?.includes('offline')) {
        setMessage('Offline: Menu will be saved when connection is restored.');
      } else if (error?.message?.includes('timeout')) {
        setMessage('Request timed out. Please check your connection and try again.');
      } else {
        setMessage(`Error setting today's menu: ${error?.message || 'Unknown error'}. Please check Firestore security rules.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromMenu = async (itemId) => {
    setLoading(true);
    setMessage('');

    try {
      const today = new Date().toISOString().split('T')[0];
      const todaysMenuRef = doc(db, 'todaysMenu', today);

      // Remove the item from today's menu
      const updatedMenu = todaysMenu.filter(item => item.id !== itemId);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      await Promise.race([
        setDoc(todaysMenuRef, {
          date: today,
          items: updatedMenu,
          updatedAt: new Date().toISOString(),
        }),
        timeoutPromise
      ]);

      setTodaysMenu(updatedMenu);
      setSelectedItems(prev => prev.filter(id => id !== itemId));
      setMessage('Item removed from today\'s menu successfully!');
    } catch (error) {
      console.error('Error removing item from menu:', error);
      setMessage('Error removing item from menu');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="mm-container">
      {onBack && <EnhancedBackButton onBack={onBack} />}
      <header className="mm-header">
        <div style={{ flex: 1 }}></div>
        <h1 className="mm-title">Menu Management</h1>
        <div style={{ flex: 1 }}></div>
      </header>

      <main className="mm-body">
        {/* Left Column: Form */}
        <div className="mm-form-section">
          <h2 className="mm-section-title">Add Menu Item</h2>
          
          <form onSubmit={handleAddMenuItem} className="mm-form">
            <div className="mm-input-group">
              <label className="mm-label">Dish Name</label>
              <input
                type="text"
                name="name"
                className="mm-input"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Dal Bhat"
                required
              />
            </div>

            <div className="mm-input-group">
              <label className="mm-label">Price (रु)</label>
              <input
                type="number"
                name="price"
                className="mm-input"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="e.g., 150"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="mm-input-group">
              <label className="mm-label">Description</label>
              <textarea
                name="description"
                className="mm-textarea"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the dish..."
                rows="3"
                required
              />
            </div>

            <div className="mm-input-group">
              <label className="mm-label">Category</label>
              <select
                name="category"
                className="mm-select"
                value={formData.category}
                onChange={handleInputChange}
                required
              >
                <option value="Breakfast">Breakfast</option>
                <option value="Meal">Meal</option>
                <option value="Dinner">Dinner</option>
                <option value="Snacks">Snacks</option>
                <option value="Drinks">Drinks</option>
              </select>
            </div>

            <div className="mm-input-group">
              <label className="mm-label">Food Photo</label>
              <div className="mm-file-input-wrapper">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="mm-file-input"
                />
              </div>
              {photoPreview && (
                <div className="mm-preview-container">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="mm-preview-img"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="mm-remove-preview"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <button type="submit" className="mm-btn mm-btn-primary" disabled={loading}>
              {loading ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'Add Menu Item'}
            </button>
          </form>

          {message && (
            <div className={`mm-message ${message.toLowerCase().includes('success') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </div>

        {/* Right Column: Menu List */}
        <div className="mm-content-section">
          
          {/* Toolbar */}
          <div className="mm-toolbar">
            <h2 className="mm-section-title" style={{ margin: 0, border: 'none' }}>
              All Menu Items ({menuItems.length})
            </h2>
            
            <div className="mm-stats">
              {selectedItems.length} selected
            </div>

            <div className="mm-actions">
              <button
                onClick={handleSelectAll}
                className="mm-btn mm-btn-secondary"
                disabled={loading || menuItems.length === 0}
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                className="mm-btn mm-btn-secondary"
                disabled={loading || selectedItems.length === 0}
              >
                Deselect All
              </button>
              <button
                onClick={handleSetTodaysMenu}
                className="mm-btn mm-btn-primary"
                disabled={loading || selectedItems.length === 0}
              >
                {loading ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : "Set Today's Special"}
              </button>
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="mm-grid">
            {menuItems.map((item) => {
              const isSelected = selectedItems.includes(item.id);
              const isInTodaysMenu = todaysMenu.some(menuItem => menuItem.id === item.id);

              return (
                <div 
                  key={item.id} 
                  className={`mm-card ${isSelected ? 'selected' : ''} ${isInTodaysMenu ? 'todays-special' : ''}`}
                >
                  <label className="mm-card-select">
                    <input
                      type="checkbox"
                      className="mm-checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelection(item.id)}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      {isInTodaysMenu ? 'In Menu' : 'Select'}
                    </span>
                  </label>

                  <div className="mm-card-img-wrapper">
                    {item.photoURL ? (
                      <img
                        src={item.photoURL}
                        alt={item.name}
                        className="mm-card-img"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eee', color: '#999' }}>
                        No Image
                      </div>
                    )}
                  </div>
                  
                  <h3 className="mm-card-title">{item.name}</h3>
                  <div className="mm-card-category">{item.category || 'Uncategorized'}</div>
                  <p className="mm-card-desc">{item.description}</p>
                  <div className="mm-card-price">
                    रु {item.price != null ? Number(item.price).toFixed(2) : '0.00'}
                  </div>

                  <div className="mm-card-actions">
                    <button
                        type="button"
                        onClick={() => handleToggleFixed(item.id, item.isFixed)}
                        className={`mm-btn ${item.isFixed ? 'mm-btn-success' : 'mm-btn-secondary'}`}
                        style={{ width: '100%', marginBottom: '0.5rem' }}
                    >
                        {item.isFixed ? '★ Fixed Menu' : '☆ Making Fixed'}
                    </button>
                    <button
                      onClick={() => handleDeleteMenuItem(item.id)}
                      className="mm-btn mm-btn-danger"
                      style={{ width: '100%' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {menuItems.length === 0 && (
            <div className="nu-empty">
              No menu items yet. Add your first menu item from the form.
            </div>
          )}
          
          {/* Today's Menu Preview Section */}
          {todaysMenu.length > 0 && (
            <div style={{ marginTop: '3rem' }}>
               <h2 className="mm-section-title">Today's Special ({todaysMenu.length})</h2>
               <div className="mm-grid">
                 {todaysMenu.map((item, index) => (
                    <div key={item.id || index} className="mm-card todays-special">
                      <div className="mm-card-img-wrapper">
                        {item.photoURL ? (
                          <img
                            src={item.photoURL}
                            alt={item.name}
                            className="mm-card-img"
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eee', color: '#999' }}>
                            No Image
                          </div>
                        )}
                      </div>
                      <h3 className="mm-card-title">{item.name}</h3>
                      <div className="mm-card-category">{item.category || 'Uncategorized'}</div>
                      <div className="mm-card-price">
                        रु {item.price != null ? Number(item.price).toFixed(2) : '0.00'}
                      </div>
                      <div className="mm-card-actions">
                        <button
                          onClick={() => handleRemoveFromMenu(item.id)}
                          className="mm-btn mm-btn-remove"
                          disabled={loading}
                        >
                          {loading ? <LoadingSpinner size="16" stroke="2" color="currentColor" /> : 'Remove from Special'}
                        </button>
                      </div>
                    </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}

export default MenuManagement;


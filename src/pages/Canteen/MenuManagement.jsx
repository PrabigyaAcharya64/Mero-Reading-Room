import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, getDoc, query, where, deleteDoc } from 'firebase/firestore';
import { validateMenuItemName, validatePrice, validateDescription, validateCategory } from '../../utils/validation';

const IMGBB_API_KEY = 'f3836c3667cc5c73c64e1aa4f0849566';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

function MenuManagement({ onBack }) {
  const { user, signOutUser } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Canteen Staff';
  
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

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="landing-screen">
      <header className="landing-header">
        <p className="landing-greeting">
          {onBack && (
            <button 
              type="button" 
              onClick={onBack}
              style={{ 
                marginRight: '1rem', 
                padding: '0.5rem 1rem', 
                background: '#f0f0f0', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ← Back
            </button>
          )}
          Hey <span>{displayName}</span>!
        </p>
        <div className="landing-status">
          <button type="button" className="landing-profile" aria-label="Profile">
            <img src={profileIcon} alt="" />
          </button>
          <button type="button" className="landing-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="landing-body" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <section style={{ marginBottom: '30px' }}>
          <h2>Add New Menu Item</h2>
          <form onSubmit={handleAddMenuItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
            <label className="input-field">
              <span className="input-field__label">Dish Name</span>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Dal Bhat"
                required
              />
            </label>

            <label className="input-field">
              <span className="input-field__label">Price (रु)</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="e.g., 150"
                step="0.01"
                min="0"
                required
              />
            </label>

            <label className="input-field">
              <span className="input-field__label">Description</span>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the dish..."
                rows="3"
                required
                style={{ width: '100%', padding: '10px', fontFamily: 'inherit', fontSize: 'inherit' }}
              />
            </label>

            <label className="input-field">
              <span className="input-field__label">Category</span>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '10px', fontFamily: 'inherit', fontSize: 'inherit' }}
              >
                <option value="Breakfast">Breakfast</option>
                <option value="Meal">Meal</option>
                <option value="Dinner">Dinner</option>
                <option value="Snacks">Snacks</option>
                <option value="Drinks">Drinks</option>
              </select>
            </label>

            <label className="input-field">
              <span className="input-field__label">Food Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ width: '100%', padding: '10px', fontFamily: 'inherit', fontSize: 'inherit' }}
              />
              {photoPreview && (
                <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                  <img 
                    src={photoPreview} 
                    alt="Preview" 
                    style={{ 
                      maxWidth: '200px', 
                      maxHeight: '200px', 
                      borderRadius: '8px',
                      border: '1px solid #ddd'
                    }} 
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      backgroundColor: '#f44',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </label>

            <button type="submit" className="cta-button cta-button--primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Menu Item'}
            </button>
          </form>

          {message && (
            <p style={{ marginTop: '15px', padding: '10px', backgroundColor: message.includes('Error') ? '#fee' : '#efe', borderRadius: '4px' }}>
              {message}
            </p>
          )}
        </section>

        <section style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h2>All Menu Items ({menuItems.length})</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>
                {selectedItems.length} selected
              </span>
              <button 
                onClick={handleSelectAll}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                disabled={loading || menuItems.length === 0}
              >
                Select All
              </button>
              <button 
                onClick={handleDeselectAll}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                disabled={loading || selectedItems.length === 0}
              >
                Deselect All
              </button>
              <button 
                onClick={handleSetTodaysMenu} 
                className="cta-button cta-button--primary"
                disabled={loading || selectedItems.length === 0}
              >
                Set Selected as Today's Menu ({selectedItems.length})
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {menuItems.map((item) => {
              const isSelected = selectedItems.includes(item.id);
              const isInTodaysMenu = todaysMenu.some(menuItem => menuItem.id === item.id);
              
              return (
                <div key={item.id} style={{ 
                  border: isSelected ? '2px solid #4a4' : isInTodaysMenu ? '2px solid #4aa' : '1px solid #ddd', 
                  borderRadius: '8px', 
                  padding: '15px',
                  backgroundColor: isSelected ? '#f0fff0' : isInTodaysMenu ? '#f0f8ff' : '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  position: 'relative'
                }}>
                  <label style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    zIndex: 1
                  }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelection(item.id)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      {isInTodaysMenu ? 'In Menu' : 'Select'}
                    </span>
                  </label>
                  
                  {item.photoURL && (
                    <img 
                      src={item.photoURL} 
                      alt={item.name}
                      style={{
                        width: '100%',
                        height: '200px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        marginBottom: '10px'
                      }}
                    />
                  )}
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{item.name}</h3>
                  <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
                    {item.category || 'Uncategorized'}
                  </p>
                  <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>{item.description}</p>
                  <p style={{ margin: '0 0 15px 0', fontSize: '20px', fontWeight: 'bold', color: '#111' }}>
                    रु {item.price != null ? Number(item.price).toFixed(2) : '0.00'}
                  </p>
                  <button 
                    onClick={() => handleDeleteMenuItem(item.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f44',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>

          {menuItems.length === 0 && (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              No menu items yet. Add your first menu item above.
            </p>
          )}
        </section>

        <section>
          <h2>Today's Menu ({todaysMenu.length} items)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {todaysMenu.map((item, index) => (
              <div key={item.id || index} style={{ 
                border: '2px solid #4a4', 
                borderRadius: '8px', 
                padding: '15px',
                backgroundColor: '#f0fff0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                position: 'relative'
              }}>
                {item.photoURL && (
                  <img 
                    src={item.photoURL} 
                    alt={item.name}
                    style={{
                      width: '100%',
                      height: '200px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      marginBottom: '10px'
                    }}
                  />
                )}
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{item.name}</h3>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
                  {item.category || 'Uncategorized'}
                </p>
                <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>{item.description}</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '20px', fontWeight: 'bold', color: '#111' }}>
                  रु {item.price != null ? Number(item.price).toFixed(2) : '0.00'}
                </p>
                <button 
                  onClick={() => handleRemoveFromMenu(item.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ff8800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                  disabled={loading}
                >
                  Remove from Menu
                </button>
              </div>
            ))}
          </div>

          {todaysMenu.length === 0 && (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              No menu set for today. Click "Set as Today's Menu" to set today's menu.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default MenuManagement;


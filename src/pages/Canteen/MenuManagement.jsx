import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, getDoc, query, where, deleteDoc } from 'firebase/firestore';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

function MenuManagement() {
  const { user, signOutUser } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Canteen Staff';
  
  const [menuItems, setMenuItems] = useState([]);
  const [todaysMenu, setTodaysMenu] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadMenuItems();
    loadTodaysMenu();
  }, []);

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
      
      if (todaysMenuDoc && todaysMenuDoc.exists) {
        const data = todaysMenuDoc.data();
        setTodaysMenu(data.items || []);
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

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.description) {
      setMessage('Please fill all fields');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const price = parseFloat(formData.price);
      if (isNaN(price) || price <= 0) {
        setMessage('Please enter a valid price');
        setLoading(false);
        return;
      }

      // Add timeout to prevent hanging (increased to 15 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      await Promise.race([
        addDoc(collection(db, 'menuItems'), {
          name: formData.name.trim(),
          price: price,
          description: formData.description.trim(),
          createdAt: new Date().toISOString(),
        }),
        timeoutPromise
      ]);

      setFormData({ name: '', price: '', description: '' });
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

  const handleSetTodaysMenu = async () => {
    if (menuItems.length === 0) {
      setMessage('No menu items available. Please add menu items first.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const todaysMenuRef = doc(db, 'todaysMenu', today);
      
      // Ensure all items have proper structure with id
      const itemsToSet = menuItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        description: item.description,
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
      setMessage('Today\'s menu set successfully!');
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>All Menu Items ({menuItems.length})</h2>
            <button 
              onClick={handleSetTodaysMenu} 
              className="cta-button cta-button--primary"
              disabled={loading || menuItems.length === 0}
            >
              Set as Today's Menu
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {menuItems.map((item) => (
              <div key={item.id} style={{ 
                border: '1px solid #ddd', 
                borderRadius: '8px', 
                padding: '15px',
                backgroundColor: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>{item.name}</h3>
                <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>{item.description}</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '20px', fontWeight: 'bold', color: '#111' }}>
                  रु {item.price.toFixed(2)}
                </p>
                <button 
                  onClick={() => handleDeleteMenuItem(item.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f44',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
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
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>{item.name}</h3>
                <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>{item.description}</p>
                <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#111' }}>
                  रु {item.price.toFixed(2)}
                </p>
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


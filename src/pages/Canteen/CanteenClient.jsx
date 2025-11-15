import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, collection, addDoc } from 'firebase/firestore';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

function CanteenClient({ onBack }) {
  const { user, signOutUser, userBalance, deductBalance } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Reader';
  const [todaysMenu, setTodaysMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [ordering, setOrdering] = useState(false);
  const [orderMessage, setOrderMessage] = useState('');
  const [orderNote, setOrderNote] = useState('');
  
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysMenuRef = doc(db, 'todaysMenu', today);
    
    // Set up real-time listener for menu updates
    const unsubscribe = onSnapshot(
      todaysMenuRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.items) {
            setTodaysMenu(data.items);
          } else {
            setTodaysMenu([]);
          }
        } else {
          setTodaysMenu([]);
        }
      },
      (error) => {
        // Handle different error types
        console.error('Error listening to menu updates:', error);
        if (error?.code === 'permission-denied') {
          console.error('Permission denied: Firestore security rules are blocking access. Please check rules in Firebase Console.');
          setTodaysMenu([]);
        } else if (error?.code === 'unavailable' || error?.code === 'failed-precondition' || error?.message?.includes('offline')) {
          console.warn('Firestore is offline. Menu will load when connection is restored.');
          setTodaysMenu([]);
        } else {
          console.error('Error loading today\'s menu:', error);
          setTodaysMenu([]);
        }
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const addToCart = (item) => {
    setCart(prev => {
      const existingItem = prev.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setOrderMessage('Your cart is empty');
      return;
    }

    const total = getCartTotal();
    if (userBalance < total) {
      setOrderMessage('Insufficient balance. Please add more credit.');
      return;
    }

    setOrdering(true);
    setOrderMessage('');

    try {
      // Deduct balance
      const success = await deductBalance(total);
      if (!success) {
        setOrderMessage('Failed to process payment. Please try again.');
        setOrdering(false);
        return;
      }

      // Create order
      await addDoc(collection(db, 'orders'), {
        userId: user.uid,
        userEmail: user.email,
        userName: displayName,
        items: cart,
        total: total,
        status: 'pending',
        note: orderNote.trim() || null,
        location: null, // Will be set when hostel/reading room features are added
        createdAt: new Date().toISOString(),
      });

      setOrderMessage('Order placed successfully!');
      setCart([]);
      setOrderNote('');
    } catch (error) {
      console.error('Error placing order:', error);
      if (error?.code === 'permission-denied') {
        setOrderMessage('Permission denied. Please check Firestore security rules. You must be authenticated.');
      } else if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
        setOrderMessage('Offline: Order will be saved when connection is restored.');
      } else {
        setOrderMessage(`Error placing order: ${error?.message || 'Unknown error'}. Please check Firestore security rules.`);
      }
    } finally {
      setOrdering(false);
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
          <div className="landing-balance" aria-label="Current balance">
            <div className="landing-balance__label">Balance</div>
            <div className="landing-balance__value">रु {userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <button type="button" className="landing-balance__add" aria-label="Add to balance">
              +
            </button>
          </div>
          <button type="button" className="landing-profile" aria-label="Profile">
            <img src={profileIcon} alt="" />
          </button>
          <button type="button" className="landing-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="landing-body" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {onBack && (
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={onBack}
              style={{
                padding: '10px 20px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Back to Home
            </button>
          </div>
        )}
        <section style={{ marginBottom: '30px' }}>
          <h2>Today's Menu</h2>
          {todaysMenu.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              {todaysMenu.map((item, index) => (
                <div key={item.id || index} style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>{item.name}</h3>
                  <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>{item.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#111' }}>
                      रु {item.price.toFixed(2)}
                    </p>
                    <button
                      onClick={() => addToCart(item)}
                      className="cta-button cta-button--primary"
                      style={{ padding: '8px 16px', fontSize: '14px' }}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="landing-announcements__empty">
              No menu available for today.
            </div>
          )}

          {cart.length > 0 && (
            <div style={{
              border: '2px solid #4a4',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#f0fff0',
              marginTop: '20px'
            }}>
              <h3 style={{ margin: '0 0 15px 0' }}>Your Cart ({cart.length} items)</h3>
              {cart.map((item) => (
                <div key={item.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid #ddd'
                }}>
                  <div>
                    <p style={{ margin: '0', fontWeight: 'bold' }}>{item.name}</p>
                    <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
                      रु {item.price.toFixed(2)} × {item.quantity} = रु {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                      style={{ padding: '5px 10px', fontSize: '18px' }}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                      style={{ padding: '5px 10px', fontSize: '18px' }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      style={{ padding: '5px 10px', marginLeft: '10px', backgroundColor: '#f44', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #4a4' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                    Add Note (Optional)
                  </label>
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Any special instructions or notes for your order..."
                    rows="3"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                    maxLength={500}
                  />
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                    {orderNote.length}/500 characters
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <strong style={{ fontSize: '18px' }}>Total:</strong>
                  <strong style={{ fontSize: '20px' }}>रु {getCartTotal().toFixed(2)}</strong>
                </div>
                {orderMessage && (
                  <p style={{
                    padding: '10px',
                    backgroundColor: orderMessage.includes('success') ? '#dfd' : '#fdd',
                    borderRadius: '4px',
                    marginBottom: '10px'
                  }}>
                    {orderMessage}
                  </p>
                )}
                <button
                  onClick={handlePlaceOrder}
                  disabled={ordering || userBalance < getCartTotal()}
                  className="cta-button cta-button--primary"
                  style={{ width: '100%', padding: '12px' }}
                >
                  {ordering ? 'Placing Order...' : userBalance < getCartTotal() ? 'Insufficient Balance' : 'Place Order'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default CanteenClient;


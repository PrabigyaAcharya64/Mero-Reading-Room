<<<<<<< HEAD
import { useState, useEffect, useRef } from 'react';
=======
import { useState, useEffect } from 'react';
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { validateOrderNote } from '../../utils/validation';

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
  
<<<<<<< HEAD
  // Hover and Focus state for cards
  const [hoveredCard, setHoveredCard] = useState(null);
  const [focusedCardId, setFocusedCardId] = useState(null);
  const itemsRef = useRef(new Map());
  const scrollContainerRefs = useRef(new Map()); // Handle multiple categories

  // Menu Data Listener
=======
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysMenuRef = doc(db, 'todaysMenu', today);
    
<<<<<<< HEAD
=======
    // Set up real-time listener for menu updates
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
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
<<<<<<< HEAD
        console.error('Error listening to menu updates:', error);
        if (error?.code === 'permission-denied') {
          console.error('Permission denied: Firestore security rules are blocking access.');
          setTodaysMenu([]);
        } else if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
          console.warn('Firestore is offline.');
=======
        // Handle different error types
        console.error('Error listening to menu updates:', error);
        if (error?.code === 'permission-denied') {
          console.error('Permission denied: Firestore security rules are blocking access. Please check rules in Firebase Console.');
          setTodaysMenu([]);
        } else if (error?.code === 'unavailable' || error?.code === 'failed-precondition' || error?.message?.includes('offline')) {
          console.warn('Firestore is offline. Menu will load when connection is restored.');
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
          setTodaysMenu([]);
        } else {
          console.error('Error loading today\'s menu:', error);
          setTodaysMenu([]);
        }
      }
    );

<<<<<<< HEAD
=======
    
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
    return () => {
      unsubscribe();
    };
  }, []);

<<<<<<< HEAD
  const handleScroll = (categoryId) => {
    const container = scrollContainerRefs.current.get(categoryId);
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    let closestId = null;
    let minDistance = Infinity;

    // We only want to check items belonging to THIS category's container
    // But itemsRef is a flat map. We can iterate it and check if the node is a descendant of the container
    // OR, cleaner: just querySelectorAll inside the container?
    // OR: Filter itemsRef based on some logic.
    // Simplest: `container.children` loop.
    
    Array.from(container.children).forEach((child) => {
        const id = child.getAttribute('data-id');
        if (id) {
            const rect = child.getBoundingClientRect();
            const childCenter = rect.left + rect.width / 2;
            const distance = Math.abs(containerCenter - childCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestId = id;
            }
        }
    });

    if (closestId) {
        setFocusedCardId(closestId);
    }
  };

  // Trigger initial focus check when menu changes
  useEffect(() => {
    // Small timeout to ensure DOM is rendered and layout is stable
    const timer = setTimeout(() => {
        // Run check for all categories
        scrollContainerRefs.current.forEach((_, categoryId) => {
            handleScroll(categoryId);
        });
    }, 100);
    return () => clearTimeout(timer);
  }, [todaysMenu]);

=======
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
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
<<<<<<< HEAD
=======
      
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
      const success = await deductBalance(total);
      if (!success) {
        setOrderMessage('Failed to process payment. Please try again.');
        setOrdering(false);
        return;
      }

<<<<<<< HEAD
=======
      // Validate and sanitize order note
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
      let sanitizedNote = null;
      if (orderNote && orderNote.trim()) {
        const noteValidation = validateOrderNote(orderNote, 500);
        if (!noteValidation.valid) {
          setOrderMessage(noteValidation.error);
          setOrdering(false);
          return;
        }
        sanitizedNote = noteValidation.sanitized || null;
      }

<<<<<<< HEAD
=======
      // Create order
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
      await addDoc(collection(db, 'orders'), {
        userId: user.uid,
        userEmail: user.email,
        userName: displayName,
        items: cart,
        total: total,
        status: 'pending',
        note: sanitizedNote,
<<<<<<< HEAD
        location: null,
=======
        location: null, // Will be set when hostel/reading room features are added
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
        createdAt: new Date().toISOString(),
      });

      setOrderMessage('Order placed successfully!');
      setCart([]);
      setOrderNote('');
    } catch (error) {
      console.error('Error placing order:', error);
      if (error?.code === 'permission-denied') {
<<<<<<< HEAD
        setOrderMessage('Permission denied. You must be authenticated.');
      } else if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
        setOrderMessage('Offline: Order will be saved when connection is restored.');
      } else {
        setOrderMessage(`Error placing order: ${error?.message || 'Unknown error'}.`);
=======
        setOrderMessage('Permission denied. Please check Firestore security rules. You must be authenticated.');
      } else if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
        setOrderMessage('Offline: Order will be saved when connection is restored.');
      } else {
        setOrderMessage(`Error placing order: ${error?.message || 'Unknown error'}. Please check Firestore security rules.`);
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
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

<<<<<<< HEAD
=======
  // Group menu items by category
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
  const groupedMenu = todaysMenu.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

<<<<<<< HEAD
=======
  // Define category order
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
  const categoryOrder = ['Breakfast', 'Meal', 'Dinner', 'Snacks', 'Drinks'];
  const sortedCategories = categoryOrder.filter(cat => groupedMenu[cat]?.length > 0);

  return (
    <div className="landing-screen">
      <header className="landing-header">
<<<<<<< HEAD
        {/* Left: Back Button */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            {onBack && (
                <button
                    onClick={onBack}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        background: '#fff',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        color: '#000',
                        fontFamily: 'var(--brand-font-body)',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                        e.currentTarget.style.borderColor = '#d0d0d0';
                        e.currentTarget.style.transform = 'translateX(-2px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.transform = 'translateX(0)';
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back
                </button>
            )}
        </div>

        {/* Center: Greeting */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <p className="landing-greeting" style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Hey <span>{displayName}</span>!
            </p>
        </div>

        {/* Right: Status */}
        <div className="landing-status" style={{ flex: 1, justifyContent: 'flex-end' }}>
=======
        <p className="landing-greeting">
          Hey <span>{displayName}</span>!
        </p>
        <div className="landing-status">
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
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
<<<<<<< HEAD
=======
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
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
        <section style={{ marginBottom: '30px' }}>
          <h2>Today's Menu</h2>
          {todaysMenu.length > 0 ? (
            <div style={{ marginBottom: '30px' }}>
              {sortedCategories.map((category) => (
                <div key={category} style={{ marginBottom: '40px' }}>
                  <h3 style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    marginBottom: '20px', 
                    paddingBottom: '10px',
                    borderBottom: '2px solid #4a4',
                    color: '#111'
                  }}>
                    {category}
                  </h3>
<<<<<<< HEAD
                  <div 
                    ref={(el) => {
                        if(el) scrollContainerRefs.current.set(category, el);
                        else scrollContainerRefs.current.delete(category);
                    }}
                    onScroll={() => handleScroll(category)}
                    style={{ 
                    display: 'flex', 
                    overflowX: 'auto', 
                    scrollSnapType: 'x mandatory',
                    gap: '12px',
                    padding: '24px calc((100% - 85%) / 2)', 
                    alignItems: 'center',
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none',
                    minHeight: '400px',
                  }}>
                    {groupedMenu[category].map((item, index) => {
                       const itemId = item.id || index;
                       const isFocused = focusedCardId == itemId;
                       return (
                      <div 
                        key={itemId}
                        data-id={itemId}
                        ref={(node) => {
                          if (node) itemsRef.current.set(itemId, node);
                          else itemsRef.current.delete(itemId);
                        }}
                        onClick={(e) => {
                          e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                        }}
                        style={{
                          flex: '0 0 85%',
                          maxWidth: '380px',
                          scrollSnapAlign: 'center',
                          backgroundColor: '#fff',
                          borderRadius: '20px',
                          cursor: 'pointer', // Indicate click-to-focus
                          boxShadow: isFocused
                            ? '0 20px 40px rgba(0,0,0,0.15)'
                            : '0 8px 16px rgba(0,0,0,0.05)',
                          overflow: 'hidden',
                          border: isFocused ? '1px solid #e0e0e0' : '1px solid transparent',
                          transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
                          transform: isFocused ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(0)',
                          opacity: isFocused ? 1 : 0.6,
                          filter: isFocused ? 'grayscale(0%)' : 'grayscale(20%)',
                          display: 'flex',
                          flexDirection: 'column',
                          height: 'auto',
                          position: 'relative',
                          zIndex: isFocused ? 2 : 1,
                        }}
                        onMouseEnter={() => setHoveredCard(itemId)}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        {item.photoURL ? (
=======
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                    {groupedMenu[category].map((item, index) => (
                      <div key={item.id || index} style={{
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        padding: '15px',
                        backgroundColor: '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        {item.photoURL && (
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
                          <img 
                            src={item.photoURL} 
                            alt={item.name}
                            style={{
                              width: '100%',
<<<<<<< HEAD
                              height: '220px',
                              objectFit: 'cover',
                              borderBottom: '1px solid #f0f0f0'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '220px',
                            backgroundColor: '#fafafa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                             <span style={{ fontSize: '48px', opacity: 0.2 }}>🍽️</span>
                          </div>
                        )}
                        
                        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <h4 style={{ 
                            margin: '0 0 8px 0', 
                            fontSize: '22px', 
                            fontWeight: '700',
                            color: '#111',
                            letterSpacing: '-0.5px'
                          }}>
                            {item.name}
                          </h4>
                          
                          <p style={{ 
                            margin: '0 0 24px 0', 
                            fontSize: '15px', 
                            color: '#666', 
                            lineHeight: '1.6',
                            flex: 1
                          }}>
                            {item.description || "Top-rated selection from our chefs."}
                          </p>
                          
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginTop: 'auto'
                          }}>
                            <p style={{ 
                              margin: '0', 
                              fontSize: '22px', 
                              fontWeight: '800', 
                              color: '#1a1a1a' 
                            }}>
                              रु {item.price.toFixed(2)}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(item);
                              }}
                              className="cta-button cta-button--primary"
                              style={{ 
                                padding: '12px 24px', 
                                fontSize: '15px',
                                borderRadius: '12px',
                                backgroundColor: '#111',
                                color: '#fff',
                                fontWeight: '600',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              }}
                              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                            >
                              Add +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                    })}
=======
                              height: '200px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              marginBottom: '10px'
                            }}
                          />
                        )}
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>{item.name}</h4>
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
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
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
<<<<<<< HEAD
                      style={{ padding: '5px 8px', fontSize: '18px', cursor: 'pointer' }}
=======
                      style={{ padding: '5px 10px', fontSize: '18px' }}
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
<<<<<<< HEAD
                      style={{ padding: '5px 8px', fontSize: '18px', cursor: 'pointer' }}
=======
                      style={{ padding: '5px 10px', fontSize: '18px' }}
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
<<<<<<< HEAD
                      style={{ padding: '5px 10px', marginLeft: '10px', backgroundColor: '#f44', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
=======
                      style={{ padding: '5px 10px', marginLeft: '10px', backgroundColor: '#f44', color: 'white', border: 'none', borderRadius: '4px' }}
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
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
<<<<<<< HEAD
=======

>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754

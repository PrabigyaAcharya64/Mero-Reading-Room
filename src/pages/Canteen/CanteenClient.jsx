import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, collection, addDoc, query, where } from 'firebase/firestore';
import { validateOrderNote } from '../../utils/validation';
import EnhancedBackButton from '../../components/EnhancedBackButton';

import CanteenMenu from "./CanteenMenu";
import CanteenCart from './CanteenCart';
import ClientOrderHistory from './ClientOrderHistory';
import '../../styles/CanteenLanding.css';

const foodIcon = new URL('../../assets/food.svg', import.meta.url).href;
const orderIcon = new URL('../../assets/order.svg', import.meta.url).href;

function CanteenClient({ onBack }) {
  const { user, userBalance, deductBalance } = useAuth();

  // View State: 'landing' | 'menu' | 'cart' | 'orders'
  const [currentView, setCurrentView] = useState('landing');

  const [todaysMenu, setTodaysMenu] = useState([]);
  const [fixedMenu, setFixedMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderMessage, setOrderMessage] = useState('');

  // ------------------------------------------------------------------
  // Data Fetching (Menu)
  // ------------------------------------------------------------------
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysMenuRef = doc(db, 'todaysMenu', today);

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
        console.error('Error listening to menu updates:', error);
        setTodaysMenu([]);
      }
    );

    return () => unsubscribe();
  }, []);

  // ------------------------------------------------------------------
  // Data Fetching (Fixed Menu)
  // ------------------------------------------------------------------
  useEffect(() => {
    const q = query(
      collection(db, 'menuItems'),
      where('isFixed', '==', true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFixedMenu(items);
      },
      (error) => {
        console.error('Error fetching fixed menu:', error);
        setFixedMenu([]);
      }
    );

    return () => unsubscribe();
  }, []);

  // ------------------------------------------------------------------
  // Cart Actions
  // ------------------------------------------------------------------
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

  const clearCart = () => setCart([]);

  // ------------------------------------------------------------------
  // Order Logic
  // ------------------------------------------------------------------
  const handlePlaceOrder = async (note) => {
    setOrderMessage('');
    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    try {
      if (userBalance < total) {
        setOrderMessage('Insufficient balance.');
        return;
      }


      const success = await deductBalance(total);
      if (!success) {
        setOrderMessage('Payment failed. Please try again.');
        return;
      }


      let sanitizedNote = null;
      if (note && note.trim()) {
        const noteValidation = validateOrderNote(note, 500);
        if (!noteValidation.valid) {
          setOrderMessage(noteValidation.error);
          return;
        }
        sanitizedNote = noteValidation.sanitized || null;
      }

      // Create Order
      await addDoc(collection(db, 'orders'), {
        userId: user.uid,
        userEmail: user.email,
        userName: user?.displayName || user?.email?.split('@')[0] || 'Reader',
        items: cart,
        total: total,
        status: 'pending',
        note: sanitizedNote,
        location: null,
        createdAt: new Date().toISOString(),
      });

      setOrderMessage('Order placed successfully!');
      clearCart();

      // Auto-navigate back to menu after success
      setTimeout(() => {
        setOrderMessage('');
        setCurrentView('menu');
      }, 2000);

    } catch (error) {
      console.error('Error placing order:', error);
      setOrderMessage(`Error: ${error.message}`);
    }
  };

  // ------------------------------------------------------------------
  // Render Views
  // ------------------------------------------------------------------

  if (currentView === 'menu') {
    return (
      <CanteenMenu
        onBack={() => setCurrentView('landing')}
        onNavigate={setCurrentView}
        todaysMenu={todaysMenu}
        fixedMenu={fixedMenu}
        cart={cart}
        addToCart={addToCart}
        userBalance={userBalance}
      />
    );
  }

  if (currentView === 'cart') {
    return (
      <CanteenCart
        onBack={() => setCurrentView('menu')}
        onNavigate={setCurrentView}
        cart={cart}
        updateQuantity={updateCartQuantity}
        removeFromCart={removeFromCart}
        userBalance={userBalance}
        placeOrder={handlePlaceOrder}
        orderMessage={orderMessage}
      />
    );
  }

  if (currentView === 'orders') {
    return <ClientOrderHistory onBack={() => setCurrentView('landing')} />;
  }

  // Default: Landing (Inlined)
  return (
    <div className="canteen-landing">
      <EnhancedBackButton onBack={onBack} />
      <div className="canteen-header">
        <h1 className="header-title" style={{ flex: 1, textAlign: 'center' }}>Canteen</h1>

        <div className="landing-balance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#888', letterSpacing: '0.5px' }}>Balance</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            Rs. {(userBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="canteen-content">
        <div className="canteen-buttons-wrapper">
          <button
            className="canteen-main-button"
            onClick={() => setCurrentView('menu')}
          >
            <div className="button-icon-wrapper">
              <img src={foodIcon} alt="Menu" style={{ width: 48, height: 48, objectFit: 'contain' }} />
            </div>
            <span className="button-text">Menu</span>
          </button>

          <button
            className="canteen-main-button"
            onClick={() => setCurrentView('orders')}
          >
            <div className="button-icon-wrapper">
              <img src={orderIcon} alt="Orders" style={{ width: 48, height: 48, objectFit: 'contain' }} />
            </div>
            <span className="button-text">Orders</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CanteenClient;
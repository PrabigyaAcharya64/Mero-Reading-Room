import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { validateOrderNote } from '../../utils/validation';
import { getBusinessDate } from '../../utils/dateUtils';
import EnhancedBackButton from '../../components/EnhancedBackButton';

import CanteenMenu from "./CanteenMenu";
import CanteenCart from './CanteenCart';
import ClientOrderHistory from './ClientOrderHistory';
import PageHeader from '../../components/PageHeader';
import '../../styles/CanteenLanding.css';
import '../../styles/StandardLayout.css';

const foodIcon = new URL('../../assets/food.svg', import.meta.url).href;
const orderIcon = new URL('../../assets/order.svg', import.meta.url).href;

function CanteenClient({ onBack }) {
  const { user, userBalance } = useAuth();

  const [currentView, setCurrentView] = useState('landing');

  const [todaysMenu, setTodaysMenu] = useState([]);
  const [fixedMenu, setFixedMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderMessage, setOrderMessage] = useState('');

  useEffect(() => {
    const today = getBusinessDate();
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

    // Calculate total on client side for initial feedback
    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    try {
      if (userBalance < total) {
        setOrderMessage('Insufficient balance.');
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

      // Call Cloud Function to process order
      const processOrder = httpsCallable(functions, 'processCanteenOrder');
      const result = await processOrder({
        cart: cart,
        note: sanitizedNote
      });

      const { success } = result.data;

      if (success) {
        setOrderMessage('Order placed successfully!');
        clearCart();

        // Auto-navigate back to menu after success
        setTimeout(() => {
          setOrderMessage('');
          setCurrentView('menu');
        }, 2000);
      }

    } catch (error) {
      console.error('Error placing order:', error);
      // Remove "Error:" prefix or handle specific error codes
      const errMsg = error.message || 'Failed to place order.';
      setOrderMessage(errMsg.replace('Error: ', ''));
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
    <div className="std-container">
      <PageHeader title="Canteen" onBack={onBack} />

      <main className="std-body">
        <div className="discussion-card">
          <h1 className="page-title">Canteen Services</h1>
          <p className="page-subtitle">
            Order food or view your transaction history.
          </p>

          <div className="landing-services__grid" style={{ marginTop: '24px' }}>
            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('menu')}
            >
              <span className="landing-service-card__icon">
                <img src={foodIcon} alt="" aria-hidden="true" style={{ width: '32px', height: '32px' }} />
              </span>
              <span className="landing-service-card__label">Menu</span>
            </button>
            <button
              type="button"
              className="landing-service-card"
              onClick={() => setCurrentView('orders')}
            >
              <span className="landing-service-card__icon">
                <img src={orderIcon} alt="" aria-hidden="true" style={{ width: '32px', height: '32px' }} />
              </span>
              <span className="landing-service-card__label">My Orders</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default CanteenClient;
import React, { useState, useEffect } from 'react';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, collection, query, where, getDocs, limit, getDoc } from 'firebase/firestore';
import { validateOrderNote } from '../../utils/validation';
import { getBusinessDate } from '../../utils/dateUtils';
import Button from '../../components/Button';
import CanteenMenu from '../canteen/CanteenMenu';
import CanteenCart from '../canteen/CanteenCart';
import { Search, User, CreditCard, ArrowLeft } from 'lucide-react';
import '../../styles/CanteenLanding.css';
import '../../styles/StandardLayout.css';

const ProxyOrder = ({ onBack, onDataLoaded }) => {
    const [currentView, setCurrentView] = useState('user-search'); // user-search, menu, cart
    const [mrrSearch, setMrrSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [targetUser, setTargetUser] = useState(null);
    const [error, setError] = useState('');

    const [todaysMenu, setTodaysMenu] = useState([]);
    const [fixedMenu, setFixedMenu] = useState([]);
    const [cart, setCart] = useState([]);
    const [orderMessage, setOrderMessage] = useState('');

    // Fetch Menu (same as CanteenClient)
    useEffect(() => {
        const today = getBusinessDate();
        const todaysMenuRef = doc(db, 'todaysMenu', today);
        const fixedQ = query(collection(db, 'menuItems'), where('isFixed', '==', true));

        let todaysLoaded = false;
        let fixedLoaded = false;

        const checkIfLoaded = () => {
            if (todaysLoaded && fixedLoaded) {
                onDataLoaded?.();
            }
        };

        const unsubscribe = onSnapshot(todaysMenuRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setTodaysMenu(data?.items || []);
            } else {
                setTodaysMenu([]);
            }
            todaysLoaded = true;
            checkIfLoaded();
        });

        const unsubscribeFixed = onSnapshot(fixedQ, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFixedMenu(items);
            fixedLoaded = true;
            checkIfLoaded();
        });

        return () => {
            unsubscribe();
            unsubscribeFixed();
        };
    }, []);

    const handleSearchUser = async (e) => {
        e.preventDefault();
        if (!mrrSearch.trim()) return;

        setSearching(true);
        setError('');
        setTargetUser(null);

        try {
            const q = query(
                collection(db, 'users'),
                where('mrrNumber', '==', mrrSearch.trim().toUpperCase()),
                limit(1)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setError('User not found with this MRR ID.');
            } else {
                const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                if (!userData.verified) {
                    setError('This user is not verified yet.');
                } else {
                    setTargetUser(userData);
                    setCurrentView('menu');
                }
            }
        } catch (err) {
            console.error('Error searching user:', err);
            setError('Error searching for user.');
        } finally {
            setSearching(false);
        }
    };

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

    const handlePlaceOrder = async (note) => {
        setOrderMessage('');
        const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        try {
            if (targetUser.balance < total) {
                setOrderMessage('Insufficient balance for this user.');
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

            const processOrder = httpsCallable(functions, 'processCanteenOrder');
            const result = await processOrder({
                cart: cart,
                note: sanitizedNote,
                targetUserId: targetUser.id
            });

            if (result.data.success) {
                setOrderMessage('Proxy order placed successfully!');
                clearCart();
                setTimeout(() => {
                    setOrderMessage('');
                    onBack(); // Go back to landing or reset? User might want to place another order.
                }, 2000);
            }
        } catch (error) {
            console.error('Error placing proxy order:', error);
            setOrderMessage(error.message || 'Failed to place order.');
        }
    };

    if (currentView === 'user-search') {
        return (
            <div className="std-container">
                <main className="std-body">
                    {onBack && (
                        <div style={{ marginBottom: '1rem' }}>
                            <button
                                onClick={onBack}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem 1rem',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    color: '#374151',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                        </div>
                    )}
                    <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px', backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '20px', textAlign: 'center' }}>Find Client</h2>
                        <form onSubmit={handleSearchUser}>
                            <div style={{ position: 'relative', marginBottom: '15px' }}>
                                <input
                                    type="text"
                                    placeholder="Enter MRR ID (e.g. MRR123)"
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 40px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        fontSize: '1rem'
                                    }}
                                    value={mrrSearch}
                                    onChange={(e) => setMrrSearch(e.target.value)}
                                    autoFocus
                                />
                                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} size={20} />
                            </div>
                            {error && <p style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '15px', textAlign: 'center' }}>{error}</p>}
                            <Button
                                variant="primary"
                                fullWidth
                                type="submit"
                                loading={searching}
                                disabled={!mrrSearch.trim()}
                            >
                                {searching ? 'Searching...' : 'Search Client'}
                            </Button>
                        </form>
                    </div>
                </main>
            </div>
        );
    }

    if (currentView === 'menu') {
        return (
            <CanteenMenu
                onBack={() => setCurrentView('user-search')}
                onNavigate={setCurrentView}
                todaysMenu={todaysMenu}
                fixedMenu={fixedMenu}
                cart={cart}
                addToCart={addToCart}
                userBalance={targetUser.balance}
                userName={targetUser.name}
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
                userBalance={targetUser.balance}
                placeOrder={handlePlaceOrder}
                orderMessage={orderMessage}
                userName={targetUser.name}
            />
        );
    }

    return null;
};

export default ProxyOrder;

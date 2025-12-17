import React, { useState } from 'react';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import './CanteenCart.css';

const CanteenCart = ({ 
  onBack, 
  onNavigate, 
  cart, 
  updateQuantity, 
  removeFromCart, 
  userBalance,
  placeOrder,
  orderMessage
}) => {
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);

  // Total Calculation
  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const canPlaceOrder = cart.length > 0 && userBalance >= totalAmount && !placing;

  const handlePlaceOrder = async () => {
      setPlacing(true);
      await placeOrder(note);
      setPlacing(false);
  };

  return (
    <div className="canteen-cart-page">
      <div className="cart-header">
        <EnhancedBackButton onBack={onBack} />
        <h1 className="header-title" style={{ flex: 1, textAlign: 'center', margin: 0 }}>Your Cart</h1>
        <div style={{ width: '40px' }}></div> {/* Spacer to balance the layout */}
      </div>

      <div className="cart-balance-container">
        <span className="balance-label">Current Balance</span>
        <span className="balance-value">Rs. {userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      <div className="cart-content">
        {cart.length === 0 ? (
          <div className="empty-cart-state">
             <p>Your cart is empty</p>
             <button className="secondary-btn" onClick={() => onNavigate('menu')}>
                Go to Menu
             </button>
             <button className="secondary-btn" onClick={() => onNavigate('orders')} style={{marginTop: '10px'}}>
                View Orders
             </button>
          </div>
        ) : (
          <>
            <div className="cart-items-list">
               {cart.map(item => (
                 <div key={item.id} className="cart-item-card">
                    <div className="cart-item-info">
                        <div className="cart-item-name">{item.name}</div>
                        <div className="cart-item-price">Rs. {item.price.toFixed(2)} each</div>
                    </div>
                    
                    <div className="cart-item-actions">
                        <div className="quantity-controls">
                            <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                            <span className="qty-val">{item.quantity}</span>
                            <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                        </div>
                        <div className="item-total">
                            Rs. {(item.price * item.quantity).toFixed(2)}
                        </div>
                        <button className="remove-btn" onClick={() => removeFromCart(item.id)}>Remove</button>
                    </div>
                 </div>
               ))}
            </div>

            <div className="cart-summary-section">
                <div className="summary-row">
                    <span>Total Amount</span>
                    <span className="summary-total">Rs. {totalAmount.toFixed(2)}</span>
                </div>

                <div className="note-section">
                    <label>Add Note (Optional)</label>
                    <textarea 
                        className="note-input"
                        placeholder="Any special instructions..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                    />
                    <div className="char-count">{note.length}/500</div>
                </div>

                {orderMessage && (
                  <div className={`order-message ${orderMessage.includes('success') ? 'success' : 'error'}`}>
                    {orderMessage}
                  </div>
                )}

                <div className="cart-actions">
                    <button className="secondary-btn" onClick={() => onNavigate('orders')}>
                        View Orders
                    </button>
                    
                    <button 
                        className={`primary-btn ${!canPlaceOrder ? 'disabled' : ''}`}
                        onClick={handlePlaceOrder}
                        disabled={!canPlaceOrder}
                    >
                        {placing ? 'Placing Order...' : (userBalance < totalAmount ? 'Insufficient Balance' : 'Place Order')}
                    </button>
                </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CanteenCart;

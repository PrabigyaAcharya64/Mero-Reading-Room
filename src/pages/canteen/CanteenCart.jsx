import React, { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/Button';
import '../../styles/CanteenCart.css';
import '../../styles/StandardLayout.css';

const CanteenCart = ({
  onBack,
  onNavigate,
  cart,
  updateQuantity,
  removeFromCart,
  userBalance,
  placeOrder,
  orderMessage,
  userName
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
    <div className="std-container">
      <PageHeader title="Your Cart" onBack={onBack} forceShowBack={true} />

      <main className="std-body">
        <div className="discussion-card">
          <div className="menu-balance-container">
            <span className="balance-label">Available Balance</span>
            <span className="balance-value">रु {userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="cart-content">
            {cart.length === 0 ? (
              <div className="empty-cart-state">
                <p>Your cart is empty</p>
                <div className="empty-cart-actions">
                  <Button variant="secondary" onClick={() => onNavigate('menu')}>
                    Go to Menu
                  </Button>
                  <Button variant="secondary" onClick={() => onNavigate('orders')}>
                    View Orders
                  </Button>
                </div>
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
                        <Button variant="danger" size="sm" onClick={() => removeFromCart(item.id)}>Remove</Button>
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
                    <Button variant="secondary" onClick={() => onNavigate('orders')}>
                      View Orders
                    </Button>

                    <Button
                      variant="primary"
                      onClick={handlePlaceOrder}
                      disabled={!canPlaceOrder}
                      loading={placing}
                    >
                      {placing ? 'Placing Order...' : (userBalance < totalAmount ? 'Insufficient Balance' : 'Place Order')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CanteenCart;

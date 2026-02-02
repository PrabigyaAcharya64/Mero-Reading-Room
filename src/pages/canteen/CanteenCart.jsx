import React, { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/Button';
import { useAuth } from '../../auth/AuthProvider';
import { functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
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
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [calculation, setCalculation] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Total Calculation
  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const finalAmount = calculation ? calculation.finalPrice : totalAmount;

  const canPlaceOrder = cart.length > 0 && userBalance >= finalAmount && !placing;

  const handleCalculatePrice = async (code = '') => {
    setIsCalculating(true);
    setCouponError('');
    try {
      const calculatePayment = httpsCallable(functions, 'calculatePayment');
      const result = await calculatePayment({
        userId: user.uid,
        serviceType: 'canteen',
        amount: totalAmount,
        couponCode: code || null
      });
      setCalculation(result.data);
    } catch (err) {
      console.error(err);
      setCouponError(err.message || 'Failed to calculate price');
      setCalculation(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const handlePlaceOrder = async () => {
    setPlacing(true);
    await placeOrder(note, calculation ? couponCode : null);
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
                    <span className="summary-total">Rs. {finalAmount.toFixed(2)}</span>
                  </div>

                  {/* Coupon UI */}
                  <div className="coupon-section" style={{ borderTop: '1px solid #eee', paddingTop: '10px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input
                        type="text"
                        placeholder="Coupon Code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        disabled={isCalculating || !!calculation}
                        style={{ flex: 1, padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                      {calculation ? (
                        <Button size="sm" variant="danger" onClick={() => {
                          setCouponCode('');
                          setCalculation(null);
                          setCouponError('');
                        }}>X</Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleCalculatePrice(couponCode)}
                          disabled={!couponCode || isCalculating}
                        >
                          {isCalculating ? '...' : 'Apply'}
                        </Button>
                      )}
                    </div>
                    {couponError && <div style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>{couponError}</div>}
                    {calculation && calculation.discounts && (
                      <div style={{ marginTop: '5px' }}>
                        {calculation.discounts.map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'green' }}>
                            <span>{d.name}</span>
                            <span>- Rs. {d.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                      {placing ? 'Placing Order...' : (userBalance < finalAmount ? 'Insufficient Balance' : 'Place Order')}
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

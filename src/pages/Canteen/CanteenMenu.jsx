import React, { useState, useEffect, useRef } from 'react';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import './CanteenMenu.css';

const CanteenMenu = ({ 
  onBack, 
  onNavigate, 
  todaysMenu, 
  cart, 
  addToCart, 
  userBalance 
}) => {
  // Group menu by category
  const groupedMenu = todaysMenu.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const categoryOrder = ['Breakfast', 'Meal', 'Dinner', 'Snacks', 'Drinks'];
  const sortedCategories = categoryOrder.filter(cat => groupedMenu[cat]?.length > 0);
  
  // Add remaining categories that aren't in the predefined list
  Object.keys(groupedMenu).forEach(cat => {
    if (!categoryOrder.includes(cat) && !sortedCategories.includes(cat)) {
      sortedCategories.push(cat);
    }
  });

  return (
    <div className="canteen-menu-page">
      {/* Header */}
      <div className="menu-header">
        <EnhancedBackButton onBack={onBack} />
        <h1 className="header-title">Today's Menu</h1>
        <button className="cart-icon-btn" onClick={() => onNavigate('cart')}>
          <div className="cart-icon-wrapper">
             {/* Simple Cart Icon Placeholder */}
             <span style={{fontSize: '24px'}}>🛒</span>
             {cart.length > 0 && (
                <div className="cart-badge">{cart.length}</div>
             )}
          </div>
        </button>
      </div>

      {/* Balance */}
      <div className="menu-balance-container">
        <span className="balance-label">Balance</span>
        <span className="balance-value">Rs. {userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      {/* Menu Sections */}
      <div className="menu-scroll-container">
        {todaysMenu.length === 0 ? (
           <div className="empty-state">
              <p>No menu available for today.</p>
           </div>
        ) : (
          sortedCategories.map(category => {
            const items = groupedMenu[category];
            const itemCount = items.length;
            
            return (
              <div key={category} className="menu-category-section">
                <h2 className="category-title">{category}</h2>
                <div className={`horizontal-scroll-snap ${itemCount === 1 ? 'carousel-single' : itemCount === 2 ? 'carousel-double' : 'carousel-multiple'}`}>
                  {items.map(item => (
                    <div key={item.id} className="menu-item-card">
                      <div className="card-image-container">
                        <img 
                          src={item.photoURL || "/placeholder-food.png"} 
                          alt={item.name} 
                          className="card-food-image"
                          onError={(e) => { e.target.src = "https://placehold.co/400x300?text=Food"; }}
                        />
                      </div>
                      <div className="card-content">
                          <h3 className="card-food-name">{item.name}</h3>
                          <p className="card-food-desc">{item.description || 'Delicious meal'}</p>
                          
                          <div className="card-footer">
                              <span className="card-price">Rs. {item.price.toFixed(2)}</span>
                              <button 
                                  className="card-add-btn"
                                  onClick={() => addToCart(item)}
                              >
                                  Add to Cart
                              </button>
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CanteenMenu;
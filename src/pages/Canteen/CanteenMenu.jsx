import React, { useState, useEffect, useRef } from 'react';
import cartIcon from '../../assets/cart.svg';
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

  // Carousel component with center detection
  const FoodCarousel = ({ items, category }) => {
    const carouselRef = useRef(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const handleScroll = () => {
      const carousel = carouselRef.current;
      if (!carousel) return;

      // Calculate the true center of the visible area
      const carouselRect = carousel.getBoundingClientRect();
      const carouselCenter = carousel.scrollLeft + (carouselRect.width / 2);

      let closestIndex = 0;
      let minDistance = Infinity;

      // Loop through all cards to find which one is closest to center
      for (let i = 0; i < carousel.children.length; i++) {
        const card = carousel.children[i];
        if (!card) continue;

        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + (cardRect.width / 2) - carouselRect.left + carousel.scrollLeft;
        const distance = Math.abs(carouselCenter - cardCenter);

        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }

      setActiveIndex(closestIndex);
    };

    useEffect(() => {
      const carousel = carouselRef.current;
      const handleThrottledScroll = () => {
        requestAnimationFrame(handleScroll);
      };
      
      if (carousel) {
        carousel.addEventListener('scroll', handleThrottledScroll);
        handleScroll(); // Initialize on first render
        
        return () => carousel.removeEventListener('scroll', handleThrottledScroll);
      }
    }, [items.length]);

    return (
      <div className="food-carousel" ref={carouselRef}>
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`food-card ${index === activeIndex ? 'active' : ''}`}
          >
            <div className="food-card-image">
              <img 
                src={item.photoURL || "https://placehold.co/400x300?text=Food"} 
                alt={item.name} 
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
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(item);
                  }}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="canteen-menu-page">
      {/* Header Section - Independent from container */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', position: 'relative' }}>
          {onBack && (
            <div style={{ position: 'absolute', left: '-150px' }}>
              <EnhancedBackButton onBack={onBack} />
            </div>
          )}
          <h1 style={{ flex: 1, textAlign: 'center', fontSize: '22px', fontWeight: '800', margin: 0, color: '#2c3e50' }}>
            Today's Menu
          </h1>
          <div style={{ width: '40px' }}></div> {/* Spacer for balance */}
        </div>
      </div>

      {/* Main Content Container */}
      <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden' }}>
        {/* Cart Icon */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px 0 20px' }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => onNavigate('cart')}>
            <img 
              src={cartIcon} 
              alt="Cart" 
              style={{ 
                width: '24px', 
                height: '24px',
                display: 'block'
              }} 
            />
            <div style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              backgroundColor: '#ff4444',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              {cart.length}
            </div>
          </div>
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
              
              return (
                <div key={category} className="menu-category-section">
                  <h2 className="category-title">{category}</h2>
                  <FoodCarousel items={items} category={category} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CanteenMenu;
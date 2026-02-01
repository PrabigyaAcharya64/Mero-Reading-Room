import React, { useState, useEffect, useRef } from 'react';
import cartIcon from '../../assets/cart.svg';
import Button from '../../components/Button';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import '../../styles/CanteenMenu.css';
import '../../styles/StandardLayout.css';

const CanteenMenu = ({
  onBack,
  onNavigate,
  todaysMenu,
  fixedMenu = [],
  cart,
  addToCart,
  userBalance,
  userName
}) => {
  const categoryOrder = ['Breakfast', 'Meal', 'Dinner', 'Snacks', 'Drinks'];

  // Helper to group items by category
  const groupByCategory = (items) => {
    return items.reduce((acc, item) => {
      const category = item.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});
  };

  // Group menus
  const groupedTodaysMenu = groupByCategory(todaysMenu);
  const groupedFixedMenu = groupByCategory(fixedMenu);

  // Helper to sort categories
  const getSortedCategories = (groupedItems) => {
    const sorted = categoryOrder.filter(cat => groupedItems[cat]?.length > 0);
    Object.keys(groupedItems).forEach(cat => {
      if (!categoryOrder.includes(cat) && !sorted.includes(cat)) {
        sorted.push(cat);
      }
    });
    return sorted;
  };

  const todaysCategories = getSortedCategories(groupedTodaysMenu);
  const fixedCategories = getSortedCategories(groupedFixedMenu);


  // Carousel component with center detection
  const FoodCarousel = ({ items, category, variant = 'default' }) => {
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
      <div className="food-carousel-container">
        <div className="food-carousel" ref={carouselRef}>
          {items.map((item, index) => {
            const cardClasses = [
              'food-card',
              index === activeIndex ? 'active' : '',
              variant === 'special' ? 'food-card--special' : ''
            ].filter(Boolean).join(' ');

            return (
              <div
                key={item.id}
                className={cardClasses}
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
                    <span className="card-price">Rs. {Number(item.price).toFixed(2)}</span>
                    <Button
                      size="sm"
                      variant="primary"
                      className="card-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(item);
                      }}
                      style={{ borderRadius: '20px', fontSize: '0.8rem', padding: '4px 12px' }}
                    >
                      Add to Cart
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="std-container">
      <PageHeader
        title="Menu"
        onBack={onBack}
        forceShowBack={true}
        rightElement={
          <div
            className="cart-icon-wrapper"
            onClick={() => onNavigate('cart')}
            style={{ padding: '8px' }}
          >
            <img src={cartIcon} alt="Cart" className="cart-icon-image" />
            <div className="cart-badge">{cart.length}</div>
          </div>
        }
      />

      <main className="std-body">
        <div className="menu-balance-container">
          <span className="balance-label">Balance</span>
          <span className="balance-value">Rs. {(userBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div className="menu-scroll-container">
          {/* Today's Special Section */}
          {todaysMenu.length > 0 && (
            <div className="menu-section-group menu-section-group--special" style={{ marginBottom: '2rem' }}>
              <h1 className="todays-special-title">Today's Special</h1>

              {todaysCategories.map(category => (
                <div key={`today-${category}`} className="menu-category-section">
                  <h2 className="category-title">{category}</h2>
                  <FoodCarousel items={groupedTodaysMenu[category]} category={category} variant="special" />
                </div>
              ))}
            </div>
          )}

          {todaysMenu.length > 0 && fixedMenu.length > 0 && (
            <div className="menu-separator" />
          )}

          {/* Fixed Menu Section */}
          {fixedMenu.length > 0 && (
            <div className="menu-section-group">
              {todaysMenu.length === 0 && <h1 className="todays-special-title">Our Menu</h1>}
              {fixedCategories.map(category => (
                <div key={`fixed-${category}`} className="menu-category-section">
                  <h2 className="category-title">{category}</h2>
                  <FoodCarousel items={groupedFixedMenu[category]} category={category} />
                </div>
              ))}
            </div>
          )}

          {todaysMenu.length === 0 && fixedMenu.length === 0 && (
            <div className="empty-state">
              <p>No menu available right now.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CanteenMenu;
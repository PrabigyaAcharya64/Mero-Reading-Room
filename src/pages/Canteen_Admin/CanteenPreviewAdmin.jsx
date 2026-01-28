import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, collection, query, where, getDoc, getDocs } from 'firebase/firestore';
import { getBusinessDate } from '../../utils/dateUtils';
import PageHeader from '../../components/PageHeader';
import { useLoading } from '../../context/GlobalLoadingContext';
import Button from '../../components/Button';

// Reuse styles for consistent look
import '../../styles/CanteenMenu.css';
import '../../styles/StandardLayout.css';

const CanteenPreviewAdmin = ({ onBack }) => {
    const { isLoading, setIsLoading } = useLoading();
    const [todaysMenu, setTodaysMenu] = useState([]);
    const [fixedMenu, setFixedMenu] = useState([]);
    const categoryOrder = ['Breakfast', 'Meal', 'Dinner', 'Snacks', 'Drinks'];

    useEffect(() => {
        setIsLoading(true);
        const today = getBusinessDate();
        const todaysMenuRef = doc(db, 'todaysMenu', today);
        const fixedQ = query(
            collection(db, 'menuItems'),
            where('isFixed', '==', true)
        );

        // Standard Batch Reveal Pattern
        Promise.all([
            getDoc(todaysMenuRef),
            getDocs(fixedQ)
        ]).finally(() => {
            setIsLoading(false);
        });

        const unsubscribe = onSnapshot(todaysMenuRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setTodaysMenu(data.items || []);
            } else {
                setTodaysMenu([]);
            }
        });

        const unsubscribeFixed = onSnapshot(fixedQ, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setFixedMenu(items);
        });

        return () => {
            unsubscribe();
            unsubscribeFixed();
        };
    }, []);

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    const groupByCategory = (items) => {
        return items.reduce((acc, item) => {
            const category = item.category || 'Other';
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
        }, {});
    };

    const getSortedCategories = (groupedItems) => {
        const sorted = categoryOrder.filter(cat => groupedItems[cat]?.length > 0);
        Object.keys(groupedItems).forEach(cat => {
            if (!categoryOrder.includes(cat) && !sorted.includes(cat)) {
                sorted.push(cat);
            }
        });
        return sorted;
    };

    const groupedTodaysMenu = groupByCategory(todaysMenu);
    const groupedFixedMenu = groupByCategory(fixedMenu);
    const todaysCategories = getSortedCategories(groupedTodaysMenu);
    const fixedCategories = getSortedCategories(groupedFixedMenu);

    // ------------------------------------------------------------------
    // Carousel Component (No buttons)
    // ------------------------------------------------------------------
    const PreviewCarousel = ({ items, variant = 'default' }) => {
        const carouselRef = useRef(null);
        const [activeIndex, setActiveIndex] = useState(0);

        const handleScroll = () => {
            const carousel = carouselRef.current;
            if (!carousel) return;
            const carouselRect = carousel.getBoundingClientRect();
            const carouselCenter = carousel.scrollLeft + (carouselRect.width / 2);
            let closestIndex = 0;
            let minDistance = Infinity;

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

        return (
            <div className="food-carousel" ref={carouselRef} onScroll={handleScroll}>
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className={`food-card ${index === activeIndex ? 'active' : ''} ${variant === 'special' ? 'food-card--special' : ''}`}
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
                                {/* No Add to Cart button in Preview Mode */}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="std-container">
            <PageHeader title="Menu Preview (Admin)" onBack={onBack} />

            <main className="std-body">
                <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', paddingBottom: '80px', minHeight: '80vh' }}>

                    <div className="menu-scroll-container" style={{ padding: '20px' }}>
                        {/* Today's Special Section */}
                        {todaysMenu.length > 0 && (
                            <div className="menu-section-group menu-section-group--special" style={{ marginBottom: '2rem' }}>
                                <div className="section-header-banner section-header-banner--special todays-special-title">
                                    Today's Special
                                </div>
                                {todaysCategories.map(category => (
                                    <div key={`preview-today-${category}`} className="menu-category-section">
                                        <h2 className="category-title">{category}</h2>
                                        <PreviewCarousel items={groupedTodaysMenu[category]} variant="special" />
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
                                {fixedCategories.map(category => (
                                    <div key={`preview-fixed-${category}`} className="menu-category-section">
                                        <h2 className="category-title">{category}</h2>
                                        <PreviewCarousel items={groupedFixedMenu[category]} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {todaysMenu.length === 0 && fixedMenu.length === 0 && (
                            <div className="empty-state">
                                <p>No menu data to preview.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CanteenPreviewAdmin;

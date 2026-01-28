import { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, getDoc, getDocs } from 'firebase/firestore';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import '../../styles/NewOrders.css';
import '../../styles/StandardLayout.css';

// Sound effect for new orders
// const NEW_ORDER_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

function NewOrders({ onBack, onDataLoaded }) {
    const [newOrders, setNewOrders] = useState([]);
    const [preparingOrders, setPreparingOrders] = useState([]);

    useEffect(() => {
        const qNew = query(collection(db, 'orders'), where('status', '==', 'pending'));
        const qPreparing = query(collection(db, 'orders'), where('status', '==', 'preparing'));

        // Standard Batch Reveal Pattern - signal parent when loaded
        Promise.all([
            getDocs(qNew),
            getDocs(qPreparing)
        ]).finally(() => {
            onDataLoaded?.();
        });

        const unsubscribeNew = onSnapshot(qNew, async (snapshot) => {
            let orders = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
                const data = docSnapshot.data();
                let mrrId = 'N/A';

                if (data.userId) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', data.userId));
                        if (userDoc.exists() && userDoc.data().mrrNumber) {
                            mrrId = userDoc.data().mrrNumber;
                        } else {
                            mrrId = data.userId.substring(0, 6).toUpperCase();
                        }
                    } catch (e) {
                        mrrId = data.userId.substring(0, 6).toUpperCase();
                    }
                }

                return { id: docSnapshot.id, ...data, displayId: mrrId };
            }));

            const getMillis = (t) => {
                if (!t) return 0;
                if (t.seconds) return t.seconds * 1000;
                if (t instanceof Date) return t.getTime();
                return new Date(t).getTime();
            };

            orders.sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
            setNewOrders(orders);
        });

        const unsubscribePreparing = onSnapshot(qPreparing, async (snapshot) => {
            let orders = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
                const data = docSnapshot.data();
                let mrrId = 'N/A';

                if (data.userId) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', data.userId));
                        if (userDoc.exists() && userDoc.data().mrrNumber) {
                            mrrId = userDoc.data().mrrNumber;
                        } else {
                            mrrId = data.userId.substring(0, 6).toUpperCase();
                        }
                    } catch (e) {
                        mrrId = data.userId.substring(0, 6).toUpperCase();
                    }
                }

                return { id: docSnapshot.id, ...data, displayId: mrrId };
            }));

            const getMillis = (t) => {
                if (!t) return 0;
                if (t.seconds) return t.seconds * 1000;
                if (t instanceof Date) return t.getTime();
                return new Date(t).getTime();
            };

            orders.sort((a, b) => getMillis(a.updatedAt) - getMillis(b.updatedAt));
            setPreparingOrders(orders);
        });

        return () => {
            unsubscribeNew();
            unsubscribePreparing();
        };
    }, []);

    const handleAcceptOrder = async (orderId) => {
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'preparing', updatedAt: serverTimestamp() });
        } catch (error) {
            console.error('Error accepting order:', error);
            alert('Failed to accept order. Check permissions.');
        }
    };

    const handleCompleteOrder = async (orderId) => {
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        } catch (error) {
            console.error('Error completing order:', error);
            alert('Failed to complete order. Check permissions.');
        }
    };

    const formatDate = (val) => {
        if (!val) return '';
        try {
            let date;
            if (val.seconds) {
                date = new Date(val.seconds * 1000);
            } else {
                date = new Date(val);
            }

            if (isNaN(date.getTime())) return '';

            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    return (
        <div className="std-container">
            <PageHeader title="New Orders" onBack={onBack} />

            <main className="std-body">

                <div className="no-grid">

                    {/* New Orders Column */}
                    <section className="no-column">
                        <div className="no-column-header new">
                            <h2 className="no-column-title">
                                <span>Pending Orders</span>
                            </h2>
                            <span className="no-count-badge">{newOrders.length}</span>
                        </div>

                        <div className="no-orders-list">
                            {newOrders.length === 0 ? (
                                <div className="no-empty-state">No new orders waiting.</div>
                            ) : (
                                newOrders.map(order => (
                                    <div key={order.id} className="no-card new-order">
                                        <div className="no-card-header">
                                            <div className="no-user-info">
                                                <span className="no-mrr-id">MRR: {order.displayId}</span>
                                                <span className="no-time">{formatDate(order.createdAt)}</span>
                                            </div>
                                        </div>

                                        <div className="no-card-body">
                                            <div className="no-items-list">
                                                {order.items && order.items.map((item, idx) => (
                                                    <div key={idx} className="no-item">
                                                        <span className="no-item-name">
                                                            <span className="no-item-qty">{item.quantity}x</span>
                                                            {item.name}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {order.note && (
                                                <div className="no-note">
                                                    <p className="no-note-text">"{order.note}"</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="no-card-footer">
                                            <div className="no-total">
                                                <span className="no-total-label">Total</span>
                                                <span className="no-total-amount">Rs. {order.total}</span>
                                            </div>
                                            <Button
                                                onClick={() => handleAcceptOrder(order.id)}
                                                variant="primary"
                                                fullWidth
                                                className="no-action-btn"
                                                style={{ backgroundColor: '#4caf50', borderColor: '#4caf50' }}
                                            >
                                                Accept Order
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Preparing Orders Column */}
                    <section className="no-column">
                        <div className="no-column-header preparing">
                            <h2 className="no-column-title">
                                <span>Preparing</span>
                            </h2>
                            <span className="no-count-badge">{preparingOrders.length}</span>
                        </div>

                        <div className="no-orders-list">
                            {preparingOrders.length === 0 ? (
                                <div className="no-empty-state">No orders in preparation.</div>
                            ) : (
                                preparingOrders.map(order => (
                                    <div key={order.id} className="no-card preparing-order">
                                        <div className="no-card-header">
                                            <div className="no-user-info">
                                                <span className="no-mrr-id">MRR: {order.displayId}</span>
                                                <span className="no-time">{formatDate(order.createdAt)}</span>
                                            </div>
                                        </div>

                                        <div className="no-card-body">
                                            <div className="no-items-list">
                                                {order.items && order.items.map((item, idx) => (
                                                    <div key={idx} className="no-item">
                                                        <span className="no-item-name">
                                                            <span className="no-item-qty">{item.quantity}x</span>
                                                            {item.name}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="no-card-footer">
                                            <div className="no-total">
                                                <span className="no-total-label">Status</span>
                                                <span style={{ color: '#e37400', fontWeight: 'bold' }}>Preparing...</span>
                                            </div>
                                            <Button
                                                onClick={() => handleCompleteOrder(order.id)}
                                                variant="primary"
                                                fullWidth
                                                className="no-action-btn"
                                            >
                                                Complete
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default NewOrders;

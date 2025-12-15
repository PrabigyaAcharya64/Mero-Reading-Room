import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';

function AdminMessages({ onBack }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [filter, setFilter] = useState('unread'); // 'unread' or 'all'

    useEffect(() => {
        const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data();
                let createdAt = null;

                // Handle different createdAt formats
                if (data.createdAt) {
                    if (typeof data.createdAt.toDate === 'function') {
                        // Firestore Timestamp
                        createdAt = data.createdAt.toDate();
                    } else if (data.createdAt instanceof Date) {
                        // JavaScript Date
                        createdAt = data.createdAt;
                    } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                        // String or number timestamp
                        createdAt = new Date(data.createdAt);
                    }
                }

                // If createdAt is still null, use current time as fallback
                if (!createdAt) {
                    createdAt = new Date();
                }

                return {
                    id: docSnapshot.id,
                    ...data,
                    createdAt
                };
            });
            setMessages(msgs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleMessageClick = async (message) => {
        setSelectedMessage(message);

        if (!message.read) {
            try {
                const messageRef = doc(db, 'messages', message.id);
                await updateDoc(messageRef, { read: true });
            } catch (error) {
                console.error('Error marking message as read:', error);
            }
        }
    };

    return (
        <div className="landing-screen">
            <header className="landing-header">
                <button
                    onClick={onBack}
                    className="landing-signout"
                    style={{
                        border: '1px solid var(--color-text-primary)',
                        padding: '0.5rem 0.85rem'
                    }}
                >
                    ← Back
                </button>
                <h1 style={{
                    margin: 0,
                    fontFamily: 'var(--brand-font-serif)',
                    fontSize: '1.5rem',
                    flex: 1,
                    textAlign: 'center'
                }}>
                    Messages
                </h1>
                <div style={{ width: '100px' }}></div>
            </header>

            <main className="landing-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', height: 'calc(100vh - 200px)' }}>

                    {/* Message List */}
                    <div className="auth-card" style={{ overflowY: 'auto', alignContent: 'start', gap: '0' }}>
                        {/* Filter Buttons */}
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            padding: '1rem',
                            borderBottom: '2px solid var(--color-border)',
                            position: 'sticky',
                            top: 0,
                            backgroundColor: 'var(--color-bg-primary)',
                            zIndex: 1
                        }}>
                            <button
                                onClick={() => setFilter('unread')}
                                style={{
                                    flex: 1,
                                    padding: '0.5rem 1rem',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '0.375rem',
                                    backgroundColor: filter === 'unread' ? '#000' : 'transparent',
                                    color: filter === 'unread' ? '#fff' : '#000',
                                    fontWeight: filter === 'unread' ? 'bold' : 'normal',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontFamily: 'inherit'
                                }}
                            >
                                Unread {messages.filter(m => !m.read).length > 0 && `(${messages.filter(m => !m.read).length})`}
                            </button>
                            <button
                                onClick={() => setFilter('all')}
                                style={{
                                    flex: 1,
                                    padding: '0.5rem 1rem',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '0.375rem',
                                    backgroundColor: filter === 'all' ? '#000' : 'transparent',
                                    color: filter === 'all' ? '#fff' : '#000',
                                    fontWeight: filter === 'all' ? 'bold' : 'normal',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontFamily: 'inherit'
                                }}
                            >
                                All ({messages.length})
                            </button>
                        </div>

                        {/* Messages List */}
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <LoadingSpinner size="40" stroke="3" color="#666" />
                                <p style={{ marginTop: '1rem', color: '#666' }}>Loading messages...</p>
                            </div>
                        ) : messages.filter(msg => filter === 'all' || !msg.read).length === 0 ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                {filter === 'unread' ? 'No unread messages.' : 'No messages found.'}
                            </div>
                        ) : (
                            messages
                                .filter(msg => filter === 'all' || !msg.read)
                                .map(msg => (
                                    <div
                                        key={msg.id}
                                        onClick={() => handleMessageClick(msg)}
                                        style={{
                                            padding: '1rem',
                                            borderBottom: '1px solid var(--color-border)',
                                            cursor: 'pointer',
                                            backgroundColor: selectedMessage?.id === msg.id ? '#f5f5f5' : (msg.read ? 'transparent' : '#e8f0fe'),
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: msg.read ? 'normal' : 'bold' }}>{msg.name}</span>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                {msg.createdAt ? msg.createdAt.toLocaleDateString() : 'N/A'}
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: '0.9rem',
                                            color: 'var(--color-text-secondary)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {msg.message}
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>

                    {/* Message Detail */}
                    <div className="auth-card" style={{ alignContent: 'start' }}>
                        {selectedMessage ? (
                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
                                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{selectedMessage.name}</h3>
                                    <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                                        <div>Email: {selectedMessage.email}</div>
                                        <div>Phone: {selectedMessage.phone}</div>
                                        <div>Date: {selectedMessage.createdAt ? selectedMessage.createdAt.toLocaleString() : 'N/A'}</div>
                                    </div>
                                </div>
                                <div style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                    {selectedMessage.message}
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: 'var(--color-text-secondary)'
                            }}>
                                Select a message to view details
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    );
}

export default AdminMessages;
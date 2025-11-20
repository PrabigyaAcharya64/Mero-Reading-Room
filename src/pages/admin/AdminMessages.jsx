import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';

function AdminMessages({ onBack }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState(null);

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
                <button onClick={onBack} className="landing-signout" style={{ border: 'none', paddingLeft: 0 }}>
                    ← Back
                </button>
                <h1 style={{ margin: 0, fontFamily: 'var(--brand-font-serif)', fontSize: '1.5rem' }}>Messages</h1>
                <div style={{ width: '40px' }}></div>
            </header>

            <main className="landing-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', height: 'calc(100vh - 200px)' }}>

                    {/* Message List */}
                    <div className="auth-card" style={{ overflowY: 'auto', alignContent: 'start', gap: '0' }}>
                        {loading ? (
                            <div style={{ padding: '1rem', textAlign: 'center' }}>Loading messages...</div>
                        ) : messages.length === 0 ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No messages found.</div>
                        ) : (
                            messages.map(msg => (
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
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import '../../styles/AdminMessages.css';

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
        <div className="am-container">
            <header className="am-header">
                <EnhancedBackButton onBack={onBack} />
                <h1 className="am-title">Messages</h1>
                <div className="am-header-spacer"></div>
            </header>

            <main className="am-body">
                <div className="am-grid">

                    {/* Message List */}
                    <div className="am-list-panel">
                        {/* Filter Buttons */}
                        <div className="am-filter-bar">
                            <button
                                onClick={() => setFilter('unread')}
                                className={`am-filter-btn ${filter === 'unread' ? 'active' : ''}`}
                            >
                                Unread {messages.filter(m => !m.read).length > 0 && `(${messages.filter(m => !m.read).length})`}
                            </button>
                            <button
                                onClick={() => setFilter('all')}
                                className={`am-filter-btn ${filter === 'all' ? 'active' : ''}`}
                            >
                                All ({messages.length})
                            </button>
                        </div>

                        {/* Messages List */}
                        {loading ? (
                            <div className="am-loading">
                                <LoadingSpinner size="40" stroke="3" color="#666" />
                                <p className="am-loading-text">Loading messages...</p>
                            </div>
                        ) : messages.filter(msg => filter === 'all' || !msg.read).length === 0 ? (
                            <div className="am-empty">
                                {filter === 'unread' ? 'No unread messages.' : 'No messages found.'}
                            </div>
                        ) : (
                            messages
                                .filter(msg => filter === 'all' || !msg.read)
                                .map(msg => (
                                    <div
                                        key={msg.id}
                                        onClick={() => handleMessageClick(msg)}
                                        className={`am-message-item ${!msg.read ? 'unread' : ''} ${selectedMessage?.id === msg.id ? 'selected' : ''}`}
                                    >
                                        <div className="am-message-header">
                                            <span className={`am-message-name ${!msg.read ? 'unread' : ''}`}>{msg.name}</span>
                                            <span className="am-message-date">
                                                {msg.createdAt ? msg.createdAt.toLocaleDateString() : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="am-message-preview">
                                            {msg.message}
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>

                    {/* Message Detail */}
                    <div className="am-detail-panel">
                        {selectedMessage ? (
                            <div className="am-detail-content">
                                <div className="am-detail-header">
                                    <h3 className="am-detail-title">{selectedMessage.name}</h3>
                                    <div className="am-detail-meta">
                                        <div>Email: {selectedMessage.email}</div>
                                        <div>Phone: {selectedMessage.phone}</div>
                                        <div>Date: {selectedMessage.createdAt ? selectedMessage.createdAt.toLocaleString() : 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="am-detail-message">
                                    {selectedMessage.message}
                                </div>
                            </div>
                        ) : (
                            <div className="am-detail-empty">
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
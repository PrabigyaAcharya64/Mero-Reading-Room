import { collection, doc, onSnapshot, orderBy, query, updateDoc, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import '../../styles/AdminMessages.css';
import '../../styles/StandardLayout.css';

function AdminMessages({ onBack }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [filter, setFilter] = useState('unread');

    const [userMap, setUserMap] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                const map = {};
                usersSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.email && data.mrrNumber) {
                        map[data.email] = data.mrrNumber;
                    }
                });
                setUserMap(map);
            } catch (error) {
                console.error("Error fetching users for MRR ID mapping:", error);
            }
        };
        fetchUsers();
    }, []);

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
        <div className="std-container">
            <PageHeader title="Messages" onBack={onBack} />

            <main className="std-body">
                <div className="am-grid">

                    {/* Message List */}
                    <div className="am-list-panel">
                        {/* Filter Buttons & Search */}
                        <div className="am-filter-bar" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
                                <button
                                    onClick={() => setFilter('anonymous')}
                                    className={`am-filter-btn ${filter === 'anonymous' ? 'active' : ''}`}
                                >
                                    Anonymous ({messages.filter(m => m.anonymous).length})
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Search by MRR ID or Name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    marginTop: '5px'
                                }}
                            />
                        </div>

                        {/* Messages List */}
                        {loading ? (
                            <div className="am-loading">
                                <LoadingSpinner size="40" stroke="3" color="#666" />
                                <p className="am-loading-text">Loading messages...</p>
                            </div>
                        ) : (
                            (() => {
                                const filtered = messages.filter(msg => {
                                    // Handle filter logic
                                    let isFilterMatch = false;
                                    if (filter === 'anonymous') {
                                        isFilterMatch = msg.anonymous === true;
                                    } else if (filter === 'unread') {
                                        isFilterMatch = !msg.read && !msg.anonymous;
                                    } else { // 'all'
                                        isFilterMatch = !msg.anonymous; // Don't show anonymous in 'all'
                                    }

                                    const mrrId = userMap[msg.email] || '';
                                    const searchMatch = searchQuery === '' ||
                                        mrrId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (msg.name && msg.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                                        (msg.subject && msg.subject.toLowerCase().includes(searchQuery.toLowerCase()));
                                    return isFilterMatch && searchMatch;
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <div className="am-empty">
                                            {searchQuery ? 'No matching messages.' : (filter === 'unread' ? 'No unread messages.' : 'No messages found.')}
                                        </div>
                                    );
                                }

                                return filtered.map(msg => (
                                    <div
                                        key={msg.id}
                                        onClick={() => handleMessageClick(msg)}
                                        className={`am-message-item ${!msg.read ? 'unread' : ''} ${selectedMessage?.id === msg.id ? 'selected' : ''}`}
                                    >
                                        <div className="am-message-header">
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span className={`am-message-name ${!msg.read ? 'unread' : ''}`}>{msg.name}</span>
                                                    {msg.anonymous && (
                                                        <span style={{ fontSize: '0.65rem', backgroundColor: '#e3f2fd', color: '#1976d2', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <path d="M12 1C8.676 1 6 3.676 6 7V10H5C3.895 10 3 10.895 3 12V20C3 21.105 3.895 22 5 22H19C20.105 22 21 21.105 21 20V12C21 10.895 20.105 10 19 10H18V7C18 3.676 15.324 1 12 1ZM9 7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V10H9V7Z" fill="#1976d2" />
                                                            </svg>
                                                            ANON
                                                        </span>
                                                    )}
                                                </div>
                                                {userMap[msg.email] && !msg.anonymous && (
                                                    <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                                        {userMap[msg.email]}
                                                    </span>
                                                )}
                                                {msg.subject && (
                                                    <span style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                                                        {msg.subject}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="am-message-date">
                                                {msg.createdAt ? msg.createdAt.toLocaleDateString() : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="am-message-preview">
                                            {msg.message}
                                        </div>
                                    </div>
                                ));
                            })()
                        )}
                    </div>

                    {/* Message Detail */}
                    <div className="am-detail-panel">
                        {selectedMessage ? (
                            <div className="am-detail-content">
                                <div className="am-detail-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h3 className="am-detail-title">{selectedMessage.name}</h3>
                                        {selectedMessage.anonymous && (
                                            <span style={{ fontSize: '0.75rem', backgroundColor: '#e3f2fd', color: '#1976d2', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M12 1C8.676 1 6 3.676 6 7V10H5C3.895 10 3 10.895 3 12V20C3 21.105 3.895 22 5 22H19C20.105 22 21 21.105 21 20V12C21 10.895 20.105 10 19 10H18V7C18 3.676 15.324 1 12 1ZM9 7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V10H9V7Z" fill="#1976d2" />
                                                </svg>
                                                Anonymous
                                            </span>
                                        )}
                                    </div>
                                    <div className="am-detail-meta">
                                        {selectedMessage.subject && <div>Subject: <strong>{selectedMessage.subject}</strong></div>}
                                        {!selectedMessage.anonymous && (
                                            <>
                                                {userMap[selectedMessage.email] && <div>MRR ID: <strong>{userMap[selectedMessage.email]}</strong></div>}
                                                <div>Email: {selectedMessage.email}</div>
                                                <div>Phone: {selectedMessage.phone}</div>
                                            </>
                                        )}
                                        <div>Date: {selectedMessage.createdAt ? selectedMessage.createdAt.toLocaleString() : 'N/A'}</div>
                                        {selectedMessage.anonymous && (
                                            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3e0', borderLeft: '3px solid #ff9800', fontSize: '0.875rem', display: 'flex', gap: '6px' }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, marginTop: '2px' }}>
                                                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#ff9800" strokeWidth="2" />
                                                    <path d="M12 8V12M12 16H12.01" stroke="#ff9800" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                                <span>This is an anonymous message. No user information is available to protect the sender's identity.</span>
                                            </div>
                                        )}
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
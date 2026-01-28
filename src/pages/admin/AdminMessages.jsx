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
    const [statusFilter, setStatusFilter] = useState('unread');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');

    const [userMap, setUserMap] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    const categories = [
        { label: 'All Categories', value: 'All Categories' },
        { label: 'App Support', value: 'App Support' },
        { label: 'Suggestions', value: 'Suggestions' },
        { label: 'Problems', value: 'Problem' },
        { label: 'Other', value: 'Other' }
    ];

    const getCategoryStyle = (category) => {
        const cat = (category || '').toLowerCase();
        if (cat.includes('problem')) {
            return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' };
        }
        if (cat.includes('suggestion')) {
            return { bg: '#dcfce7', text: '#16a34a', border: '#86efac' };
        }
        if (cat.includes('app support')) {
            return { bg: '#fef9c3', text: '#a16207', border: '#fde047' };
        }
        return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    };

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

                if (data.createdAt) {
                    if (typeof data.createdAt.toDate === 'function') {
                        createdAt = data.createdAt.toDate();
                    } else if (data.createdAt instanceof Date) {
                        createdAt = data.createdAt;
                    } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                        createdAt = new Date(data.createdAt);
                    }
                }

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
                        <div className="am-filter-bar" style={{ flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <button
                                    onClick={() => setStatusFilter('unread')}
                                    className={`am-filter-btn ${statusFilter === 'unread' ? 'active' : ''}`}
                                    style={{ flex: '0 0 auto', minWidth: '120px' }}
                                >
                                    Unread {messages.filter(m => !m.read).length > 0 && `(${messages.filter(m => !m.read).length})`}
                                </button>
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`am-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                                    style={{ flex: '0 0 auto', minWidth: '100px' }}
                                >
                                    All ({messages.length})
                                </button>

                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    style={{
                                        marginLeft: 'auto',
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        fontSize: '0.875rem',
                                        backgroundColor: 'white',
                                        color: '#333',
                                        cursor: 'pointer',
                                        minWidth: '160px'
                                    }}
                                >
                                    {categories.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            <input
                                type="text"
                                placeholder="Search by MRR ID, Name, or Message..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    fontSize: '0.9rem'
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
                                    // Status filter
                                    if (statusFilter === 'unread' && msg.read) return false;

                                    // Category filter
                                    if (categoryFilter !== 'All Categories') {
                                        // Match either 'Problem' or 'Problems' if it comes from old data
                                        const msgCat = (msg.category || msg.subject || '').toLowerCase();
                                        const filterCat = categoryFilter.toLowerCase();
                                        if (msgCat !== filterCat && !(filterCat === 'problem' && msgCat === 'problems')) return false;
                                    }

                                    // Search query
                                    const mrrId = userMap[msg.email] || '';
                                    const searchLower = searchQuery.toLowerCase();
                                    const searchMatch = searchQuery === '' ||
                                        mrrId.toLowerCase().includes(searchLower) ||
                                        (msg.name && msg.name.toLowerCase().includes(searchLower)) ||
                                        (msg.message && msg.message.toLowerCase().includes(searchLower)) ||
                                        (msg.category && msg.category.toLowerCase().includes(searchLower)) ||
                                        (msg.subject && msg.subject.toLowerCase().includes(searchLower));

                                    return searchMatch;
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <div className="am-empty">
                                            {searchQuery || categoryFilter !== 'All Categories' ? 'No matching messages.' : (statusFilter === 'unread' ? 'No unread messages.' : 'No messages found.')}
                                        </div>
                                    );
                                }

                                return filtered.map(msg => {
                                    const catStyle = getCategoryStyle(msg.category || msg.subject);
                                    return (
                                        <div
                                            key={msg.id}
                                            onClick={() => handleMessageClick(msg)}
                                            className={`am-message-item ${!msg.read ? 'unread' : ''} ${selectedMessage?.id === msg.id ? 'selected' : ''}`}
                                        >
                                            <div className="am-message-header">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span className={`am-message-name ${!msg.read ? 'unread' : ''}`}>{msg.name}</span>
                                                        {msg.anonymous && (
                                                            <span style={{ fontSize: '0.6rem', backgroundColor: '#f5f5f5', color: '#666', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                                ANON
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                        {userMap[msg.email] && !msg.anonymous && (
                                                            <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                                                {userMap[msg.email]}
                                                            </span>
                                                        )}
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            backgroundColor: catStyle.bg,
                                                            color: catStyle.text,
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            fontWeight: '700',
                                                            textTransform: 'uppercase',
                                                            border: `1px solid ${catStyle.border}`
                                                        }}>
                                                            {(msg.category || msg.subject || 'GENERAL').replace(/s$/, '')}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="am-message-date">
                                                    {msg.createdAt ? msg.createdAt.toLocaleDateString() : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="am-message-preview">
                                                {msg.message}
                                            </div>
                                        </div>
                                    );
                                });
                            })()
                        )}
                    </div>

                    {/* Message Detail */}
                    <div className="am-detail-panel">
                        {selectedMessage ? (
                            (() => {
                                const catStyle = getCategoryStyle(selectedMessage.category || selectedMessage.subject);
                                return (
                                    <div className="am-detail-content">
                                        <div className="am-detail-header">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <h3 className="am-detail-title">{selectedMessage.name}</h3>
                                                    {selectedMessage.anonymous && (
                                                        <span style={{ fontSize: '0.7rem', backgroundColor: '#e0e0e0', color: '#444', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                                            Anonymous
                                                        </span>
                                                    )}
                                                </div>
                                                <span style={{
                                                    fontSize: '0.8rem',
                                                    backgroundColor: catStyle.bg,
                                                    color: catStyle.text,
                                                    padding: '4px 14px',
                                                    borderRadius: '20px',
                                                    fontWeight: '800',
                                                    textTransform: 'uppercase',
                                                    border: `1px solid ${catStyle.border}`
                                                }}>
                                                    {(selectedMessage.category || selectedMessage.subject || 'General').replace(/s$/, '')}
                                                </span>
                                            </div>
                                            <div className="am-detail-meta" style={{ marginTop: '15px' }}>
                                                {!selectedMessage.anonymous && (
                                                    <>
                                                        {userMap[selectedMessage.email] && <div>MRR ID: <strong>{userMap[selectedMessage.email]}</strong></div>}
                                                        <div>Email: {selectedMessage.email}</div>
                                                        <div>Phone: {selectedMessage.phone}</div>
                                                    </>
                                                )}
                                                <div>Date: {selectedMessage.createdAt ? selectedMessage.createdAt.toLocaleString() : 'N/A'}</div>
                                                {selectedMessage.anonymous && (
                                                    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#fff8e1', borderLeft: '4px solid #ffc107', borderRadius: '4px', fontSize: '0.85rem' }}>
                                                        <strong>Note:</strong> This message was sent anonymously. Identity info is hidden.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="am-detail-message" style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
                                            {selectedMessage.message}
                                        </div>
                                    </div>
                                );
                            })()
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
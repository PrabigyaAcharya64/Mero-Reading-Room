import { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, Timestamp, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../auth/AuthProvider';
import { useLoading } from '../../../context/GlobalLoadingContext';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { History, Trash2, ArrowLeft } from 'lucide-react';
import '../../../styles/StandardLayout.css';

function CreateAnnouncement({ onBack, onDataLoaded }) {
    const { user } = useAuth();
    const { setIsLoading } = useLoading();
    const [text, setText] = useState('');
    const [durationValue, setDurationValue] = useState(24);
    const [durationUnit, setDurationUnit] = useState('hours');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    // History View State
    const [showHistory, setShowHistory] = useState(false);
    const [announcements, setAnnouncements] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        // Set loading on mount, then immediately signal ready (no data to fetch initially)
        setIsLoading(true);
        onDataLoaded?.();
    }, []);

    useEffect(() => {
        let unsubscribe;
        if (showHistory) {
            setLoadingHistory(true);
            const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
            unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedAnnouncements = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setAnnouncements(fetchedAnnouncements);
                setLoadingHistory(false);
            }, (error) => {
                console.error("Error fetching announcements:", error);
                setLoadingHistory(false);
            });
        }
        return () => unsubscribe && unsubscribe();
    }, [showHistory]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            // Calculate expiration time
            const now = new Date();
            let expirationDate = new Date(now);

            if (durationUnit === 'hours') {
                expirationDate.setHours(now.getHours() + parseInt(durationValue));
            } else {
                expirationDate.setDate(now.getDate() + parseInt(durationValue));
            }

            await addDoc(collection(db, 'announcements'), {
                text,
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(expirationDate),
                createdBy: user.uid
            });

            setSuccess(true);
            setText('');
        } catch (err) {
            console.error('Error creating announcement:', err);
            setError('Failed to create announcement. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this announcement?')) {
            try {
                await deleteDoc(doc(db, 'announcements', id));
            } catch (error) {
                console.error("Error deleting announcement:", error);
                alert("Failed to delete announcement.");
            }
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp.seconds * 1000).toLocaleString();
    };

    return (
        <div className="std-container">
            <main className="std-body">
                <div className="auth-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
                        <h2 className="auth-header__title" style={{ margin: 0, fontSize: '1.25rem' }}>
                            {showHistory ? 'Announcement History' : 'Create Announcement'}
                        </h2>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="link-button"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                        >
                            {showHistory ? (
                                <>
                                    <ArrowLeft size={16} />
                                    <span>Back to Create</span>
                                </>
                            ) : (
                                <>
                                    <History size={16} />
                                    <span>History</span>
                                </>
                            )}
                        </button>
                    </div>

                    {showHistory ? (
                        <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {loadingHistory ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                                    <LoadingSpinner size="30" color="var(--color-primary)" />
                                </div>
                            ) : announcements.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem' }}>
                                    No announcements found.
                                </p>
                            ) : (
                                announcements.map((item) => (
                                    <div key={item.id} style={{
                                        padding: '1rem',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--color-surface)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <p style={{ margin: 0, fontWeight: 500, flex: 1, whiteSpace: 'pre-wrap' }}>{item.text}</p>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#d93025',
                                                    cursor: 'pointer',
                                                    padding: '0.25rem',
                                                    marginLeft: '0.5rem'
                                                }}
                                                title="Delete Announcement"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                                            <span>Created: {formatDate(item.createdAt)}</span>
                                            <span>Expires: {formatDate(item.expiresAt)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        success ? (
                            <div className="auth-feedback" style={{ backgroundColor: '#e6f4ea', borderColor: '#1e8e3e' }}>
                                Announcement created successfully!
                                <button
                                    onClick={() => setSuccess(false)}
                                    className="link-button"
                                    style={{ display: 'block', marginTop: '1rem' }}
                                >
                                    Create another
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="auth-form">
                                <div className="input-field">
                                    <label className="input-field__label" htmlFor="text">Announcement Text</label>
                                    <textarea
                                        id="text"
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        required
                                        placeholder="Enter announcement details..."
                                        rows={5}
                                        style={{
                                            width: '100%',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: '0.85rem 1rem',
                                            fontFamily: 'var(--font-system)',
                                            fontSize: '1rem',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>

                                <div className="input-field">
                                    <label className="input-field__label">Duration</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            value={durationValue}
                                            onChange={(e) => setDurationValue(e.target.value)}
                                            required
                                            style={{
                                                width: '100%',
                                                border: '1px solid var(--color-border)',
                                                padding: '0.85rem 1rem',
                                                fontSize: '1rem',
                                                fontFamily: 'var(--font-system)',
                                                borderRadius: 'var(--radius-md)',
                                                backgroundColor: '#fff'
                                            }}
                                        />
                                        <select
                                            value={durationUnit}
                                            onChange={(e) => setDurationUnit(e.target.value)}
                                            className="ios-select"
                                            style={{
                                                width: '100%',
                                                padding: '0.85rem 2.5rem 0.85rem 1rem',
                                                fontSize: '1rem',
                                                fontFamily: 'var(--font-system)',
                                                borderRadius: 'var(--radius-md)',
                                                backgroundColor: 'var(--color-surface)'
                                            }}
                                        >
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                        </select>
                                    </div>
                                </div>

                                {error && <div className="auth-feedback" style={{ borderColor: '#d93025', color: '#d93025' }}>{error}</div>}

                                <button type="submit" className="cta-button cta-button--primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    {submitting ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'Create Announcement'}
                                </button>
                            </form>
                        )
                    )}
                </div>
            </main>
        </div>
    );
}

export default CreateAnnouncement;
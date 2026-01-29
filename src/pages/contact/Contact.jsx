
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../auth/AuthProvider';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/Button';

function Contact({ onBack }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: user?.displayName || '',
        email: user?.email || '',
        phone: '',
        category: 'App Support',
        message: '',
        isAnonymous: false
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    const categories = [
        'App Support',
        'Suggestions',
        'Problem',
        'Other'
    ];

    useEffect(() => {
        const fetchUserData = async () => {
            if (user?.uid) {
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setFormData(prev => ({
                            ...prev,
                            phone: userData.phoneNumber || userData.phone || ''
                        }));
                    }
                } catch (err) {
                    console.error('Error fetching user data:', err);
                }
            }
        };

        fetchUserData();
    }, [user]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const messageData = {
                subject: formData.category,
                category: formData.category,
                message: formData.message,
                createdAt: serverTimestamp(),
                read: false,
                anonymous: formData.isAnonymous
            };

            if (formData.isAnonymous) {
                messageData.name = 'Anonymous';
                messageData.email = 'anonymous@system';
                messageData.phone = 'N/A';
                messageData.userId = null;
            } else {
                messageData.name = formData.name;
                messageData.email = formData.email;
                messageData.phone = formData.phone;
                messageData.userId = user?.uid || null;
            }

            await addDoc(collection(db, 'messages'), messageData);
            setSuccess(true);
            setFormData(prev => ({ ...prev, message: '' }));
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to send message. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="std-container">
            <PageHeader title="Contact" onBack={onBack} />

            <main className="std-body">
                <div className="discussion-card">
                    <h1 className="page-title">Feedback</h1>
                    <p className="page-subtitle">
                        Send us your complaints or feedback. For urgent queries, please call us at <strong>986-7666655</strong>.
                    </p>

                    <div className="form-container">
                        <div className="ios-form-group">
                            <div 
                                className="ios-input-group"
                                onClick={() => navigate('/anonymous-message')}
                                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <div>
                                    <span className="ios-label" style={{ marginBottom: '4px' }}>Privacy</span>
                                    <span style={{ fontSize: '17px', fontWeight: 500 }}>Submit Anonymously</span>
                                </div>
                                <span style={{ color: 'var(--ios-text-secondary)', fontSize: '20px' }}>›</span>
                            </div>
                        </div>

                        {success ? (
                            <div className="success-msg" style={{ textAlign: 'center', padding: '40px 0' }}>
                                <p style={{ fontSize: '18px', marginBottom: '16px' }}>Message sent successfully!</p>
                                <button
                                    onClick={() => setSuccess(false)}
                                    className="btn-ios-ghost"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <div className="ios-form-group">
                                    <div className="ios-input-group">
                                        <label className="ios-label" htmlFor="message">Your Message</label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            required
                                            placeholder="Write here..."
                                            rows={6}
                                            className="ios-input"
                                            style={{ resize: 'none', minHeight: '120px', display: 'block' }}
                                        />
                                    </div>
                                </div>

                                {error && <div className="error-msg">{error}</div>}

                                <div className="ios-actions" style={{ padding: 0 }}>
                                    <button
                                        type="submit"
                                        className="btn-ios-primary"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Sending...' : 'Send Message'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Contact

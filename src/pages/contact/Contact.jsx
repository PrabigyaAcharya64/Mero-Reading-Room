
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../auth/AuthProvider';
import EnhancedBackButton from '../../components/EnhancedBackButton';
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
        <div className="landing-screen">
            {onBack && <EnhancedBackButton onBack={onBack} />}
            <header className="subpage-header">
                <h1 className="subpage-header__title">Contact Us</h1>
                <div className="subpage-header__spacer"></div>
            </header>

            <main className="landing-body">
                <div className="auth-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div className="auth-header">
                        <h2 className="auth-header__headline">Get in Touch</h2>
                        <p className="auth-header__subtext">
                            Send us your complaints or feedback. We're here to help.
                        </p>
                        <p className="auth-header__subtext" style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px' }}>
                            For urgent queries call us at 986-7666655
                        </p>
                    </div>

                    {success ? (
                        <div className="auth-feedback" style={{ backgroundColor: '#e6f4ea', borderColor: '#1e8e3e' }}>
                            Message sent successfully! We'll get back to you soon.
                            <button
                                onClick={() => setSuccess(false)}
                                className="link-button"
                                style={{ display: 'block', marginTop: '1rem' }}
                            >
                                Send another message
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="input-field">
                                <label className="input-field__label" htmlFor="category">Category</label>
                                <select
                                    id="category"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="input-field__input"
                                    style={{
                                        width: '100%',
                                        border: '1px solid var(--color-border)',
                                        padding: '0.85rem 1rem',
                                        fontFamily: 'var(--brand-font-body)',
                                        fontSize: '1rem',
                                        borderRadius: '8px',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-field">
                                <label className="input-field__label" htmlFor="message">Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    required
                                    placeholder="Write your message here..."
                                    rows={5}
                                    style={{
                                        width: '100%',
                                        border: '1px solid var(--color-border)',
                                        padding: '0.85rem 1rem',
                                        fontFamily: 'var(--brand-font-body)',
                                        fontSize: '1rem',
                                        resize: 'vertical',
                                        borderRadius: '8px'
                                    }}
                                />
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '8px',
                                border: '1px solid #e9ecef',
                                marginBottom: '20px'
                            }}>
                                <input
                                    type="checkbox"
                                    id="isAnonymous"
                                    name="isAnonymous"
                                    checked={formData.isAnonymous}
                                    onChange={handleChange}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="isAnonymous" style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#495057', fontWeight: 500 }}>
                                    Send Anonymously (Hide my identity)
                                </label>
                                {formData.isAnonymous && (
                                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', backgroundColor: '#e3f2fd', color: '#1976d2', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                                        IDENTITY HIDDEN
                                    </span>
                                )}
                            </div>

                            {error && <div className="auth-feedback" style={{ borderColor: '#d93025', color: '#d93025' }}>{error}</div>}

                            <Button
                                type="submit"
                                variant="primary"
                                loading={submitting}
                                disabled={submitting}
                            >
                                {formData.isAnonymous ? 'Send Anonymously' : 'Send Message'}
                            </Button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Contact

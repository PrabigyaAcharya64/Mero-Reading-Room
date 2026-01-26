
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
        message: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

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
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            await addDoc(collection(db, 'messages'), {
                ...formData,
                userId: user?.uid || null,
                createdAt: serverTimestamp(),
                read: false
            });
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
                        <p className="auth-header__subtext" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            For urgent queries call us at 986-7666655
                        </p>

                        {/* Anonymous Message Link */}
                        <div
                            style={{
                                marginTop: '16px',
                                padding: '12px',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '8px',
                                border: '1px solid #e0e0e0'
                            }}
                        >
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem', color: '#666' }}>
                                Prefer to stay anonymous?
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate('/anonymous-message')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#1976d2',
                                    cursor: 'pointer',
                                    fontSize: '0.9375rem',
                                    fontWeight: 600,
                                    padding: 0,
                                    textDecoration: 'underline',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 1C8.676 1 6 3.676 6 7V10H5C3.895 10 3 10.895 3 12V20C3 21.105 3.895 22 5 22H19C20.105 22 21 21.105 21 20V12C21 10.895 20.105 10 19 10H18V7C18 3.676 15.324 1 12 1ZM9 7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V10H9V7Z" fill="#1976d2" />
                                </svg>
                                Submit anonymous feedback
                            </button>
                        </div>
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
                            {/* Name, Email, and Phone fields are hidden but data is still sent */}

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
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            {error && <div className="auth-feedback" style={{ borderColor: '#d93025', color: '#d93025' }}>{error}</div>}

                            <Button
                                type="submit"
                                variant="primary"
                                loading={submitting}
                                disabled={submitting}
                            >
                                Send Message
                            </Button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Contact

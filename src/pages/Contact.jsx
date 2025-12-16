
import { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import EnhancedBackButton from '../components/EnhancedBackButton';

function Contact({ onBack }) {
    const { user } = useAuth();
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
            <header className="landing-header">
                <EnhancedBackButton onBack={onBack} />
                <h1 style={{ margin: 0, fontFamily: 'var(--brand-font-serif)', fontSize: '1.5rem' }}>Contact Us</h1>
                <div style={{ width: '40px' }}></div> {/* Spacer for alignment */}
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

                            <button type="submit" className="cta-button cta-button--primary" disabled={submitting}>
                                {submitting ? 'Sending...' : 'Send Message'}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Contact

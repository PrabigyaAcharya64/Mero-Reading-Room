import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import Button from '../../components/Button';

function AnonymousMessage({ onBack }) {
    const [formData, setFormData] = useState({
        subject: '',
        message: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

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
                subject: formData.subject,
                message: formData.message,
                anonymous: true,
                name: 'Anonymous',
                email: 'anonymous@system',
                phone: 'N/A',
                userId: null,
                createdAt: serverTimestamp(),
                read: false
            });
            setSuccess(true);
            setFormData({ subject: '', message: '' });
        } catch (err) {
            console.error('Error sending anonymous message:', err);
            setError('Failed to send message. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="landing-screen">
            {onBack && <EnhancedBackButton onBack={onBack} />}
            <header className="subpage-header">
                <h1 className="subpage-header__title">Anonymous Feedback</h1>
                <div className="subpage-header__spacer"></div>
            </header>

            <main className="landing-body">
                <div className="auth-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div className="auth-header">
                        <h2 className="auth-header__headline">Submit Anonymously</h2>
                        <p className="auth-header__subtext">
                            Your identity will be completely protected. Share your suggestions, problems, or feedback without revealing who you are.
                        </p>
                        <div
                            className="auth-feedback"
                            style={{
                                backgroundColor: '#e8f5e9',
                                borderColor: '#4caf50',
                                color: '#2e7d32',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '12px'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 1C8.676 1 6 3.676 6 7V10H5C3.895 10 3 10.895 3 12V20C3 21.105 3.895 22 5 22H19C20.105 22 21 21.105 21 20V12C21 10.895 20.105 10 19 10H18V7C18 3.676 15.324 1 12 1ZM9 7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V10H9V7Z" fill="#4caf50" />
                            </svg>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                100% Anonymous - No tracking or identification
                            </span>
                        </div>
                    </div>

                    {success ? (
                        <div className="auth-feedback" style={{ backgroundColor: '#e6f4ea', borderColor: '#1e8e3e' }}>
                            Your anonymous message has been sent successfully! Thank you for your feedback.
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
                                <label className="input-field__label" htmlFor="subject">Subject</label>
                                <input
                                    id="subject"
                                    name="subject"
                                    type="text"
                                    value={formData.subject}
                                    onChange={handleChange}
                                    required
                                    placeholder="Brief topic of your message"
                                    className="input-field__input"
                                />
                            </div>

                            <div className="input-field">
                                <label className="input-field__label" htmlFor="message">Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    required
                                    placeholder="Share your suggestion, problem, or feedback..."
                                    rows={6}
                                    style={{
                                        width: '100%',
                                        border: '1px solid var(--color-border)',
                                        padding: '0.85rem 1rem',
                                        fontFamily: 'var(--brand-font-body)',
                                        fontSize: '1rem',
                                        resize: 'vertical',
                                        borderRadius: '4px'
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
                                Send Anonymously
                            </Button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}

export default AnonymousMessage;

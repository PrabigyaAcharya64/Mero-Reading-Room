import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import PageHeader from '../../components/PageHeader';
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
        <div className="std-container">
            <PageHeader title="Anonymous" onBack={onBack} forceShowBack={true} />

            <main className="std-body">
                <div className="discussion-card">
                    <h1 className="page-title">Safe Space</h1>
                    <p className="page-subtitle">
                        Your identity is protected. Share suggestions or feedback without revealing who you are.
                    </p>

                    <div className="form-container">
                        <div className="ios-form-group">
                            <div className="ios-input-group" style={{ backgroundColor: 'rgba(52, 199, 89, 0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 1C8.676 1 6 3.676 6 7V10H5C3.895 10 3 10.895 3 12V20C3 21.105 3.895 22 5 22H19C20.105 22 21 21.105 21 20V12C21 10.895 20.105 10 19 10H18V7C18 3.676 15.324 1 12 1ZM9 7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V10H9V7Z" fill="var(--ios-success)" />
                                    </svg>
                                    <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--ios-success)' }}>
                                        Private & Secure Encryption
                                    </span>
                                </div>
                            </div>
                        </div>

                        {success ? (
                            <div className="success-msg" style={{ textAlign: 'center', padding: '40px 0' }}>
                                <p style={{ fontSize: '18px', marginBottom: '16px' }}>Message sent anonymously!</p>
                                <button
                                    onClick={() => setSuccess(false)}
                                    className="btn-ios-ghost"
                                >
                                    Send another one
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <div className="ios-form-group">
                                    <div className="ios-input-group">
                                        <label className="ios-label" htmlFor="subject">Subject</label>
                                        <input
                                            id="subject"
                                            name="subject"
                                            type="text"
                                            value={formData.subject}
                                            onChange={handleChange}
                                            required
                                            placeholder="Topic"
                                            className="ios-input"
                                        />
                                    </div>

                                    <div className="ios-input-group">
                                        <label className="ios-label" htmlFor="message">Feedback</label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            required
                                            placeholder="Details..."
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
                                        {submitting ? 'Sending...' : 'Send Anonymously'}
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

export default AnonymousMessage;

import { useState } from 'react';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../auth/AuthProvider';

function CreateAnnouncement({ onBack }) {
    const { user } = useAuth();
    const [text, setText] = useState('');
    const [durationValue, setDurationValue] = useState(24);
    const [durationUnit, setDurationUnit] = useState('hours');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

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

    return (
        <div className="landing-screen">
            <header className="landing-header">
                <button onClick={onBack} className="landing-signout" style={{ border: 'none', paddingLeft: 0 }}>
                    ← Back
                </button>
                <h1 style={{ margin: 0, fontFamily: 'var(--brand-font-serif)', fontSize: '1.5rem' }}>New Announcement</h1>
                <div style={{ width: '40px' }}></div>
            </header>

            <main className="landing-body">
                <div className="auth-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div className="auth-header">
                        <h2 className="auth-header__headline">Create Announcement</h2>
                        <p className="auth-header__subtext">
                            This announcement will be visible to all users for the specified duration.
                        </p>
                    </div>

                    {success ? (
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
                                        padding: '0.85rem 1rem',
                                        fontFamily: 'var(--brand-font-body)',
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
                                            fontFamily: 'var(--brand-font-body)'
                                        }}
                                    />
                                    <select
                                        value={durationUnit}
                                        onChange={(e) => setDurationUnit(e.target.value)}
                                        style={{
                                            width: '100%',
                                            border: '1px solid var(--color-border)',
                                            padding: '0.85rem 1rem',
                                            fontSize: '1rem',
                                            fontFamily: 'var(--brand-font-body)',
                                            backgroundColor: 'var(--color-surface)',
                                            borderRadius: 0
                                        }}
                                    >
                                        <option value="hours">Hours</option>
                                        <option value="days">Days</option>
                                    </select>
                                </div>
                            </div>

                            {error && <div className="auth-feedback" style={{ borderColor: '#d93025', color: '#d93025' }}>{error}</div>}

                            <button type="submit" className="cta-button cta-button--primary" disabled={submitting}>
                                {submitting ? 'Creating...' : 'Create Announcement'}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}

export default CreateAnnouncement;

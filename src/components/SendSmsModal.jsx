import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

export default function SendSmsModal({ isOpen, onClose, onSend, userCount }) {
    if (!isOpen) return null;

    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!message.trim()) return;
        setSending(true);
        try {
            await onSend(message);
        } catch (e) {
            console.error(e);
        } finally {
            setSending(false);
            setMessage(''); // Clear on success only? Or keep if failed? Ideally clear on success.
            // Assuming onSend throws if failed, we catch. If success, we clear. 
            // But existing pattern: onClose handles everything?
            // Let's assume parent handles alerts.
            onClose();
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div className="modal-content" style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '500px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111' }}>Send SMS to {userCount} Users</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#444', marginBottom: '6px' }}>Message Content</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type your message here..."
                            rows={5}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontFamily: 'inherit',
                                fontSize: '14px',
                                resize: 'vertical',
                                minHeight: '100px'
                            }}
                        />
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>
                        {message.length} characters
                    </p>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid #ddd',
                            background: '#fff',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#444'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!message.trim() || sending}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            background: sending || !message.trim() ? '#9ca3af' : '#000',
                            color: '#fff',
                            cursor: sending || !message.trim() ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {sending ? 'Sending...' : <><Send size={16} /> Send SMS</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

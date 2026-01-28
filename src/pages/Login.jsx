import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useLoading } from '../context/GlobalLoadingContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import '../styles/Auth.css';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInEmail, signInWithGoogle, resetPassword } = useAuth();
  const { setIsLoading } = useLoading();
  const [form, setForm] = useState({ email: '', password: '' });
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Get the redirect path from location state, default to root
  const from = location.state?.from?.pathname || "/";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.email || !form.password) {
      setFeedback({ type: 'error', message: 'Please enter both email and password.' });
      return;
    }

    try {
      setIsLoading(true);
      await signInEmail(form.email, form.password);
      // We don't clear loading here, let the next page handle the reveal
      navigate(from, { replace: true });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to sign in right now.' });
      setIsLoading(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.trim()) {
      setFeedback({ type: 'error', message: 'Please enter your email address.' });
      return;
    }

    setResetting(true);
    setFeedback({ type: '', message: '' });
    try {
      await resetPassword(resetEmail);
      setFeedback({ type: 'success', message: 'Password reset link sent! Check your inbox.' });
      setTimeout(() => {
        setShowResetPassword(false);
        setResetEmail('');
        setFeedback({ type: '', message: '' });
      }, 3000);
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to send reset email.' });
    } finally {
      setResetting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      setIsLoading(true);
      await signInWithGoogle();
      // Next page handles reveal
      navigate(from, { replace: true });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to sign in with Google.' });
      setIsLoading(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <h1 className="auth-title anim-title">LOGIN</h1>

      <form onSubmit={handleSubmit} className="anim-delay-1">
        <div className="input-group">
          <input
            className="auth-input"
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
        </div>

        <div className="input-group anim-delay-2">
          <div className="password-wrapper">
            <input
              className="auth-input"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div className="forgot-password anim-delay-3">
          <button type="button" className="forgot-password-btn" onClick={() => setShowResetPassword(true)}>
            Forgot Password?
          </button>
        </div>

        <div className="anim-delay-4">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={submitting}
            disabled={submitting}
          >
            LOGIN
          </Button>
        </div>

        <div className="google-btn-container anim-delay-5">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={handleGoogle}
            disabled={submitting}
          >
            Continue with Google
          </Button>
        </div>

        <div className="auth-switch-container anim-delay-6">
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => navigate('/signup')}
          >
            SIGN UP
          </Button>
        </div>
      </form>

      {/* Feedback Message */}
      {feedback.message && (
        <div className={`auth-feedback ${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetPassword && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Reset Password</h3>
            <p className="modal-desc">Enter your email to receive a reset link.</p>

            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              autoFocus
            />

            {feedback.message && feedback.type === 'error' && (
              <p className="validation-text error" style={{ marginTop: 10 }}>{feedback.message}</p>
            )}

            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => {
                  setShowResetPassword(false);
                  setFeedback({ type: '', message: '' });
                }}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-confirm"
                onClick={handleResetPassword}
                disabled={resetting}
              >
                {resetting ? 'Sending...' : 'Send Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;



import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

function Login({ onSwitch }) {
  const { signInEmail, signInWithGoogle, resetPassword } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.email || !form.password) {
      setFeedback('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    setFeedback('');
    try {
      await signInEmail(form.email, form.password);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setShowResetPassword(true);
    setFeedback('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.trim()) {
      setFeedback('Please enter your email address.');
      return;
    }

    setResetting(true);
    setFeedback('');
    try {
      await resetPassword(resetEmail);
      setFeedback('Password reset email sent! Please check your inbox and follow the instructions.');
      setShowResetPassword(false);
      setResetEmail('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to send password reset email.');
    } finally {
      setResetting(false);
    }
  };

  const handleCancelReset = () => {
    setShowResetPassword(false);
    setResetEmail('');
    setFeedback('');
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    setFeedback('');
    try {
      await signInWithGoogle();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to sign in with Google.');
    } finally {
      setSubmitting(false);
    }
  };

  if (showResetPassword) {
    return (
      <div className="auth-card">
        <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Reset Password</h2>
        <form className="auth-form" onSubmit={handleResetPassword}>
          <label className="input-field">
            <span className="input-field__label">Email</span>
            <input
              type="email"
              name="resetEmail"
              placeholder="reader@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <button type="submit" className="cta-button cta-button--primary" disabled={resetting}>
            {resetting ? 'Sending…' : 'Send Reset Link'}
          </button>

          <button
            type="button"
            className="cta-button cta-button--secondary"
            onClick={handleCancelReset}
            disabled={resetting}
          >
            Cancel
          </button>
        </form>

        {feedback ? <p className="auth-feedback">{feedback}</p> : null}
      </div>
    );
  }

  return (
    <div className="auth-card">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="input-field">
          <span className="input-field__label">Email</span>
          <input
            type="email"
            name="email"
            placeholder="reader@example.com"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
        </label>

        <label className="input-field">
          <span className="input-field__label">Password</span>
          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
            required
          />
        </label>

        <div className="auth-form__meta">
          <button type="button" className="link-button" onClick={handleForgotPassword}>
            Forgot password?
          </button>
        </div>

        <button type="submit" className="cta-button cta-button--primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Log in'}
        </button>

        <button
          type="button"
          className="cta-button cta-button--secondary"
          onClick={handleGoogle}
          disabled={submitting}
        >
          Continue with Google
        </button>
      </form>

      {feedback ? <p className="auth-feedback">{feedback}</p> : null}

      <p className="auth-footnote">
        New here?{' '}
        <button type="button" className="link-button" onClick={onSwitch}>
          Create an account
        </button>
      </p>
    </div>
  );
}

export default Login;


import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';

function Login({ onSwitch }) {
  const { signInEmail, signInWithGoogle, resetPassword } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);
<<<<<<< HEAD
  const [showPassword, setShowPassword] = useState(false);
=======
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754

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

          <button type="submit" className="cta-button cta-button--primary" disabled={resetting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {resetting ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'Send Reset Link'}
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
<<<<<<< HEAD
    <div className="center-screen">
      <div className="auth-card">
        <h1 className="auth-header__eyebrow auth-title">LOGIN</h1>
      
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-field animate-enter animate-enter-delay-1">
          <input
            type="email"
            name="email"
            placeholder="Email"
=======
    <div className="auth-card">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="input-field">
          <span className="input-field__label">Email</span>
          <input
            type="email"
            name="email"
            placeholder="reader@example.com"
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
<<<<<<< HEAD
        </div>

        <div className="input-field animate-enter animate-enter-delay-2" style={{ position: 'relative' }}>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
=======
        </label>

        <label className="input-field">
          <span className="input-field__label">Password</span>
          <input
            type="password"
            name="password"
            placeholder="Enter your password"
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
            required
<<<<<<< HEAD
            style={{ paddingRight: '45px' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #888)',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #333)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary, #888)'}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>

        <div className="auth-form__meta animate-enter animate-enter-delay-3">
          <button type="button" className="link-button" onClick={handleForgotPassword}>
            Forgot Password?
          </button>
        </div>

        <div className="animate-enter animate-enter-delay-4">
            <button type="submit" className="cta-button cta-button--primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {submitting ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'LOGIN'}
            </button>
        </div>

        <div className="animate-enter animate-enter-delay-4">
             <button
                type="button"
                className="cta-button cta-button--secondary"
                onClick={handleGoogle}
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px' }}
                >
                {submitting ? <LoadingSpinner size="20" stroke="2.5" color="currentColor" /> : 'Continue with Google'}
            </button>
        </div>

        <div className="animate-enter animate-enter-delay-4">
             <button
                type="button"
                className="cta-button cta-button--secondary"
                onClick={onSwitch}
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '0px' }}
                >
                SIGN UP
            </button>
        </div>
      </form>

      {feedback ? <p className="auth-feedback animate-enter">{feedback}</p> : null}

    </div>
=======
          />
        </label>

        <div className="auth-form__meta">
          <button type="button" className="link-button" onClick={handleForgotPassword}>
            Forgot password?
          </button>
        </div>

        <button type="submit" className="cta-button cta-button--primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {submitting ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'Log in'}
        </button>

        <button
          type="button"
          className="cta-button cta-button--secondary"
          onClick={handleGoogle}
          disabled={submitting}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {submitting ? <LoadingSpinner size="20" stroke="2.5" color="currentColor" /> : 'Continue with Google'}
        </button>
      </form>

      {feedback ? <p className="auth-feedback">{feedback}</p> : null}

      <p className="auth-footnote">
        New here?{' '}
        <button type="button" className="link-button" onClick={onSwitch}>
          Create an account
        </button>
      </p>
>>>>>>> e4917c87706b066e979d3ed8011ba6e0c6738754
    </div>
  );
}

export default Login;


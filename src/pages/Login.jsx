import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

function Login({ onSwitch }) {
  const { signInEmail, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    setFeedback('Password reset is coming soon. Contact support in the meantime.');
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


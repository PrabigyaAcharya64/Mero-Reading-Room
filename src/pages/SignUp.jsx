import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../auth/AuthProvider';
import { auth } from '../lib/firebase';

function SignUp({ onSwitch }) {
  const { signUpEmail, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      setFeedback('Passwords must match.');
      return;
    }

    if (!form.email || !form.password) {
      setFeedback('Email and password are required.');
      return;
    }

    setSubmitting(true);
    setFeedback('');

    try {
      await signUpEmail(form.email, form.password);

      if (auth.currentUser && form.name.trim()) {
        await updateProfile(auth.currentUser, { displayName: form.name.trim() });
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    setFeedback('');
    try {
      await signInWithGoogle();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Google sign-up is unavailable.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="input-field">
          <span className="input-field__label">Full name</span>
          <input
            type="text"
            name="name"
            placeholder="Reader Name"
            value={form.name}
            onChange={handleChange}
            autoComplete="name"
            required
          />
        </label>

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
            placeholder="Create a password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>

        <label className="input-field">
          <span className="input-field__label">Confirm password</span>
          <input
            type="password"
            name="confirmPassword"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>

        <button type="submit" className="cta-button cta-button--primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <button
          type="button"
          className="cta-button cta-button--secondary"
          onClick={handleGoogle}
          disabled={submitting}
        >
          Sign up with Google
        </button>
      </form>

      {feedback ? <p className="auth-feedback">{feedback}</p> : null}

      <p className="auth-footnote">
        Already have an account?{' '}
        <button type="button" className="link-button" onClick={onSwitch}>
          Log in instead
        </button>
      </p>
    </div>
  );
}

export default SignUp;


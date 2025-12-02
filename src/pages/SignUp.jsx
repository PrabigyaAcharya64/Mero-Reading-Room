import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../auth/AuthProvider';
import { auth } from '../lib/firebase';
import { validatePassword, validateEmail, validateName } from '../utils/validation';
import LoadingSpinner from '../components/LoadingSpinner';

function SignUp({ onSwitch, onComplete }) {
  const { signUpEmail, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Validate password in real-time
    if (name === 'password') {
      const validation = validatePassword(value);
      setPasswordStrength(validation);
    } else if (name === 'confirmPassword' && form.password) {
      // Clear password strength when confirming
      setPasswordStrength(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate name
    const nameValidation = validateName(form.name, 'Full name');
    if (!nameValidation.valid) {
      setFeedback(nameValidation.error);
      return;
    }

    // Validate email
    const emailValidation = validateEmail(form.email);
    if (!emailValidation.valid) {
      setFeedback(emailValidation.error);
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(form.password);
    if (!passwordValidation.valid) {
      setFeedback(passwordValidation.error);
      return;
    }

    // Check password match
    if (form.password !== form.confirmPassword) {
      setFeedback('Passwords must match.');
      return;
    }

    setSubmitting(true);
    setFeedback('');

    try {
      await signUpEmail(emailValidation.sanitized, form.password);

      if (auth.currentUser && nameValidation.sanitized) {
        await updateProfile(auth.currentUser, { displayName: nameValidation.sanitized });
      }

      // Redirect to additional details page after successful signup
      if (onComplete) {
        onComplete();
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
      // For Google sign-in, also redirect to additional details if needed
      // The navigation will handle this based on user status
      if (onComplete) {
        onComplete();
      }
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
            placeholder="Create a password (min. 8 chars, uppercase, lowercase, number, special)"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
            minLength={8}
          />
          {passwordStrength && !passwordStrength.valid && form.password && (
            <p style={{ fontSize: '12px', color: '#f44', marginTop: '5px' }}>
              {passwordStrength.error}
            </p>
          )}
          {passwordStrength && passwordStrength.valid && (
            <p style={{ fontSize: '12px', color: '#4a4', marginTop: '5px' }}>
              ✓ Password strength: Good
            </p>
          )}
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
            minLength={8}
          />
          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p style={{ fontSize: '12px', color: '#f44', marginTop: '5px' }}>
              Passwords do not match.
            </p>
          )}
          {form.confirmPassword && form.password === form.confirmPassword && form.password && (
            <p style={{ fontSize: '12px', color: '#4a4', marginTop: '5px' }}>
              ✓ Passwords match
            </p>
          )}
        </label>

        <button type="submit" className="cta-button cta-button--primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {submitting ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'Create account'}
        </button>

        <button
          type="button"
          className="cta-button cta-button--secondary"
          onClick={handleGoogle}
          disabled={submitting}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {submitting ? <LoadingSpinner size="20" stroke="2.5" color="currentColor" /> : 'Sign up with Google'}
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


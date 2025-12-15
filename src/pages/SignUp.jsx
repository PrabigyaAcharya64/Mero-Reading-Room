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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    <div className="center-screen">
       <div className="auth-card">
      <h1 className="auth-header__eyebrow auth-title">SIGN UP</h1>
      
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-field animate-enter animate-enter-delay-1">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            autoComplete="name"
            required
          />
        </div>

        <div className="input-field animate-enter animate-enter-delay-1">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
        </div>

        <div className="input-field animate-enter animate-enter-delay-2" style={{ position: 'relative' }}>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password (min. 8 chars, uppercase, lowercase, number...)"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
            minLength={8}
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
          {passwordStrength && !passwordStrength.valid && form.password && (
            <p style={{ fontSize: '12px', color: '#f44', marginTop: '5px', paddingLeft: '4px' }}>
              {passwordStrength.error}
            </p>
          )}
          {passwordStrength && passwordStrength.valid && (
            <p style={{ fontSize: '12px', color: '#4a4', marginTop: '5px', paddingLeft: '4px' }}>
              ✓ Password strength: Good
            </p>
          )}
        </div>

        <div className="input-field animate-enter animate-enter-delay-2" style={{ position: 'relative' }}>
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            required
            minLength={8}
            style={{ paddingRight: '45px' }}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? (
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
          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p style={{ fontSize: '12px', color: '#f44', marginTop: '5px', paddingLeft: '4px' }}>
              Passwords do not match.
            </p>
          )}
          {form.confirmPassword && form.password === form.confirmPassword && form.password && (
            <p style={{ fontSize: '12px', color: '#4a4', marginTop: '5px', paddingLeft: '4px' }}>
              ✓ Passwords match
            </p>
          )}
        </div>

        <div className="animate-enter animate-enter-delay-3">
            <button type="submit" className="cta-button cta-button--primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {submitting ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'SIGN UP'}
            </button>
        </div>

        <div className="animate-enter animate-enter-delay-3">
             <button
                type="button"
                className="cta-button cta-button--secondary"
                onClick={handleGoogle}
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px' }}
                >
                {submitting ? <LoadingSpinner size="20" stroke="2.5" color="currentColor" /> : 'Sign up with Google'}
            </button>
        </div>

        <div className="animate-enter animate-enter-delay-3">
             <button
                type="button"
                className="cta-button cta-button--secondary"
                onClick={onSwitch}
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '0px' }}
                >
                LOGIN
            </button>
        </div>
      </form>

      {feedback ? <p className="auth-feedback animate-enter">{feedback}</p> : null}

    </div>
   </div>
  );
}

export default SignUp;


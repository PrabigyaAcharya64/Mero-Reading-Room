import React, { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../auth/AuthProvider';
import { auth } from '../lib/firebase';
import { validatePassword, validateEmail, validateName } from '../utils/validation';
import LoadingSpinner from '../components/LoadingSpinner';
import './Auth.css';

function SignUp({ onSwitch, onComplete }) {
  const { signUpEmail, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [feedback, setFeedback] = useState({ type: '', message: '' });
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
      // Clear password strength when confirming (optional)
      // or verify match here if desired
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate name
    const nameValidation = validateName(form.name, 'Full name');
    if (!nameValidation.valid) {
      setFeedback({ type: 'error', message: nameValidation.error });
      return;
    }

    // Validate email
    const emailValidation = validateEmail(form.email);
    if (!emailValidation.valid) {
      setFeedback({ type: 'error', message: emailValidation.error });
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(form.password);
    if (!passwordValidation.valid) {
      setFeedback({ type: 'error', message: passwordValidation.error });
      return;
    }

    // Check password match
    if (form.password !== form.confirmPassword) {
      setFeedback({ type: 'error', message: 'Passwords must match.' });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: '', message: '' });

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
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to create your account.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    setFeedback({ type: '', message: '' });
    try {
      await signInWithGoogle();
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Google sign-up is unavailable.' });
    } finally {
      setSubmitting(false);
    }
  };

  const passwordsMatch = form.confirmPassword && form.password === form.confirmPassword;

  return (
    <div className="auth-container">
      <h1 className="auth-title anim-title">SIGN UP</h1>

      <form onSubmit={handleSubmit} className="anim-delay-1">
        <div className="input-group">
          <input
            className="auth-input"
            type="text"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            required
            autoComplete="name"
          />
        </div>

        <div className="input-group anim-delay-2">
          <input
            className="auth-input"
            type="email"
            name="email"
            placeholder="Email Address"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
        </div>

        <div className="input-group anim-delay-3">
          <div className="password-wrapper">
            <input
              className="auth-input"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
            <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
            >
                {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {passwordStrength && !passwordStrength.valid && form.password.length > 0 && (
            <span className="validation-text error">{passwordStrength.error}</span>
          )}
          {passwordStrength && passwordStrength.valid && form.password.length > 0 && (
            <span className="validation-text success">✓ Password strength: Good</span>
          )}
        </div>

        <div className="input-group anim-delay-4">
          <div className="password-wrapper">
            <input
              className="auth-input"
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
            <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {form.confirmPassword && !passwordsMatch && (
            <span className="validation-text error">Passwords do not match.</span>
          )}
          {form.confirmPassword && passwordsMatch && (
             <span className="validation-text success">✓ Passwords match</span>
          )}
        </div>

        <div className="anim-delay-5">
            <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? <LoadingSpinner size="20" stroke="2.5" color="white" /> : 'CREATE ACCOUNT'}
            </button>
        </div>

        <div className="google-btn-container anim-delay-6">
            <button
            type="button"
            className="secondary-btn"
            onClick={handleGoogle}
            disabled={submitting}
            style={{borderColor: '#ddd', color: '#555'}}
            >
             Sign up with Google
            </button>
        </div>

        <div className="anim-delay-6">
            <button
            type="button"
            className="secondary-btn"
            onClick={onSwitch}
            >
            BACK TO LOGIN
            </button>
        </div>
      </form>

      {feedback.message && (
        <div className={`auth-feedback ${feedback.type}`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
}

export default SignUp;


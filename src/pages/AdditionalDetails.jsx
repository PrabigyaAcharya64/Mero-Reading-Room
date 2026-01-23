import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import LoadingSpinner from '../components/LoadingSpinner';
import FullScreenLoader from '../components/FullScreenLoader';
import Button from '../components/Button';
import readingRoomIcon from '../assets/readingroom.svg';
import hostelIcon from '../assets/hostel.svg';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

function AdditionalDetails({ onComplete }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    phoneNumber: '',
    interestedIn: [],
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [mrrNumber, setMrrNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingMrr, setGeneratingMrr] = useState(true);
  const interestOptions = [
    {
      value: 'Reading Room',
      label: 'Reading Room',
      helper: 'Quiet study spaces and resources',
      icon: readingRoomIcon
    },
    {
      value: 'Hostel',
      label: 'Hostel',
      helper: 'Accommodation and support',
      icon: hostelIcon
    }
  ];

  useEffect(() => {
    // Load user's display name from Firebase
    if (user?.displayName) {
      setFormData(prev => ({ ...prev, name: user.displayName }));
    } else if (user?.email) {
      // Extract name from email if displayName not available
      const nameFromEmail = user.email.split('@')[0];
      setFormData(prev => ({ ...prev, name: nameFromEmail }));
    }

    // Generate MRR number
    generateMrrNumber();
  }, [user]);

  const generateMrrNumber = async () => {
    try {

      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('mrrNumber', '!=', ''),
        orderBy('mrrNumber', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      let nextMrrNumber = 'MRR001';

      if (!snapshot.empty) {
        const latestUser = snapshot.docs[0].data();
        if (latestUser.mrrNumber) {

          const latestNum = parseInt(latestUser.mrrNumber.replace('MRR', ''), 10);
          const nextNum = latestNum + 1;
          nextMrrNumber = `MRR${nextNum.toString().padStart(3, '0')}`;
        }
      }

      setMrrNumber(nextMrrNumber);
      setGeneratingMrr(false);
    } catch (error) {
      console.error('Error generating MRR number:', error);
      const timestamp = Date.now().toString().slice(-6);
      setMrrNumber(`MRR${timestamp}`);
      setGeneratingMrr(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleInterestToggle = (value) => {
    setFormData(prev => {
      const currentInterests = prev.interestedIn || [];
      const isSelected = currentInterests.includes(value);
      return {
        ...prev,
        interestedIn: isSelected
          ? currentInterests.filter(item => item !== value)
          : [...currentInterests, value]
      };
    });
    setError('');
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo size should be less than 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const uploadPhoto = async () => {
    if (!photoFile) return null;

    try {
      const formData = new FormData();
      formData.append('image', photoFile);
      formData.append('key', IMGBB_API_KEY);

      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        return data.data.url;
      } else {
        throw new Error('Photo upload failed');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw new Error('Failed to upload photo. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (!formData.dateOfBirth) {
      setError('Date of birth is required');
      return;
    }

    if (!formData.phoneNumber || !formData.phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }

    if (!formData.interestedIn || formData.interestedIn.length === 0) {
      setError('Please select at least one interest');
      return;
    }

    if (!photoFile) {
      setError('Photo is required');
      return;
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(formData.phoneNumber.replace(/\D/g, ''))) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);

    try {
      // Upload photo
      const photoUrl = await uploadPhoto();

      // Update user profile with name
      if (user && formData.name.trim() !== user.displayName) {
        await updateProfile(user, { displayName: formData.name.trim() });
      }

      // Save additional details to Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const existingData = userDoc.exists() ? userDoc.data() : {};

      await setDoc(userDocRef, {
        ...existingData,
        name: formData.name.trim(),
        email: user.email, // Ensure email is saved
        dateOfBirth: formData.dateOfBirth,
        phoneNumber: formData.phoneNumber.trim(),
        interestedIn: Array.isArray(formData.interestedIn) ? formData.interestedIn : [formData.interestedIn],
        photoUrl: photoUrl,
        mrrNumber: mrrNumber,
        // verified: false, // Security Rule Violation: User cannot update protected field 'verified'
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Sign out user and redirect to pending verification page
      await signOut(auth);

      // Update URL to show pending verification
      window.history.replaceState({}, '', '?pending=true');

      // Call onComplete to navigate to pending verification page
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error saving details:', error);
      setError(error instanceof Error ? error.message : 'Failed to save details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (generatingMrr) {
    return <FullScreenLoader text="Generating your MRR number..." />;
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Enter Additional Details</h2>
        <p style={{ marginBottom: '20px', textAlign: 'center', color: '#666' }}>
          Please complete your profile to continue
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="input-field">
            <span className="input-field__label">Name</span>
            <input
              type="text"
              name="name"
              placeholder="Your full name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </label>

          <label className="input-field">
            <span className="input-field__label">MRR Number</span>
            <input
              type="text"
              value={mrrNumber}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            />
            <small style={{ fontSize: '12px', color: '#666', marginTop: '5px', display: 'block' }}>
              This is your unique identification number
            </small>
          </label>

          <label className="input-field">
            <span className="input-field__label">Date of Birth</span>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </label>

          <label className="input-field">
            <span className="input-field__label">Phone Number</span>
            <input
              type="tel"
              name="phoneNumber"
              placeholder="10-digit phone number"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
            />
          </label>

          <div className="input-field">
            <span className="input-field__label" style={{ display: 'block', marginBottom: '10px' }}>
              What are you currently enrolled in, or planning to enroll in? <span style={{ color: '#f44' }}>*</span>
            </span>
            <div className="interest-card-grid">
              {interestOptions.map((option) => {
                const isSelected = formData.interestedIn.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`interest-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleInterestToggle(option.value)}
                    aria-pressed={isSelected}
                  >
                    <span className="interest-card__icon">
                      <img src={option.icon} alt="" aria-hidden="true" />
                    </span>
                    <span className="interest-card__content">
                      <span className="interest-card__label">{option.label}</span>
                      <span className="interest-card__helper">{option.helper}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="input-field">
            <span className="input-field__label">Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
            {photoPreview && (
              <div style={{ marginTop: '10px' }}>
                <img
                  src={photoPreview}
                  alt="Preview"
                  style={{
                    width: '150px',
                    height: '150px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                  }}
                />
              </div>
            )}
          </label>

          {error && <p className="auth-feedback" style={{ color: '#f44' }}>{error}</p>}

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
}

export default AdditionalDetails;


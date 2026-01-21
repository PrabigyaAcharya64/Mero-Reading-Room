import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import EnhancedBackButton from '../components/EnhancedBackButton';
import PageHeader from '../components/PageHeader';
import '../styles/IDCard.css';

const logoUrl = new URL('../assets/logo.png', import.meta.url).href;

function IDCard({ onBack }) {
  const { user, signOutUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        setUserData({
          id: userDoc.id,
          ...userDoc.data(),
        });
      } else {
        setUserData({
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dob) => {
    if (!dob) return 'N/A';
    try {
      if (dob.toDate) {
        return dob.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      const date = new Date(dob);
      if (isNaN(date.getTime())) return dob.toString();
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dob.toString();
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const downloadIDCard = async () => {
    if (!userData) return;

    try {
      setDownloading(true);
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;

      const card = document.getElementById('id-card');
      if (!card) {
        alert('ID card element not found');
        return;
      }

      const canvas = await html2canvas(card, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: card.offsetWidth,
        height: card.offsetHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `MRR_ID_Card_${userData.mrrNumber || userData.id}.png`;
      link.href = imgData;
      link.click();
    } catch (error) {
      console.error('Error generating ID card:', error);
      alert('Error generating ID card. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="app-loader">
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="profile-container">
        <div className="profile-main">
          <p>Unable to load user data.</p>
          {onBack && (
            <button className="profile-btn profile-btn--download" onClick={onBack}>
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <PageHeader title="My Profile" onBack={onBack} />

      <main className="profile-main">
        <div className="id-card-preview-wrapper">
          <div id="id-card" className="id-card">
            {/* LEFT SIDE BAR */}
            <div className="id-card__left-bar" />

            {/* RIGHT SIDE BAR */}
            <div className="id-card__right-bar" />

            {/* LOGO */}
            <div className="id-card__logo-container">
              <img src={logoUrl} alt="Logo" className="id-card__logo-img" />
            </div>

            {/* ADDRESS */}
            <p className="id-card__location-text">Mid Baneshwor, Kathmandu</p>

            {/* PHONE */}
            <p className="id-card__phone-text">986-7666655</p>

            {/* PHOTO */}
            <div className="id-card__photo-container">
              {userData.photoUrl ? (
                <img src={userData.photoUrl} alt={userData.name} className="id-card__photo" />
              ) : (
                <div className="id-card__photo-placeholder">
                  <span style={{ fontSize: '30px' }}>👤</span>
                </div>
              )}
            </div>

            {/* NAME */}
            <h2 className="id-card__name-text">{userData.name || 'N/A'}</h2>

            {/* INFO FIELDS */}
            <div className="id-card__info-rows">
              <div className="id-card__row">
                <span className="id-card__label">MRR ID:</span>
                <span className="id-card__value">{userData.mrrNumber || 'N/A'}</span>
              </div>

              <div className="id-card__row">
                <span className="id-card__label">Blood:</span>
                <span className="id-card__value">{userData.bloodGroup || 'N/A'}</span>
              </div>

              <div className="id-card__row">
                <span className="id-card__label">Phone:</span>
                <span className="id-card__value">{userData.phoneNumber || 'N/A'}</span>
              </div>

              <div className="id-card__row">
                <span className="id-card__label">Email:</span>
                <span className="id-card__value">{userData.email || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-actions">
          <button
            className="profile-btn profile-btn--download"
            onClick={downloadIDCard}
            disabled={downloading}
          >
            {downloading ? 'Generating...' : 'Download ID Card'}
          </button>

          <button className="profile-btn profile-btn--signout" onClick={handleSignOut}>
            Sign Out
          </button>

          <p className="profile-info-text">
            Your ID card is used for entry and verification at Mero Reading Room.
          </p>
        </div>
      </main>
    </div>
  );
}

export default IDCard;
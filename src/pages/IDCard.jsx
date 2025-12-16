import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import EnhancedBackButton from '../components/EnhancedBackButton';

const logoUrl = new URL('../assets/logo.png', import.meta.url).href;

function IDCard({ onBack }) {
  const { user, signOutUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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
        // If no document, use auth user data
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
      // Handle Firestore Timestamp
      if (dob.toDate) {
        return dob.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      // Handle string date
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

  const downloadIDCard = async () => {
    if (!userData) return;

    try {
      setDownloading(true);
      
      // Dynamically import html2canvas
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
        windowWidth: card.scrollWidth,
        windowHeight: card.scrollHeight,
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
      <div className="landing-screen">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading your ID card...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="landing-screen">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Unable to load user data.</p>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="landing-screen">
      <header className="landing-header" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          {onBack && <EnhancedBackButton onBack={onBack} />}
        </div>
        
        <p className="landing-greeting" style={{ flex: 1, textAlign: 'center', margin: 0 }}>My ID Card</p>
        
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="landing-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ 
        padding: '40px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center' 
      }}>
        <div
          id="id-card"
          style={{
            width: '350px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '25px 35px', // Padding to account for side bars + whitespace
            boxSizing: 'border-box',
            border: '1px solid #ddd',
            fontFamily: 'var(--brand-font-body)',
          }}
        >
          {/* Left Blue Bar */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '12px',
            backgroundColor: '#003B73',
          }} />

          {/* Right Blue Bar */}
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '12px',
            backgroundColor: '#003B73',
          }} />

          {/* Logo Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
            <img
              src={logoUrl}
              alt="MRR Logo"
              style={{
                width: '90px',
                height: '60px',
                objectFit: 'contain',
                marginBottom: '5px',
              }}
            />
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#888',
              fontStyle: 'italic',
              textAlign: 'center',
            }}>
              Mid Baneshwor, Kathmandu
            </p>
          </div>

          {/* Photo Section */}
          <div style={{ marginBottom: '15px' }}>
            {userData.photoUrl ? (
              <img
                src={userData.photoUrl}
                alt={userData.name || 'User'}
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '12px',
                  border: '3px solid #003B73',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              style={{
                width: '180px',
                height: '180px',
                backgroundColor: '#f5f5f5',
                borderRadius: '12px',
                border: '3px solid #003B73',
                display: userData.photoUrl ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '10px',
                textAlign: 'center',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '5px' }}>👤</div>
            </div>
          </div>

          {/* Name */}
          <h2 style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#003B73',
            margin: '12px 0 20px 0',
            textTransform: 'uppercase',
            textAlign: 'center',
            letterSpacing: '0.5px',
            wordBreak: 'break-word',
          }}>
            {userData.name || "N/A"}
          </h2>

          {/* Info Fields */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* MRR ID */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px' }}>MRR ID:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#222' }}>{userData.mrrNumber || "N/A"}</span>
            </div>

            {/* Blood Group */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Blood:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#222' }}>{userData.bloodGroup || "N/A"}</span>
            </div>

            {/* Phone */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Phone:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#222' }}>{userData.phoneNumber || "N/A"}</span>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Email:</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#222', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userData.email}>{userData.email || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={downloadIDCard}
          disabled={downloading}
          style={{
            marginTop: '30px',
            padding: '16px 32px',
            backgroundColor: downloading ? '#666' : '#000',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: downloading ? 'not-allowed' : 'pointer',
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '0.5px',
            width: '100%',
            maxWidth: '350px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!downloading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 8px rgba(0,0,0,0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!downloading) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            }
          }}
        >
          {downloading ? 'Generating...' : 'Download ID Card'}
        </button>

        <p style={{ 
          marginTop: '20px', 
          fontSize: '12px', 
          color: '#666', 
          textAlign: 'center', 
          maxWidth: '350px' 
        }}>
          Click the button above to download your ID card.
        </p>
      </main>
    </div>
  );
}

export default IDCard;
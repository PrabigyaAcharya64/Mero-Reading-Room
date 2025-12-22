import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const logoUrl = new URL('../assets/logo.png', import.meta.url).href;

function IDCard({ onBack }) {
  const { user } = useAuth();
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
      <header className="landing-header" style={{ marginBottom: '20px' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          {onBack && (
            <EnhancedBackButton onBack={onBack} />
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <p style={{ fontWeight: 'bold', fontSize: '18px', fontFamily: 'var(--brand-font-serif)', margin: 0 }}>My ID Card</p>
        </div>
        <div style={{ flex: 1 }}></div>
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
            width: '400px',
            height: '260px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            padding: '20px',
            border: '2px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* Header with Logo and Title */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start', 
            marginBottom: '16px',
            gap: '12px',
            height: '50px',
          }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: '17px', 
                fontWeight: 'bold', 
                color: '#1a1a1a', 
                letterSpacing: '0.5px',
                lineHeight: '1.2',
                marginBottom: '4px',
              }}>
                Mero Reading Room
              </h2>
              <p style={{ 
                margin: 0, 
                fontSize: '9px', 
                color: '#666', 
                lineHeight: '1.3',
                marginBottom: '2px',
              }}>
                Mid Baneshwor, Kathmandu, Nepal
              </p>
              <p style={{ margin: 0, fontSize: '9px', color: '#666', lineHeight: '1.3' }}>
                986-7666655
              </p>
            </div>
            <img
              src={logoUrl}
              alt="MRR Logo"
              style={{
                width: '48px',
                height: '48px',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
          </div>

          {/* Main Content */}
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            height: '120px',
            marginBottom: '12px',
          }}>
            {/* Left Side - Photo */}
            <div style={{ flexShrink: 0, width: '85px', height: '120px', position: 'relative' }}>
              {userData.photoUrl ? (
                <img
                  src={userData.photoUrl}
                  alt={userData.name || 'User'}
                  style={{
                    width: '85px',
                    height: '120px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '2px solid #ddd',
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
                  width: '85px',
                  height: '120px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '8px',
                  border: '2px solid #ddd',
                  display: userData.photoUrl ? 'none' : 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  fontSize: '10px',
                  textAlign: 'center',
                  flexDirection: 'column',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                <div style={{ fontSize: '22px', marginBottom: '3px' }}>👤</div>
                <div>No Photo</div>
              </div>
            </div>

            {/* Right Side - User Info */}
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              minWidth: 0,
              justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '9px', 
                  color: '#666', 
                  fontWeight: '600', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  lineHeight: '1.2',
                  marginBottom: '3px',
                }}>
                  Name
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: '#1a1a1a',
                  lineHeight: '1.3',
                  wordBreak: 'break-word',
                }}>
                  {userData.name || 'N/A'}
                </p>
              </div>

              <div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '9px', 
                  color: '#666', 
                  fontWeight: '600', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  lineHeight: '1.2',
                  marginBottom: '3px',
                }}>
                  MRR ID
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#0066cc',
                  lineHeight: '1.3',
                  wordBreak: 'break-word',
                }}>
                  {userData.mrrNumber || 'N/A'}
                </p>
              </div>

              <div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '9px', 
                  color: '#666', 
                  fontWeight: '600', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  lineHeight: '1.2',
                  marginBottom: '3px',
                }}>
                  Date of Birth
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: '10px', 
                  color: '#333',
                  lineHeight: '1.3',
                  wordBreak: 'break-word',
                }}>
                  {formatDate(userData.dateOfBirth)}
                </p>
              </div>

              <div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '9px', 
                  color: '#666', 
                  fontWeight: '600', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  lineHeight: '1.2',
                  marginBottom: '3px',
                }}>
                  Phone
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: '10px', 
                  color: '#333',
                  lineHeight: '1.3',
                  wordBreak: 'break-word',
                }}>
                  {userData.phoneNumber || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            paddingTop: '10px', 
            borderTop: '1px solid #e0e0e0',
            marginTop: 'auto',
          }}>
            <p style={{ 
              margin: 0, 
              fontSize: '7px', 
              color: '#999', 
              textAlign: 'center',
              lineHeight: '1.2',
            }}>
              This is an official identification card
            </p>
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={downloadIDCard}
          disabled={downloading}
          style={{
            marginTop: '30px',
            padding: '12px 32px',
            backgroundColor: downloading ? '#999' : '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: downloading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0, 102, 204, 0.3)',
            transition: 'all 0.3s ease',
          }}
          onMouseOver={(e) => {
            if (!downloading) {
              e.target.style.backgroundColor = '#0052a3';
              e.target.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseOut={(e) => {
            if (!downloading) {
              e.target.style.backgroundColor = '#0066cc';
              e.target.style.transform = 'translateY(0)';
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
          maxWidth: '400px' 
        }}>
          Click the button above to download your ID card as a PNG image. The card can be used for identification purposes.
        </p>
      </main>
    </div>
  );
}

export default IDCard;
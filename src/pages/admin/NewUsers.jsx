import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EnhancedBackButton from '../../components/EnhancedBackButton';

const profileIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDI3QzIyLjYyNzQgMjcgMjguMDgwOSA0My4wMDEgMjggNDNMNCA0M0M0IDQzLjAwMSA5LjM3MjYgMjcgMTYgMjdaIiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjEyIiByPSI2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';

function NewUsers({ onBack }) {
  const { user, signOutUser } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [verifiedUsers, setVerifiedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'verified'
  const [verifying, setVerifying] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');

      // Get all users with additional details
      const q = query(usersRef, orderBy('submittedAt', 'desc'));
      const snapshot = await getDocs(q);

      const pending = [];
      const verified = [];

      snapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        // Only show users who have submitted additional details
        if (userData.mrrNumber && userData.submittedAt) {
          const userInfo = {
            id: docSnap.id,
            ...userData,
          };

          if (userData.verified === true) {
            verified.push(userInfo);
          } else {
            pending.push(userInfo);
          }
        }
      });

      setPendingUsers(pending);
      setVerifiedUsers(verified);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (userId) => {
    try {
      setVerifying(userId);
      const userDocRef = doc(db, 'users', userId);

      // Use setDoc with merge to ensure the update works even if document structure is different
      await updateDoc(userDocRef, {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: user?.uid || 'admin',
        updatedAt: new Date().toISOString(),
      });

      // Reload users
      await loadUsers();
    } catch (error) {
      console.error('Error verifying user:', error);
      console.error('Error details:', {
        code: error?.code,
        message: error?.message,
        userId: userId,
        currentUser: user?.uid,
        userRole: user?.email,
      });
      alert(`Failed to verify user: ${error?.message || 'Unknown error'}. Please check console for details.`);
    } finally {
      setVerifying(null);
    }
  };

  const handleReject = async (userId) => {
    if (!confirm('Are you sure you want to reject this user? They will need to resubmit their information.')) {
      return;
    }

    try {
      setVerifying(userId);
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        verified: false,
        rejected: true,
        rejectedAt: new Date().toISOString(),
        rejectedBy: user?.uid || 'admin',
        updatedAt: new Date().toISOString(),
      });

      // Reload users
      await loadUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert('Failed to reject user. Please try again.');
    } finally {
      setVerifying(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Filter users based on search query (only for verified tab)
  const displayUsers = activeTab === 'pending'
    ? pendingUsers
    : verifiedUsers.filter(user =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.mrrNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="landing-screen">
      <header className="landing-header">
        <EnhancedBackButton onBack={onBack} />
        <p className="landing-greeting" style={{ flex: 1, textAlign: 'center' }}>
          New User Verification
        </p>
        <div className="landing-status">
          <button type="button" className="landing-profile" aria-label="Profile">
            <img src={profileIcon} alt="" />
          </button>
          <button type="button" className="landing-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="landing-body" style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #eee' }}>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'pending' ? '2px solid #0066cc' : '2px solid transparent',
                color: activeTab === 'pending' ? '#0066cc' : '#666',
                cursor: 'pointer',
                fontWeight: activeTab === 'pending' ? 'bold' : 'normal',
                fontSize: '16px',
              }}
            >
              Pending ({pendingUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('verified')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'verified' ? '2px solid #0066cc' : '2px solid transparent',
                color: activeTab === 'verified' ? '#0066cc' : '#666',
                cursor: 'pointer',
                fontWeight: activeTab === 'verified' ? 'bold' : 'normal',
                fontSize: '16px',
              }}
            >
              Verified ({verifiedUsers.length})
            </button>
          </div>
        </div>

        {/* Search bar - only visible in verified tab */}
        {activeTab === 'verified' && (
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Search by name, email, or MRR ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '500px',
                padding: '12px 16px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontFamily: 'var(--brand-font-body)',
              }}
            />
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <LoadingSpinner size="40" stroke="3" color="#666" />
            <p style={{ marginTop: '15px', color: '#666' }}>Loading users...</p>
          </div>
        ) : displayUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#666' }}>
              {activeTab === 'pending'
                ? 'No pending users at this time.'
                : 'No verified users yet.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {displayUsers.map((userData) => (
              <div
                key={userData.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '12px',
                  padding: '20px',
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '20px' }}>
                  {/* Photo */}
                  <div>
                    {userData.photoUrl ? (
                      <img
                        src={userData.photoUrl}
                        alt={userData.name || 'User'}
                        style={{
                          width: '150px',
                          height: '150px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid #ddd',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '150px',
                          height: '150px',
                          backgroundColor: '#f0f0f0',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#999',
                        }}
                      >
                        No Photo
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div>
                    <div style={{ marginBottom: '15px' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>
                        {userData.name || 'N/A'}
                      </h3>
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        <strong>MRR ID:</strong> {userData.mrrNumber || 'N/A'}
                      </p>
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        <strong>Email:</strong> {userData.email || 'N/A'}
                      </p>
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        <strong>Phone:</strong> {userData.phoneNumber || 'N/A'}
                      </p>
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        <strong>Date of Birth:</strong>{' '}
                        {userData.dateOfBirth
                          ? new Date(userData.dateOfBirth).toLocaleDateString()
                          : 'N/A'}
                      </p>
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        <strong>Interested In:</strong>{' '}
                        {Array.isArray(userData.interestedIn)
                          ? userData.interestedIn.join(', ')
                          : userData.interestedIn || 'N/A'}
                      </p>
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '12px' }}>
                        <strong>Submitted:</strong>{' '}
                        {userData.submittedAt
                          ? new Date(userData.submittedAt).toLocaleString()
                          : 'N/A'}
                      </p>
                      {userData.verifiedAt && (
                        <p style={{ margin: '5px 0', color: '#4a4', fontSize: '12px' }}>
                          <strong>Verified:</strong>{' '}
                          {new Date(userData.verifiedAt).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {activeTab === 'pending' && (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        <button
                          type="button"
                          onClick={() => handleVerify(userData.id)}
                          disabled={verifying === userData.id}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#4a4',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: verifying === userData.id ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: verifying === userData.id ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          {verifying === userData.id ? <LoadingSpinner size="16" stroke="2" color="white" /> : '✓ Verify'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(userData.id)}
                          disabled={verifying === userData.id}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#f44',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: verifying === userData.id ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: verifying === userData.id ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          {verifying === userData.id ? <LoadingSpinner size="16" stroke="2" color="white" /> : '✗ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default NewUsers;


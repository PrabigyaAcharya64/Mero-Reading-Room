import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, deleteField } from 'firebase/firestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import EnhancedBackButton from '../../components/EnhancedBackButton';
import PageHeader from '../../components/PageHeader';
import '../../styles/NewUsers.css';
import '../../styles/StandardLayout.css';




const userManagementIcon = new URL('../../assets/usermanagement.svg', import.meta.url).href;

function NewUsers({ onBack }) {

  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');

      // Only get users who have submitted details but are NOT yet verified
      // Note: We'll filter in JS because we want to see users where verified is false OR undefined
      const q = query(usersRef, orderBy('submittedAt', 'desc'));
      const snapshot = await getDocs(q);

      const pending = [];

      snapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        // Only show users who have submitted additional details and are not verified
        if (userData.mrrNumber && userData.submittedAt && userData.verified !== true) {
          pending.push({
            id: docSnap.id,
            ...userData,
          });
        }
      });

      setPendingUsers(pending);
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

      // Email is now sent via Cloud Function (onUserVerified trigger)

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
    if (!confirm('Are you sure you want to reject this user? Their current request data will be discarded and they will need to resubmit their information from the beginning.')) {
      return;
    }

    try {
      setVerifying(userId);
      const userDocRef = doc(db, 'users', userId);

      // Discard the request data to force resubmission
      // Navigation handles redirection based on absence of mrrNumber/submittedAt
      await updateDoc(userDocRef, {
        mrrNumber: deleteField(),
        submittedAt: deleteField(),
        name: deleteField(),
        dateOfBirth: deleteField(),
        phoneNumber: deleteField(),
        interestedIn: deleteField(),
        photoUrl: deleteField(),
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


  const filteredUsers = pendingUsers.filter(user =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.mrrNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of grid
      const body = document.querySelector('.nu-body');
      if (body) body.scrollTop = 0;
    }
  };

  return (
    <div className="std-container">
      <PageHeader
        title="User Management"
        icon={userManagementIcon}
        onBack={onBack}
        badgeCount={pendingUsers.length}
      />

      <main className="std-body">
        <div className="nu-search-container" style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search pending requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nu-search-input"
          />
        </div>


        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
            <LoadingSpinner />
          </div>
        )}

        {!loading && displayUsers.length === 0 ? (
          <div className="nu-empty">
            <p>No pending verification requests at this time.</p>
          </div>
        ) : (
          <div className="nu-grid">
            {displayUsers.map((userData) => (
              <div key={userData.id} className="nu-card">
                {/* Photo */}
                <div className="nu-card__photo">
                  {userData.photoUrl ? (
                    <img
                      src={userData.photoUrl}
                      alt={userData.name || 'User'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span>👤</span>
                  )}
                </div>

                {/* User Info */}
                <div className="nu-card__content">
                  <h3 className="nu-card__name">
                    {userData.name || 'N/A'}
                  </h3>

                  <div className="nu-card__row">
                    <span className="nu-card__label">MRR ID:</span>
                    <span className="nu-card__value">{userData.mrrNumber || 'N/A'}</span>
                  </div>

                  <div className="nu-card__row">
                    <span className="nu-card__label">Email:</span>
                    <span className="nu-card__value">{userData.email || 'N/A'}</span>
                  </div>

                  <div className="nu-card__row">
                    <span className="nu-card__label">Phone:</span>
                    <span className="nu-card__value">{userData.phoneNumber || 'N/A'}</span>
                  </div>

                  <div className="nu-card__row">
                    <span className="nu-card__label">DOB:</span>
                    <span className="nu-card__value">
                      {userData.dateOfBirth
                        ? new Date(userData.dateOfBirth).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="nu-card__row">
                    <span className="nu-card__label">Interest:</span>
                    <span className="nu-card__value">
                      {Array.isArray(userData.interestedIn)
                        ? userData.interestedIn.join(', ')
                        : userData.interestedIn || 'N/A'}
                    </span>
                  </div>

                  <div className="nu-card__meta">
                    Submitted: {userData.submittedAt
                      ? new Date(userData.submittedAt).toLocaleString()
                      : 'N/A'}
                    {userData.verifiedAt && (
                      <span style={{ color: '#2e7d32', marginLeft: '0.5rem' }}>
                        • Verified
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="nu-card__actions" style={{ gap: '10px' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleVerify(userData.id)}
                      loading={verifying === userData.id}
                      disabled={verifying !== null && verifying !== userData.id}
                      style={{ backgroundColor: '#2e7d32', borderColor: '#2e7d32' }}
                    >
                      ✓ Verify
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleReject(userData.id)}
                      loading={verifying === userData.id}
                      disabled={verifying !== null && verifying !== userData.id}
                    >
                      ✗ Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && filteredUsers.length > 0 && (
          <div className="nu-pagination">
            <button
              className="nu-pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="nu-pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="nu-pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default NewUsers;


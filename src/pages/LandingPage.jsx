import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import { Bell, Clock, History as HistoryIcon, Gift, X } from 'lucide-react';
import IDCard from './IDCard';
import CanteenClient from './canteen/CanteenClient.jsx';
import CanteenAdminLanding from './Canteen_Admin/CanteenAdminLanding';
import Contact from './contact/Contact';
import ReadingRoomOptions from './readingroom/ReadingRoomOptions';
import ReadingRoomBuy from './readingroom/ReadingRoomBuy';
import ReadingRoomEnrollment from './readingroom/ReadingRoomEnrollment';
import ReadingRoomDashboard from './readingroom/ReadingRoomDashboard';
import Discussion from './discussion/Discussion';
import Hostel from './hostel';
import LoadBalance from './balance/LoadBalance';
import Confirmation from './balance/Confirmation';
import Statement from './balance/Statement';
import RefundRequest from './balance/RefundRequest';
import profileIcon from '../assets/profile.svg';
import readingRoomIcon from '../assets/readingroom.svg';
import hostelIcon from '../assets/hostel.svg';
import foodIcon from '../assets/food.svg';
import contactIcon from '../assets/contact.svg';
import adminIcon from '../assets/usermanagement.svg';
import '../styles/StandardLayout.css';


function LandingPage({ onBack }) {
  const { user, signOutUser, userBalance } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Reader';
  const [selectedRoomOption, setSelectedRoomOption] = useState(null);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // isAdmin is already declared above, removing duplicate
  const [membershipStatus, setMembershipStatus] = useState({ hasSeat: false, isExpired: false, loading: true });

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsAdmin(userData.role === 'admin');

            // Check membership status
            const hasSeat = !!(userData.registrationCompleted && userData.currentSeat);
            const isExpired = userData.nextPaymentDue && new Date(userData.nextPaymentDue) < new Date();

            setMembershipStatus({ hasSeat, isExpired, loading: false });
          } else {
            setMembershipStatus({ hasSeat: false, isExpired: false, loading: false });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setMembershipStatus(prev => ({ ...prev, loading: false }));
        }
      };
      fetchData();
    } else {
      setMembershipStatus({ hasSeat: false, isExpired: false, loading: false });
    }
  }, [user]);

  const handleReadingRoomClick = async () => {
    if (!user) return;

    setCheckingMembership(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Check if user has completed registration and has an active membership
        if (userData.registrationCompleted && userData.currentSeat) {
          // Check if membership is still valid
          const isExpired = userData.nextPaymentDue && new Date(userData.nextPaymentDue) < new Date();

          if (!isExpired) {
            navigate('/reading-room/dashboard');
            return;
          }
        }
      }

      // If no valid membership or registration not completed, go to options
      navigate('/reading-room/options');
    } catch (error) {
      console.error('Error checking membership:', error);
      navigate('/reading-room/options');
    } finally {
      setCheckingMembership(false);
    }
  };

  const handleDiscussionClick = async () => {
    // If not a member, button shouldn't even be visible, but double check
    if (!membershipStatus.hasSeat) return;

    if (membershipStatus.isExpired) {
      // Redirect to renew/buy
      navigate('/reading-room/options');
      return;
    }

    navigate('/discussion');
  };

  useEffect(() => {
    if (!user) return;

    const now = Timestamp.now();
    const q = query(
      collection(db, 'announcements'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'asc') // Needed for compound query with range filter
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by createdAt desc in memory since we can't easily do it in query with expiresAt range
      msgs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setAnnouncements(msgs);
    }, (error) => {
      console.log("Announcement listener error (permissions?):", error.code);
    });

    return () => unsubscribe();
  }, [user]); // Add user as dependency

  // Fetch Personal Notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(list);
    });

    return () => unsubscribe();
  }, [user]);

  const dismissNotification = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), {
        read: true,
        archived: true // or just delete it? for now let's just mark read/archived
      });
      // Or local filter if we want to remove immediately from view without relying on query change immediately if query doesn't filter by archived
      // But better to just let snapshot handle it. We can filter the display list.
      // Let's actually delete it from view for the user after "dismissing"
    } catch (err) {
      console.error("Error dismissing notification", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Landing Home Component
  const LandingHome = () => (
    <div className="std-container">
      <header className="landing-header">
        <p className="landing-greeting">
          Hey <span>{displayName}!</span>
        </p>
        <div className="landing-status">
          <div className="landing-balance" aria-label="Current balance">
            <div className="landing-balance__label">Balance</div>
            <div
              className="landing-balance__value"
              onClick={() => navigate('/statement')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="View History"
            >
              रु {(userBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <HistoryIcon size={14} className="text-gray-400" />
            </div>
            <button
              type="button"
              className="landing-balance__add"
              aria-label="Add to balance"
              onClick={() => navigate('/load-balance')}
            >
              <span>+</span>
            </button>
          </div>
          <button
            type="button"
            className="landing-profile"
            aria-label="Profile"
            onClick={() => navigate('/idcard')}
          >
            <img src={profileIcon} alt="" />
          </button>
        </div>
      </header>

      <main className="std-body">
        <section className="landing-services">
          <div className="landing-section-header">
            <h2>Quick Services</h2>
          </div>
          <div className="landing-services__grid">
            <button type="button" className="landing-service-card" onClick={handleReadingRoomClick} disabled={checkingMembership}>
              <span className="landing-service-card__icon">
                {checkingMembership ? (
                  <div style={{ width: '24px', height: '24px', border: '2px solid #333', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                ) : (
                  <img src={readingRoomIcon} alt="" aria-hidden="true" />
                )}
              </span>
              <span className="landing-service-card__label">Reading Room</span>
            </button>
            <button type="button" className="landing-service-card" onClick={() => navigate('/hostel')}>
              <span className="landing-service-card__icon">
                <img src={hostelIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Hostel</span>
            </button>
            {membershipStatus.hasSeat && (
              <button type="button" className="landing-service-card" onClick={handleDiscussionClick}>
                <span className="landing-service-card__icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 20H7C6 20 5 20 4 20C4 20 4 15 4 15C4 12.2386 6.23858 10 9 10H15C17.7614 10 20 12.2386 20 15V15C20 15 20 20 20 20H17Z" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 10C13.6569 10 15 8.65685 15 7C15 5.34315 13.6569 4 12 4C10.3431 4 9 5.34315 9 7C9 8.65685 10.3431 10 12 10Z" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="landing-service-card__label">Discussion</span>
              </button>
            )}

            {isAdmin && (
              <button type="button" className="landing-service-card" onClick={() => navigate('/canteen-admin')}>
                <span className="landing-service-card__icon">
                  <img src={adminIcon} alt="" aria-hidden="true" />
                </span>
                <span className="landing-service-card__label">Canteen Admin</span>
              </button>
            )}

            <button type="button" className="landing-service-card" onClick={() => navigate('/canteen')}>
              <span className="landing-service-card__icon">
                <img src={foodIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Canteen</span>
            </button>
            <button type="button" className="landing-service-card" onClick={() => navigate('/contact')}>
              <span className="landing-service-card__icon">
                <img src={contactIcon} alt="" aria-hidden="true" />
              </span>
              <span className="landing-service-card__label">Contact</span>
            </button>
          </div>
        </section>

        {/* Personal Notifications Section */}
        {notifications.filter(n => !n.archived).length > 0 && (
          <section style={{ marginTop: '2.5rem' }}>
            <div className="landing-section-header">
              <Gift size={20} color="#e11d48" />
              <h2 style={{ color: '#e11d48' }}>Rewards & Coupons</h2>
            </div>

            <div className="landing-announcements">
              {notifications.filter(n => !n.archived).map(note => (
                <div key={note.id} className="announcement-card" style={{ borderLeft: '4px solid #e11d48', backgroundColor: '#fff1f2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: '#be123c' }}>{note.title}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(note.id);
                      }}
                      style={{ border: 'none', background: 'transparent', padding: '0', cursor: 'pointer', color: '#999' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="announcement-card__text" style={{ color: '#881337' }}>
                    {note.message}
                  </p>
                  <div className="announcement-card__footer">
                    <Clock size={12} color="#9f1239" />
                    <span style={{ color: '#9f1239' }}>Received: {note.createdAt && (typeof note.createdAt === 'string' ? new Date(note.createdAt).toLocaleDateString() : note.createdAt.toDate?.().toLocaleDateString())}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ marginTop: '2.5rem' }}>
          <div className="landing-section-header">
            <Bell size={20} />
            <h2>Notices</h2>
          </div>

          <div className="landing-announcements">
            {announcements.length === 0 ? (
              <div className="landing-announcements__empty">
                <Bell size={32} opacity={0.3} />
                <p>No notices at this time.</p>
              </div>
            ) : (
              announcements.map(announcement => (
                <div key={announcement.id} className="announcement-card">
                  <p className="announcement-card__text">
                    {announcement.text}
                  </p>
                  <div className="announcement-card__footer">
                    <Clock size={12} />
                    <span>Posted: {announcement.createdAt?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<LandingHome />} />
      <Route path="/idcard" element={<IDCard onBack={() => navigate('/')} />} />
      <Route path="/canteen" element={<CanteenClient onBack={() => navigate('/')} />} />
      <Route path="/canteen-admin" element={<CanteenAdminLanding onBack={() => navigate('/')} />} />
      <Route path="/contact" element={<Contact onBack={() => navigate('/')} />} />
      <Route
        path="/reading-room/options"
        element={
          <ReadingRoomOptions
            onBack={() => navigate('/')}
            onSelectOption={(option) => {
              setSelectedRoomOption(option);
              navigate('/reading-room/buy');
            }}
          />
        }
      />
      <Route
        path="/reading-room/buy"
        element={
          <ReadingRoomBuy
            onBack={() => navigate('/reading-room/options')}
            selectedOption={selectedRoomOption}
            onComplete={(needsEnrollment) => {
              if (needsEnrollment) {
                navigate('/reading-room/enrollment');
              } else {
                navigate('/reading-room/dashboard');
              }
            }}
          />
        }
      />
      <Route
        path="/reading-room/enrollment"
        element={
          <ReadingRoomEnrollment
            onBack={() => navigate('/reading-room/buy')}
            onComplete={() => navigate('/reading-room/dashboard')}
          />
        }
      />
      <Route path="/reading-room/dashboard" element={<ReadingRoomDashboard onBack={() => navigate('/')} />} />
      <Route path="/discussion" element={<Discussion onBack={() => navigate('/')} />} />
      <Route path="/hostel/*" element={<Hostel onBack={() => navigate('/')} />} />
      <Route
        path="/load-balance"
        element={
          <LoadBalance
            onBack={() => navigate('/')}
            onComplete={() => navigate('/balance-confirmation')}
          />
        }
      />
      <Route path="/balance-confirmation" element={<Confirmation onHome={() => navigate('/')} />} />
      <Route path="/statement" element={<Statement onBack={() => navigate('/')} />} />
      <Route path="/refund-request" element={<RefundRequest onBack={() => navigate('/statement')} />} />
    </Routes>
  );
}

export default LandingPage;
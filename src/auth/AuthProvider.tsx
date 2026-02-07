import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  GoogleAuthProvider,
  User,
  UserCredential, // Added
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type AuthContextState = {
  user: User | null;
  userRole: string | null;
  userBalance: number;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

// Helper function to determine role based on email
const getRoleFromEmail = (email: string | null | undefined): string | null => {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();

  if (normalizedEmail === 'headmrr@gmail.com') {
    return 'admin';
  }

  if (normalizedEmail === 'canteenmrr@gmail.com') {
    return 'canteen';
  }

  return null;
};

const AuthContext = createContext<AuthContextState | undefined>(undefined);

const firebaseErrorMessages: Record<string, string> = {
  'auth/invalid-email': 'The email address appears to be invalid.',
  'auth/user-disabled': 'This account has been disabled. Contact support for help.',
  'auth/user-not-found': 'No account found with that email address.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'An account already exists with that email.',
  'auth/weak-password': 'Please choose a stronger password.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user': 'The sign-in popup was closed before completing.',
  'auth/too-many-requests': 'Too many requests. Please try again later.',
};

const getFriendlyError = (code: string, fallback: string) =>
  firebaseErrorMessages[code] ?? fallback;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async (user: User) => {
    try {
      // Fetch the ID token result to check for custom claims
      const tokenResult = await user.getIdTokenResult(true); // Force refresh to get latest claims
      const roleFromClaim = tokenResult.claims.role as string | undefined;

      if (roleFromClaim) {
        return roleFromClaim;
      }

      // Fallback: If no claim, try Firestore (for existing users or non-staff)
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData && 'role' in userData) {
          return userData.role as string;
        }
      }
    } catch (error: any) {
      console.warn('Error fetching user role:', error);
    }

    return null;
  }, []);

  // Real-time Auth Listener & Balance Sync
  useEffect(() => {
    let mounted = true;
    let loadingSet = false;
    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeUserDoc: (() => void) | null = null;

    // Safety timeout to ensure loading state doesn't hang
    const safetyTimeout = setTimeout(() => {
      if (mounted && !loadingSet) {
        console.warn('Auth initialization timeout - forcing loading to false');
        setLoading(false);
        loadingSet = true;
      }
    }, 2000);

    try {
      unsubscribeAuth = onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          // 1. Cleanup previous Firestore listener if any
          if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
            unsubscribeUserDoc = null;
          }

          if (mounted) setUser(firebaseUser);

          if (firebaseUser) {
            // 2. Fetch User Role (Consolidated)
            // 2. Fetch User Role (Consolidated)
            try {
              // validation: Don't force refresh here to avoid race conditions with sign-in flows.
              // Just get the cached token result. If we need a forced refresh, it should happen in the sign-in action.
              const tokenResult = await firebaseUser.getIdTokenResult();

              if (mounted && tokenResult.claims.role) {
                setUserRole(tokenResult.claims.role as string);
              } else if (mounted) {
                // Fallback to Firestore if no claim
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                getDoc(userDocRef).then((snap) => {
                  if (mounted && snap.exists()) {
                    const d = snap.data();
                    if (d && 'role' in d) setUserRole(d.role);
                  }
                }).catch(e => console.warn("Role fallback failed", e));
              }
            } catch (e) {
              console.error("Error fetching token/role:", e);
            }

            // 3. LISTEN TO USER DOCUMENT for realtime balance updates
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (mounted) {
                  // Ensure balance is a number
                  const bal = typeof data.balance === 'number' ? data.balance : 0;
                  setUserBalance(bal);
                }
              }
            }, (error) => {
              console.warn("Error listening to user balance:", error);
            });

          } else {
            // User signed out
            if (mounted) {
              setUserRole(null);
              setUserBalance(0);
            }
          }

          if (mounted && !loadingSet) {
            setLoading(false);
            loadingSet = true;
            clearTimeout(safetyTimeout);
          }
        },
        (error) => {
          console.error('Auth state change error:', error);
          if (mounted && !loadingSet) {
            setLoading(false);
            loadingSet = true;
            clearTimeout(safetyTimeout);
          }
        }
      );
    } catch (error) {
      console.error('Error setting up auth listener:', error);
      if (mounted && !loadingSet) {
        setLoading(false);
        loadingSet = true;
        clearTimeout(safetyTimeout);
      }
    }

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []); // Removed dependency on fetchUserRole since we inlined it


  const processAuthResult = useCallback(async (result: UserCredential) => {
    const userId = result.user.uid;
    const userEmail = result.user.email;
    const normalizedEmail = userEmail?.toLowerCase().trim();

    // Determine role based on email
    const role = getRoleFromEmail(normalizedEmail);

    // Check if user document exists, if not create one
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // Create user document with default balance
      await setDoc(userDocRef, {
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
      });
      setUserBalance(0);
    } else {
      const userData = userDoc.data();
      // Update balance state from Firestore
      setUserBalance(userData.balance ?? 0);

      // If user has a role in Firestore, update state
      if (userData.role) {
        setUserRole(userData.role);
      }
    }

    // Refresh token to get any newly assigned custom claims
    const tokenResult = await result.user.getIdTokenResult(true);
    if (tokenResult.claims.role) {
      setUserRole(tokenResult.claims.role as string);
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Please provide both email and password.');
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      throw new Error(
        getFriendlyError(
          error?.code ?? 'auth/unknown',
          error?.message ?? 'Unable to sign in. Please try again.',
        ),
      );
    }
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Please provide both email and password.');
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const userId = userCredential.user.uid;
      const normalizedEmail = email.trim().toLowerCase();

      // Determine role based on email
      const role = getRoleFromEmail(normalizedEmail);

      // Admin and canteen users are automatically verified
      const isVerified = role === 'admin' || role === 'canteen';

      // Create user document in Firestore with initial balance
      await setDoc(doc(db, 'users', userId), {
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
      });

      // Set initial balance in state
      setUserBalance(0);

      // No need to set userRole here; it will be updated via onAuthStateChanged 
      // once the Cloud Function assigns the custom claim and we refresh the token.
      // However, to avoid waiting, we can force a token refresh after a small delay.
      setTimeout(async () => {
        const user = auth.currentUser;
        if (user) {
          const result = await user.getIdTokenResult(true);
          if (result.claims.role) {
            setUserRole(result.claims.role as string);
          }
        }
      }, 2000);
    } catch (error: any) {
      throw new Error(
        getFriendlyError(
          error?.code ?? 'auth/unknown',
          error?.message ?? 'Unable to create the account.',
        ),
      );
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(
        getFriendlyError(
          error?.code ?? 'auth/unknown',
          error?.message ?? 'Unable to sign out.',
        ),
      );
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!email || !email.trim()) {
      throw new Error('Please provide an email address.');
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error: any) {
      throw new Error(
        getFriendlyError(
          error?.code ?? 'auth/unknown',
          error?.message ?? 'Unable to send password reset email.',
        ),
      );
    }
  }, []);

  const signInWithGoogleHandler = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      await processAuthResult(result);
    } catch (error: any) {
      throw new Error(
        getFriendlyError(
          error?.code ?? 'auth/unknown',
          error?.message ?? 'Unable to authenticate with Google.',
        ),
      );
    }
  }, [processAuthResult]);


  const value = useMemo<AuthContextState>(
    () => ({
      user,
      userRole,
      userBalance,
      loading,
      signInEmail,
      signUpEmail,
      signOutUser,
      signInWithGoogle: signInWithGoogleHandler,
      resetPassword,
    }),
    [user, userRole, userBalance, loading, signInEmail, signUpEmail, signOutUser, signInWithGoogleHandler, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


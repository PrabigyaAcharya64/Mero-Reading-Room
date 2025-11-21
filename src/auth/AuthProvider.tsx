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
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  updateBalance: (newBalance: number) => Promise<void>;
  deductBalance: (amount: number) => Promise<boolean>;
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

  const fetchUserRole = useCallback(async (userId: string, userEmail?: string | null) => {
    // Immediately determine role from email (synchronous, no Firestore needed)
    const roleFromEmail = getRoleFromEmail(userEmail);
    
    // Firestore operations are optional and non-blocking
    // We do them in the background without waiting
    if (roleFromEmail) {
      // Try to save to Firestore in background (don't await)
      setDoc(doc(db, 'users', userId), {
        email: userEmail,
        role: roleFromEmail,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch((error) => {
        console.warn('Could not write to Firestore (non-critical):', error);
      });
      return roleFromEmail;
    }
    
    // If no email-based role, try Firestore (but with timeout)
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore timeout')), 10000) // Increased to 10 seconds
      );
      
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await Promise.race([
        getDoc(userDocRef),
        timeoutPromise
      ]) as Awaited<ReturnType<typeof getDoc>>;
      
      if (userDoc && userDoc.exists()) {
        const userData = userDoc.data();
        if (userData && typeof userData === 'object' && 'role' in userData) {
          return userData.role as string;
        }
      }
    } catch (error) {
      // Silently fail - email-based role is primary
      // Only log if it's not a timeout (timeouts are expected if Firestore isn't configured)
      if (error?.message && !error.message.includes('timeout')) {
        console.warn('Firestore read failed (non-critical):', error);
      }
    }
    
    return null;
  }, []);

  const fetchUserBalance = useCallback(async (userId: string): Promise<number> => {
    try {
      // Use timeout to prevent hanging (increased to 10 seconds)
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve(500), 10000) // Default to 500 if timeout
      );
      
      const userDocRef = doc(db, 'users', userId);
      const balancePromise = getDoc(userDocRef).then((userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // If balance doesn't exist, set it to 500
          if (userData && (userData.balance === undefined || userData.balance === null)) {
            // Update the document with default balance
            setDoc(userDocRef, { balance: 500 }, { merge: true }).catch(() => {});
            return 500;
          }
          return (userData && userData.balance) || 500;
        } else {
          // User document doesn't exist, create it with default balance
          setDoc(userDocRef, { balance: 500 }, { merge: true }).catch(() => {});
          return 500;
        }
      }).catch(() => 500); // Default to 500 on error
      
      return await Promise.race([balancePromise, timeoutPromise]);
    } catch (error) {
      // Only log if it's not a timeout
      if (error?.message && !error.message.includes('timeout')) {
        console.warn('Error fetching user balance:', error);
      }
      return 500; // Default to 500 on error
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let loadingSet = false;
    let unsubscribe: (() => void) | null = null;
    
    // Aggressive safety timeout - ensure loading is ALWAYS set to false quickly
    const safetyTimeout = setTimeout(() => {
      if (mounted && !loadingSet) {
        console.warn('Auth initialization timeout - forcing loading to false');
        setLoading(false);
        loadingSet = true;
      }
    }, 1500); // Very aggressive: 1.5 seconds max
    
    try {
      // Set up auth state listener
      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          // Set loading to false IMMEDIATELY - don't wait for anything
          if (mounted && !loadingSet) {
            setLoading(false);
            loadingSet = true;
            clearTimeout(safetyTimeout);
          }
          
          // Set user immediately
          if (mounted) {
            setUser(firebaseUser);
          }
          
          if (!mounted) return;
          
          if (firebaseUser) {
            // Get role immediately from email (synchronous, instant)
            const immediateRole = getRoleFromEmail(firebaseUser.email);
            setUserRole(immediateRole);
            
            // Fetch balance in background (non-blocking)
            fetchUserBalance(firebaseUser.uid)
              .then((balance) => {
                if (mounted) {
                  setUserBalance(balance);
                }
              })
              .catch((error) => {
                console.warn('Balance fetch failed (non-critical):', error);
                if (mounted) {
                  setUserBalance(0);
                }
              });
            
            // Fetch role from Firestore in background (non-blocking)
            fetchUserRole(firebaseUser.uid, firebaseUser.email)
              .then((firestoreRole) => {
                if (mounted && firestoreRole) {
                  setUserRole(firestoreRole);
                }
              })
              .catch((error) => {
                console.warn('Firestore role fetch failed (non-critical):', error);
              });
          } else {
            // No user - reset everything
            setUserRole(null);
            setUserBalance(0);
          }
        },
        (error) => {
          // Auth error handler
          console.error('Auth state change error:', error);
          if (mounted && !loadingSet) {
            setLoading(false);
            loadingSet = true;
            clearTimeout(safetyTimeout);
          }
        }
      );
    } catch (error) {
      // If auth setup fails, still set loading to false
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
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchUserRole, fetchUserBalance]);

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
      
      // Create user document in Firestore with role and initial balance
      await setDoc(doc(db, 'users', userId), {
        email: normalizedEmail,
        role: role,
        balance: 500, // Default balance of 500
        verified: isVerified, // Auto-verify admin and canteen users
        createdAt: new Date().toISOString(),
      });
      
      // Set initial balance in state
      setUserBalance(500);
      
      if (role) {
        setUserRole(role);
      }
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
      provider.setCustomParameters({ prompt: 'select_account' });
      
      // Suppress Cross-Origin-Opener-Policy errors (harmless browser security warning)
      // This error occurs when Firebase tries to close the popup window
      const errorHandler = (event) => {
        if (event.message && event.message.includes('Cross-Origin-Opener-Policy')) {
          event.preventDefault();
          event.stopPropagation();
        }
      };
      
      const originalError = console.error;
      const suppressError = (...args) => {
        const errorMsg = args[0]?.toString() || '';
        if (errorMsg.includes('Cross-Origin-Opener-Policy') || 
            args[0]?.message?.includes?.('Cross-Origin-Opener-Policy')) {
          // Suppress this specific error as it's harmless - popup closes successfully anyway
          return;
        }
        originalError.apply(console, args);
      };
      
      window.addEventListener('error', errorHandler);
      console.error = suppressError;
      
      const result = await signInWithPopup(auth, provider);
      
      // Restore original handlers after a short delay to catch async errors
      setTimeout(() => {
        window.removeEventListener('error', errorHandler);
        console.error = originalError;
      }, 100);
      
      const userId = result.user.uid;
      const userEmail = result.user.email;
      const normalizedEmail = userEmail?.toLowerCase().trim();
      
      // Determine role based on email
      const role = getRoleFromEmail(normalizedEmail);
      
      // Check if user document exists, if not create one
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      // Admin and canteen users are automatically verified
      const isVerified = role === 'admin' || role === 'canteen';
      
      if (!userDoc.exists()) {
        // Create user document with role based on email and default balance
        await setDoc(userDocRef, {
          email: normalizedEmail,
          role: role,
          balance: 500, // Default balance of 500
          verified: isVerified, // Auto-verify admin and canteen users
          createdAt: new Date().toISOString(),
        });
        setUserBalance(500);
        if (role) {
          setUserRole(role);
        }
      } else {
        // Update role if email matches admin/canteen emails
        const userData = userDoc.data();
        // If balance doesn't exist, set it to 500
        if (userData.balance === undefined || userData.balance === null) {
          await setDoc(userDocRef, {
            balance: 5000,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          setUserBalance(5000);
        } else {
          setUserBalance(userData.balance || 5000);
        }
        
        if (role) {
          await setDoc(userDocRef, {
            role: role,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          setUserRole(role);
        } else {
          // Fetch existing role
          setUserRole(userData.role || null);
        }
      }
    } catch (error: any) {
      throw new Error(
        getFriendlyError(
          error?.code ?? 'auth/unknown',
          error?.message ?? 'Unable to authenticate with Google.',
        ),
      );
    }
  }, []);

  const updateBalance = useCallback(async (newBalance: number) => {
    if (!user) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        balance: newBalance,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setUserBalance(newBalance);
    } catch (error) {
      console.error('Error updating balance:', error);
      throw error;
    }
  }, [user]);

  const deductBalance = useCallback(async (amount: number): Promise<boolean> => {
    if (!user) return false;
    
    if (userBalance < amount) {
      return false; // Insufficient balance
    }
    
    const newBalance = userBalance - amount;
    try {
      await updateBalance(newBalance);
      return true;
    } catch (error) {
      console.error('Error deducting balance:', error);
      return false;
    }
  }, [user, userBalance, updateBalance]);

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
      updateBalance,
      deductBalance,
    }),
    [user, userRole, userBalance, loading, signInEmail, signUpEmail, signOutUser, signInWithGoogleHandler, resetPassword, updateBalance, deductBalance],
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


import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase app
let app;
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Try to get existing app even if initialization failed
  app = getApps()[0] || initializeApp(firebaseConfig);
}

// Initialize Auth
let auth;
try {
  auth = getAuth(app);
  // Ensure auth is ready
  if (!auth.app) {
    auth = getAuth(app);
  }
} catch (error) {
  console.error('Firebase Auth initialization error:', error);
  auth = getAuth(app);
}

// Initialize Firestore
let db;
try {
  db = getFirestore(app);
} catch (error) {
  console.error('Firestore initialization error:', error);
  db = getFirestore(app);
}

// Initialize Storage
let storage;
try {
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase Storage initialization error:', error);
  storage = getStorage(app);
}

export const googleOAuthClientIds = {
  web: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
};

export { app, auth, db, storage };


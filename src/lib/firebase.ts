import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyA-vVWn93wisiUS4_KyMmTw1h2o7wkKzDs",
  authDomain: "mero-reading-room-app.firebaseapp.com",
  projectId: "mero-reading-room-app",
  storageBucket: "mero-reading-room-app.firebasestorage.app",
  messagingSenderId: "949466497845",
  appId: "1:949466497845:web:3614e312041426d6d6427c",
  measurementId: "G-MF3L271KBH",
};

// ... existing app initialization code ...

// Initialize Firebase app
let app: FirebaseApp;
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Try to get existing app even if initialization failed
  app = getApps()[0] || initializeApp(firebaseConfig);
}

// Initialize Auth
let auth: Auth;
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
let db: Firestore;
try {
  db = getFirestore(app);
} catch (error) {
  console.error('Firestore initialization error:', error);
  db = getFirestore(app);
}

// Initialize Storage
let storage: FirebaseStorage;
try {
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase Storage initialization error:', error);
  storage = getStorage(app);
}

export const googleOAuthClientIds = {
  web: "949466497845-cgo9khl5jbhljl2m4c5v6ef63b1qeqp3.apps.googleusercontent.com",
};

// Initialize Functions
import { getFunctions, Functions } from 'firebase/functions';

let functions: Functions;
try {
  functions = getFunctions(app);
} catch (error) {
  console.error('Firebase Functions initialization error:', error);
  functions = getFunctions(app);
}

export { app, auth, db, storage, functions };


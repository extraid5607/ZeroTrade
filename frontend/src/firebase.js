import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDXyRQ0NE8e4qNQDq9_zOz1CNqKOtYOJ0M",
  authDomain: "zerovega-5b38e.firebaseapp.com",
  databaseURL: "https://zerovega-5b38e-default-rtdb.firebaseio.com",
  projectId: "zerovega-5b38e",
  storageBucket: "zerovega-5b38e.firebasestorage.app",
  messagingSenderId: "804134329919",
  appId: "1:804134329919:web:cc37f713b64b8b26d1a28a",
  measurementId: "G-C327QM2YZW"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

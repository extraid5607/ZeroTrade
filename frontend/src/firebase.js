import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBkQ7xJg9vL2nZ8mK4wP1qR0sT3uV5wX7y",
  authDomain: "zerovega-5b38c.firebaseapp.com",
  projectId: "zerovega-5b38c",
  storageBucket: "zerovega-5b38c.appspot.com",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

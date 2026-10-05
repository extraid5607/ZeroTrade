import React, { useState } from 'react';
import { X, AlertCircle, RefreshCw, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  // 1-Click Google Authentication (Only method enabled)
  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: idToken,
          email: result.user.email,
          display_name: result.user.displayName,
          photo_url: result.user.photoURL
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Google authentication failed.');
      }

      localStorage.setItem('zerotrade_token', data.token);
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in popup was closed. Please click 'Continue with Google' to try again.");
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-surface-darkPanel rounded-3xl border border-gray-200 dark:border-surface-darkBorder w-full max-w-sm overflow-hidden shadow-2xl p-6 sm:p-7 relative text-center">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Icon Header */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-4">
          <Sparkles className="w-7 h-7 animate-pulse" />
        </div>

        <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white">
          Welcome to ZeroVega
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
          Sign in instantly with your Google account to access paper trading with <strong>$2,000 Starting Cash</strong>.
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* 1-Click Google Button */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl border border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard hover:bg-gray-50 dark:hover:bg-surface-darkHover text-gray-800 dark:text-white text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer group"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {loading ? 'Connecting to Google...' : 'Continue with Google'}
            </span>
          </button>
        </div>

        {/* Security / Feature Highlights */}
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-surface-darkBorder/60 flex flex-col gap-2 text-[11px] text-gray-400 text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Official Google Firebase Authentication</span>
          </div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-500 shrink-0" />
            <span>Automatic cloud sync across devices &amp; deployments</span>
          </div>
        </div>

      </div>
    </div>
  );
}

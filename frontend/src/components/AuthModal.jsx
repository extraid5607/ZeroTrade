import React, { useState } from 'react';
import { LogIn, UserPlus, X, Sparkles, AlertCircle, RefreshCw, Mail, Lock, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  // 1. Google 1-Click Authentication
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
      // Friendly message for cancelled popups
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in cancelled. Please click 'Continue with Google' to try again.");
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Standard Email/Password Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
    const payload = isSignUp
      ? { email, password, display_name: displayName }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      localStorage.setItem('zerotrade_token', data.token);
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder w-full max-w-sm overflow-hidden shadow-2xl p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-surface-darkBorder">
          <div>
            <div className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>Sign In to ZeroVega</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                1-CLICK
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Instant live access &bull; $2,000 Starting Cash</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* PRIMARY: 1-Click Google Authentication Button */}
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl border border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard hover:bg-gray-50 dark:hover:bg-surface-darkHover text-gray-800 dark:text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer group"
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
              {loading ? 'Signing in with Google...' : 'Continue with Google'}
            </span>
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secure Firebase Google Authentication</span>
          </div>
        </div>

        {/* Collapsible Email/Password Form (Optional Fallback) */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-surface-darkBorder">
          {!showEmailForm ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
              >
                Or sign in with email / password &rarr;
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2.5 animate-in fade-in duration-200">
              {isSignUp && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Your Name / Trader ID
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. John Doe or TraderX"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
              >
                {loading ? 'Authenticating...' : (isSignUp ? 'Create Email Account' : 'Sign In with Email')}
              </button>

              <div className="text-center text-[11px] text-gray-400 pt-1">
                {isSignUp ? (
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(false); setError(null); }}
                    className="text-blue-500 hover:underline"
                  >
                    Already have account? Sign in
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(true); setError(null); }}
                    className="text-blue-500 hover:underline"
                  >
                    Need email account? Sign up
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}

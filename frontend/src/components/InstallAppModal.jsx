import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share2, PlusSquare, X, Check, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import Logo from './Logo';

export default function InstallAppModal({
  isOpen,
  onClose,
  deferredPrompt,
  onInstalled
}) {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(isInStandaloneMode);
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        if (onInstalled) onInstalled();
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-surface-darkPanel rounded-t-3xl sm:rounded-2xl border border-gray-200 dark:border-surface-darkBorder w-full max-w-md shadow-2xl p-5 sm:p-6 flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-surface-darkBorder">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                Install ZeroVega App
              </h3>
              <p className="text-[11px] text-gray-400">Add to your phone's Home Screen</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* App Preview Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 via-indigo-950/20 to-surface-darkCard border border-blue-500/20 flex items-center gap-3.5">
          <img src="/pwa-192x192.png" alt="ZeroVega App Icon" className="w-14 h-14 rounded-2xl shadow-lg shadow-blue-600/30 border border-white/10 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>ZeroVega Terminal</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PWA</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">Multi-Asset Paper Trading &amp; Option Chains</div>
            <div className="text-[10px] text-blue-400 font-medium mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Instant Launch &bull; Full-Screen Experience
            </div>
          </div>
        </div>

        {/* Benefits list */}
        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Opens like a native Android &amp; iOS app without address bar</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Instant access to Watchlist, Charts, and F&amp;O chains</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Zero storage overhead &bull; Real-time cloud sync</span>
          </div>
        </div>

        {/* Action Button: Android/Chrome direct prompt VS iOS step guide */}
        {deferredPrompt ? (
          <button
            onClick={handleInstallClick}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Install App on Device</span>
          </button>
        ) : isIOS ? (
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder space-y-2 text-xs text-gray-700 dark:text-gray-300">
            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-blue-500" />
              <span>How to install on iPhone / iPad (Safari):</span>
            </div>
            <ol className="space-y-1.5 list-decimal list-inside text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
              <li>Tap the <strong className="text-gray-900 dark:text-white">Share button</strong> <span className="text-blue-500">⎋</span> at the bottom of Safari.</li>
              <li>Scroll down and tap <strong className="text-gray-900 dark:text-white">"Add to Home Screen"</strong> <PlusSquare className="w-3.5 h-3.5 inline text-blue-400 mx-0.5" />.</li>
              <li>Tap <strong className="text-gray-900 dark:text-white">Add</strong> in the top right corner.</li>
            </ol>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                alert("To install ZeroVega: Tap your browser's menu (3 dots) in Chrome/Edge and select 'Install app' or 'Add to Home screen'.");
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Add to Home Screen</span>
            </button>
            <p className="text-[10px] text-center text-gray-400">
              Or tap browser menu (⋮) ➔ "Install app"
            </p>
          </div>
        )}

        <div className="pt-2 text-center text-[10px] text-gray-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>ZeroVega Certified Progressive Web App (PWA)</span>
        </div>

      </div>
    </div>
  );
}

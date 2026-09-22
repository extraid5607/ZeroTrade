import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X } from 'lucide-react';

export default function InstallAppBanner({
  onOpenInstallModal
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if not in standalone mode and user hasn't dismissed recently
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isDismissed = sessionStorage.getItem('zerovega_install_dismissed') === 'true';

    if (!isStandalone && !isDismissed) {
      // Delay display slightly so it doesn't clash with initial load
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  const handleDismiss = (e) => {
    e.stopPropagation();
    setIsVisible(false);
    sessionStorage.setItem('zerovega_install_dismissed', 'true');
  };

  return (
    <div className="md:hidden fixed top-14 left-0 right-0 z-30 px-3 py-1.5 bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-blue-950/90 backdrop-blur-md border-b border-blue-500/30 text-white shadow-lg flex items-center justify-between gap-2 animate-in slide-in-from-top-2 duration-300">
      <div 
        onClick={onOpenInstallModal}
        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-blue-500/30 border border-blue-400/40 flex items-center justify-center shrink-0">
          <Smartphone className="w-4 h-4 text-cyan-300" />
        </div>
        <div className="flex flex-col truncate">
          <div className="text-xs font-bold leading-tight flex items-center gap-1.5 truncate">
            <span>Install ZeroVega App</span>
            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-cyan-400 text-black">Fast</span>
          </div>
          <span className="text-[10px] text-gray-300 truncate">Tap to add to Home Screen for full screen</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenInstallModal}
          className="px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1"
        >
          <Download className="w-3 h-3" />
          <span>Install</span>
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-gray-400 hover:text-white"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

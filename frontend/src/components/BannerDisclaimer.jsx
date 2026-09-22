import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export default function BannerDisclaimer() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-500 dark:text-amber-400 px-4 py-1.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 select-none">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse text-amber-400" />
      <span className="text-center">
        <strong>Simulated Trading Only:</strong> No real money or exchange orders involved. Platform is strictly for risk-free practice & educational purposes.
      </span>
      <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-400 hidden md:inline" />
    </div>
  );
}

import React from 'react';

export default function Logo({ size = 'md', showText = true, className = '' }) {
  // Dimensions map
  const iconSizes = {
    sm: { w: 28, h: 28, text: 'text-base', subText: 'text-[9px]' },
    md: { w: 34, h: 34, text: 'text-lg', subText: 'text-[10px]' },
    lg: { w: 44, h: 44, text: 'text-2xl', subText: 'text-xs' }
  };

  const { w, h, text, subText } = iconSizes[size] || iconSizes.md;

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      
      {/* Premium Geometric Vector Mark: The Zenith Zero */}
      <div 
        className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
        style={{ width: w, height: h }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_4px_12px_rgba(37,99,235,0.35)]"
        >
          <defs>
            {/* Main Outer Vortex Gradient */}
            <linearGradient id="zt-grad-primary" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="35%" stopColor="#2563EB" />
              <stop offset="70%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>

            {/* Ascending Trend Arrow Gradient */}
            <linearGradient id="zt-grad-arrow" x1="30" y1="70" x2="85" y2="15" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>

            {/* Subtle Inner Glow */}
            <radialGradient id="zt-radial-glow" cx="50" cy="50" r="45" gradientUnits="userSpaceOnUse">
              <stop offset="60%" stopColor="#2563EB" stopOpacity="0" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.4" />
            </radialGradient>
          </defs>

          {/* 1. Base Isometric "Zero" Octagon Ring */}
          <path
            d="M50 8 
               C73.196 8 92 26.804 92 50 
               C92 73.196 73.196 92 50 92 
               C26.804 92 8 73.196 8 50 
               C8 26.804 26.804 8 50 8 Z"
            fill="url(#zt-grad-primary)"
          />

          {/* 2. Inner Ring Cutout to create the dimensional "0" */}
          <path
            d="M50 24 
               C64.359 24 76 35.641 76 50 
               C76 64.359 64.359 76 50 76 
               C35.641 76 24 64.359 24 50 
               C24 35.641 35.641 24 50 24 Z"
            fill="#0F172A"
            className="dark:fill-[#0B0F19] fill-white transition-colors duration-200"
          />

          {/* 3. Kinetic Rising Breakout Polygon (Upward Trend Momentum) */}
          <path
            d="M34 62 L50 46 L62 58 L82 28"
            stroke="url(#zt-grad-arrow)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 4. Arrow Head Apex Point */}
          <polygon
            points="84,20 86,34 72,32"
            fill="#FFFFFF"
          />

          {/* 5. Center Core Accent Point */}
          <circle
            cx="50"
            cy="50"
            r="5"
            fill="#38BDF8"
            className="animate-pulse"
          />
        </svg>
      </div>

      {/* Typography Wordmark */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center tracking-tight leading-none">
            <span className={`font-black ${text} text-gray-900 dark:text-white tracking-wider`}>
              ZERO
            </span>
            <span className={`font-black ${text} bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 dark:from-blue-400 dark:via-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent ml-0.5 tracking-wider`}>
              VEGA
            </span>
          </div>
          <span className={`font-mono font-bold ${subText} text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5`}>
            PRO TERMINAL
          </span>
        </div>
      )}

    </div>
  );
}

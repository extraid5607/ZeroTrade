import React, { useState } from 'react';
import { 
  RotateCcw, 
  Sun, 
  Moon, 
  Trophy, 
  Briefcase, 
  BarChart2, 
  FileText, 
  User, 
  LogOut,
  Layers,
  ListOrdered,
  Search,
  DollarSign,
  Sparkles
} from 'lucide-react';
import Logo from './Logo';

export default function Navbar({
  activeTab,
  setActiveTab,
  portfolio,
  user,
  tickers = [],
  onOpenBillingModal,
  onOpenLeaderboard,
  onOpenAuth,
  onLogout,
  theme,
  toggleTheme,
  wsConnected
}) {
  const totalEquity = portfolio?.totalEquity ?? 10000;
  const cash = portfolio?.cash ?? 10000;
  const netPnl = portfolio?.netPnl ?? 0;
  const isPnlPositive = netPnl >= 0;

  // Pin Top Index Tickers (Zerodha Kite top ticker bar style)
  const spx = tickers.find(t => t.symbol === '^GSPC' || t.symbol === 'SPY');
  const ndx = tickers.find(t => t.symbol === '^IXIC' || t.symbol === 'QQQ');
  const btc = tickers.find(t => t.symbol === 'BTCUSDT');

  const openPositionsCount = portfolio?.positions?.length || 0;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP APP BAR & LIVE TICKER BAR (Indian Broker Kite/Groww Style)          */}
      {/* ========================================================================= */}
      <header className="bg-white dark:bg-surface-darkPanel border-b border-gray-200 dark:border-surface-darkBorder sticky top-0 z-40 transition-colors">
        
        {/* Ticker Tape */}
        <div className="bg-gray-100 dark:bg-surface-darkCard border-b border-gray-200/60 dark:border-surface-darkBorder/60 px-4 py-1 flex items-center justify-between text-xs overflow-x-auto select-none">
          <div className="flex items-center gap-4 sm:gap-6 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 font-sans font-medium text-gray-400">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="hidden sm:inline">{wsConnected ? 'CBOE/Binance Live' : 'Connecting...'}</span>
            </div>

            {spx && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-sans">S&amp;P 500:</span>
                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">${spx.price.toFixed(2)}</span>
                <span className={`text-[10px] ${spx.changePercent24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {spx.changePercent24h >= 0 ? '+' : ''}{spx.changePercent24h.toFixed(2)}%
                </span>
              </div>
            )}

            {ndx && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-sans">NASDAQ:</span>
                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">${ndx.price.toFixed(2)}</span>
                <span className={`text-[10px] ${ndx.changePercent24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {ndx.changePercent24h >= 0 ? '+' : ''}{ndx.changePercent24h.toFixed(2)}%
                </span>
              </div>
            )}

            {btc && (
              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-gray-500 font-sans">BTC:</span>
                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">${btc.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <span className={`text-[10px] ${btc.changePercent24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {btc.changePercent24h >= 0 ? '+' : ''}{btc.changePercent24h.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 tabular-nums font-medium text-[11px]">
            <div className="hidden sm:flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <span>Capital:</span>
              <span className="font-bold text-gray-900 dark:text-white">${cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <span>P&amp;L:</span>
              <span className={`font-bold ${isPnlPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isPnlPositive ? '+' : ''}${netPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Main Nav Header */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            
            {/* Left: Brand Logo & Terminal Switcher */}
            <div className="flex items-center gap-3">
              <div className="cursor-pointer" onClick={() => setActiveTab('watchlist')}>
                <Logo />
              </div>
            </div>

            {/* Middle: Desktop Tab Navigation */}
            <nav className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-surface-darkCard p-1 rounded-xl border border-gray-200 dark:border-surface-darkBorder">
              
              <button
                onClick={() => setActiveTab('watchlist')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'watchlist'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <ListOrdered className="w-4 h-4" />
                <span>Watchlist</span>
              </button>

              <button
                onClick={() => setActiveTab('chart')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'chart'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>Charts</span>
              </button>

              <button
                onClick={() => setActiveTab('options')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'options'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Option Chain</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'orders'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Orders</span>
              </button>

              <button
                onClick={() => setActiveTab('portfolio')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'portfolio'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Portfolio</span>
                {openPositionsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-medium tabular-nums">
                    {openPositionsCount}
                  </span>
                )}
              </button>

            </nav>

            {/* Right Action Items */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Upgrade / Billing Button */}
              {onOpenBillingModal && (
                <button
                  onClick={() => onOpenBillingModal('reset_10k')}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
                  title="Capital Packages & UPI Upgrades"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Upgrade</span>
                </button>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </button>

              {/* Account Button (Desktop & Mobile) */}
              <button
                onClick={() => setActiveTab('account')}
                className={`p-2 sm:px-3 rounded-xl border transition-colors flex items-center gap-1.5 ${
                  activeTab === 'account'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-surface-darkBorder text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-darkHover'
                }`}
                title="Account / Profile"
              >
                <User className="w-4 h-4" />
                <span className="text-xs font-medium hidden lg:inline">
                  {user ? (user.displayName || user.email.split('@')[0]) : 'Account'}
                </span>
              </button>

            </div>

          </div>
        </div>

      </header>

      {/* ========================================================================= */}
      {/* 2. FIXED MOBILE BOTTOM NAVIGATION BAR (Zerodha Kite & Groww App Style)    */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-surface-darkPanel/95 backdrop-blur-md border-t border-gray-200 dark:border-surface-darkBorder py-1 px-2 select-none shadow-2xl">
        <div className="grid grid-cols-5 gap-1 text-center">
          
          {/* 1. Watchlist */}
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'watchlist'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 font-normal'
            }`}
          >
            <ListOrdered className={`w-5 h-5 mb-0.5 ${activeTab === 'watchlist' ? 'stroke-[2]' : ''}`} />
            <span className="text-[10px]">Watchlist</span>
          </button>

          {/* 2. Orders */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'orders'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 font-normal'
            }`}
          >
            <FileText className={`w-5 h-5 mb-0.5 ${activeTab === 'orders' ? 'stroke-[2]' : ''}`} />
            <span className="text-[10px]">Orders</span>
          </button>

          {/* 3. Portfolio */}
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl relative transition-all ${
              activeTab === 'portfolio'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 font-normal'
            }`}
          >
            <Briefcase className={`w-5 h-5 mb-0.5 ${activeTab === 'portfolio' ? 'stroke-[2]' : ''}`} />
            <span className="text-[10px]">Portfolio</span>
            {openPositionsCount > 0 && (
              <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-medium tabular-nums flex items-center justify-center">
                {openPositionsCount}
              </span>
            )}
          </button>

          {/* 4. Option Chain */}
          <button
            onClick={() => setActiveTab('options')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'options'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 font-normal'
            }`}
          >
            <Layers className={`w-5 h-5 mb-0.5 ${activeTab === 'options' ? 'stroke-[2]' : ''}`} />
            <span className="text-[10px]">F&amp;O Chain</span>
          </button>

          {/* 5. Account */}
          <button
            onClick={() => setActiveTab('account')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'account'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 font-normal'
            }`}
          >
            <User className={`w-5 h-5 mb-0.5 ${activeTab === 'account' ? 'stroke-[2]' : ''}`} />
            <span className="text-[10px]">Account</span>
          </button>

        </div>
      </nav>
    </>
  );
}

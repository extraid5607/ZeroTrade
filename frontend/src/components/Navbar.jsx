import React, { useState, useEffect } from 'react';
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
  Sparkles,
  ShieldCheck,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import Logo from './Logo';
import NumberTicker from './magicui/NumberTicker';
import AnimatedShinyText from './magicui/AnimatedShinyText';

export default function Navbar({
  activeTab,
  setActiveTab,
  portfolio,
  user,
  tickers = [],
  onOpenBillingModal,
  onOpenAdminModal,
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

  // Pin Top Index Tickers
  const spx = tickers.find(t => t.symbol === '^GSPC' || t.symbol === 'SPY');
  const ndx = tickers.find(t => t.symbol === '^IXIC' || t.symbol === 'QQQ');
  const btc = tickers.find(t => t.symbol === 'BTCUSDT');
  const gold = tickers.find(t => t.symbol === 'XAU/USD' || t.symbol === 'GLD');

  const topMobileTickers = [spx, ndx, btc, gold].filter(Boolean);
  const [mobileTickerIndex, setMobileTickerIndex] = useState(0);

  // Auto-cycle top index ticker on mobile every 5 seconds
  useEffect(() => {
    if (topMobileTickers.length <= 1) return;
    const timer = setInterval(() => {
      setMobileTickerIndex(prev => (prev + 1) % topMobileTickers.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [topMobileTickers.length]);

  const activeMobileTicker = topMobileTickers[mobileTickerIndex] || spx || { symbol: 'SPY', price: 560.5, changePercent24h: 0.45 };
  const openPositionsCount = portfolio?.positions?.length || 0;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP APP BAR (DESKTOP DUAL-TIER + MOBILE ULTRA-COMPACT 48px)             */}
      {/* ========================================================================= */}
      <header className="bg-white dark:bg-surface-darkPanel border-b border-gray-200 dark:border-surface-darkBorder sticky top-0 z-40 transition-colors shadow-2xs">
        
        {/* DESKTOP TICKER TAPE (Hidden on mobile) */}
        <div className="hidden md:flex bg-gray-100 dark:bg-surface-darkCard border-b border-gray-200/60 dark:border-surface-darkBorder/60 px-4 py-1 items-center justify-between text-xs overflow-x-auto select-none">
          <div className="flex items-center gap-4 sm:gap-6 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 font-sans font-medium text-gray-400">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="hidden sm:inline">{wsConnected ? 'CBOE/Binance Live' : 'Connecting...'}</span>
            </div>

            {spx && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-sans">S&amp;P 500:</span>
                <NumberTicker value={spx.price} decimalPlaces={2} prefix="$" className="font-semibold text-gray-900 dark:text-white" />
                <span className={`text-[10px] font-medium ${spx.changePercent24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {spx.changePercent24h >= 0 ? '+' : ''}{spx.changePercent24h.toFixed(2)}%
                </span>
              </div>
            )}

            {ndx && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-sans">NASDAQ:</span>
                <NumberTicker value={ndx.price} decimalPlaces={2} prefix="$" className="font-semibold text-gray-900 dark:text-white" />
                <span className={`text-[10px] font-medium ${ndx.changePercent24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {ndx.changePercent24h >= 0 ? '+' : ''}{ndx.changePercent24h.toFixed(2)}%
                </span>
              </div>
            )}

            {btc && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-sans">BTC:</span>
                <NumberTicker value={btc.price} decimalPlaces={2} prefix="$" className="font-semibold text-gray-900 dark:text-white" />
                <span className={`text-[10px] font-medium ${btc.changePercent24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {btc.changePercent24h >= 0 ? '+' : ''}{btc.changePercent24h.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 tabular-nums font-medium text-[11px]">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <span>Capital:</span>
              <NumberTicker value={cash} decimalPlaces={2} prefix="$" className="font-bold text-gray-900 dark:text-white" />
            </div>

            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <span>Day P&amp;L:</span>
              <div className={`font-bold px-1.5 py-0.2 rounded-md flex items-center ${isPnlPositive ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'text-rose-500 bg-rose-50 dark:bg-rose-950/40'}`}>
                <span>{isPnlPositive ? '+' : ''}</span>
                <NumberTicker value={netPnl} decimalPlaces={2} prefix="$" className={isPnlPositive ? 'text-emerald-500' : 'text-rose-500'} />
              </div>
            </div>
          </div>
        </div>

        {/* MAIN NAVIGATION BAR */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-12 md:h-14">
            
            {/* Left: Brand Logo & Mobile Quick Index Chip */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="cursor-pointer active:scale-95 transition-transform shrink-0" onClick={() => setActiveTab('watchlist')}>
                <Logo size="sm" />
              </div>

              {/* Mobile Live Ticker Chip (Responsive width & clean alignment) */}
              <div 
                onClick={() => setMobileTickerIndex(prev => (prev + 1) % Math.max(1, topMobileTickers.length))}
                className="md:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-surface-darkCard border border-gray-200/80 dark:border-surface-darkBorder/80 text-[11px] font-medium cursor-pointer active:scale-95 transition-transform min-w-0 shrink"
                title="Tap to cycle major market indexes"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{activeMobileTicker.symbol === '^GSPC' ? 'S&P' : activeMobileTicker.symbol === '^IXIC' ? 'NDX' : activeMobileTicker.symbol.replace('USDT', '')}:</span>
                <span className="font-semibold text-gray-900 dark:text-white tabular-nums truncate">
                  ${Number(activeMobileTicker.price || 0).toLocaleString('en-US', { minimumFractionDigits: activeMobileTicker.price < 5 ? 3 : 2, maximumFractionDigits: activeMobileTicker.price < 5 ? 3 : 2 })}
                </span>
                <span className={`text-[10px] tabular-nums font-semibold shrink-0 ${activeMobileTicker.changePercent24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {activeMobileTicker.changePercent24h >= 0 ? '+' : ''}{Number(activeMobileTicker.changePercent24h || 0).toFixed(1)}%
                </span>
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
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-medium tabular-nums shadow-xs">
                    {openPositionsCount}
                  </span>
                )}
              </button>

            </nav>

            {/* Right Action Items */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              
              {/* Mobile P&L Chip */}
              <div className="md:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200/80 dark:border-surface-darkBorder/80 text-[11px] tabular-nums font-semibold">
                <span className="text-gray-400 text-[10px]">P&amp;L:</span>
                <span className={isPnlPositive ? 'text-emerald-500' : 'text-rose-500'}>
                  {isPnlPositive ? '+' : ''}${netPnl.toFixed(1)}
                </span>
              </div>

              {/* Admin Desk Button (For Merchant Admins) */}
              {user?.isAdmin && onOpenAdminModal && (
                <button
                  onClick={onOpenAdminModal}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                  title="Admin Payment Verification Desk"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Admin Desk</span>
                </button>
              )}

              {/* Upgrade / Billing Button */}
              {onOpenBillingModal && (
                <button
                  onClick={() => onOpenBillingModal('reset_10k')}
                  className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                  title="Capital Packages & UPI Upgrades"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    <AnimatedShinyText className="text-white">Upgrade</AnimatedShinyText>
                  </span>
                </button>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors active:scale-90"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </button>

              {/* Account Button (Desktop & Mobile) */}
              <button
                onClick={() => setActiveTab('account')}
                className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 ${
                  activeTab === 'account'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-surface-darkBorder text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-darkHover'
                }`}
                title="Account / Profile"
              >
                <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {user ? (user.displayName || user.email || 'U')[0].toUpperCase() : <User className="w-3 h-3" />}
                </div>
                <span className="text-xs font-medium hidden lg:inline">
                  {user ? (user.displayName || user.email.split('@')[0]) : 'Account'}
                </span>
              </button>

            </div>

          </div>
        </div>

      </header>

      {/* ========================================================================= */}
      {/* 2. FIXED MOBILE BOTTOM NAVIGATION BAR (Zerodha Kite & Groww App Signature) */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-surface-darkPanel/95 backdrop-blur-xl border-t border-gray-200/80 dark:border-surface-darkBorder/80 pt-1.5 pb-safe px-2 select-none shadow-2xl transition-colors">
        <div className="grid grid-cols-5 gap-1 text-center">
          
          {/* 1. Watchlist */}
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-90 ${
              activeTab === 'watchlist'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 font-normal hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${activeTab === 'watchlist' ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
              <ListOrdered className={`w-5 h-5 ${activeTab === 'watchlist' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Watchlist</span>
          </button>

          {/* 2. Charts */}
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-90 ${
              activeTab === 'chart'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 font-normal hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${activeTab === 'chart' ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
              <BarChart2 className={`w-5 h-5 ${activeTab === 'chart' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Charts</span>
          </button>

          {/* 3. Orders */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-90 ${
              activeTab === 'orders'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 font-normal hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
              <FileText className={`w-5 h-5 ${activeTab === 'orders' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Orders</span>
          </button>

          {/* 4. Portfolio */}
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl relative transition-all active:scale-90 ${
              activeTab === 'portfolio'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 font-normal hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <div className={`p-1 rounded-xl relative transition-all ${activeTab === 'portfolio' ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
              <Briefcase className={`w-5 h-5 ${activeTab === 'portfolio' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              {openPositionsCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold tabular-nums flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-surface-darkPanel">
                  {openPositionsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Portfolio</span>
          </button>

          {/* 5. Account */}
          <button
            onClick={() => setActiveTab('account')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-90 ${
              activeTab === 'account'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 font-normal hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${activeTab === 'account' ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
              <User className={`w-5 h-5 ${activeTab === 'account' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Account</span>
          </button>

        </div>
      </nav>
    </>
  );
}


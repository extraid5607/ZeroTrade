import React, { useState } from 'react';
import { 
  User, 
  DollarSign, 
  RotateCcw, 
  Sun, 
  Moon, 
  LogOut, 
  ShieldCheck, 
  FileText, 
  Info, 
  Lock, 
  CheckCircle2, 
  ChevronRight,
  X,
  Sparkles,
  Cpu,
  Zap,
  Smartphone
} from 'lucide-react';
import Logo from './Logo';
import PnlReport from './PnlReport';

export default function AccountView({
  user,
  portfolio,
  onOpenBillingModal,
  onOpenAuth,
  onLogout,
  theme,
  toggleTheme,
  onOpenInstallModal,
  onOpenAdminModal
}) {
  const [accountSubTab, setAccountSubTab] = useState('overview'); // 'overview' | 'pnl_report'
  const cash = Number(portfolio?.cash ?? 10000);
  const totalEquity = Number(portfolio?.totalEquity ?? 10000);
  const marketVal = Number(portfolio?.marketValue ?? 0);
  const netPnl = Number(portfolio?.netPnl ?? 0);
  const netReturnPct = Number(portfolio?.netReturnPercent ?? 0);
  const isDepleted = cash <= 0 || totalEquity <= 0;

  // Unified Modal for About & Privacy/Terms
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState('about'); // 'about' | 'privacy'

  return (
    <div className="max-w-5xl mx-auto w-full flex flex-col gap-4">
      
      {/* 1. Sub-Tab Header Switcher: Account Overview vs 1-Year P&L Report */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-darkCard p-1 rounded-xl border border-gray-200 dark:border-surface-darkBorder w-fit">
          <button
            onClick={() => setAccountSubTab('overview')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              accountSubTab === 'overview'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account &amp; Funds</span>
          </button>

          <button
            onClick={() => setAccountSubTab('pnl_report')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              accountSubTab === 'pnl_report'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>P&amp;L Report (1 Year)</span>
          </button>
        </div>

        {onOpenBillingModal && (
          <button
            onClick={() => onOpenBillingModal('reset_10k')}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Upgrade / Reset (UPI)</span>
          </button>
        )}
      </div>

      {/* Render 1-Year P&L Report Tab inside Account */}
      {accountSubTab === 'pnl_report' ? (
        <PnlReport onBack={() => setAccountSubTab('overview')} />
      ) : (
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">

          {/* Account Depleted Notice (If funds hit zero) */}
          {isDepleted && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <span>⚠️ Account Capital Depleted ($0.00)</span>
                </div>
                <p className="text-xs text-rose-500/90 mt-0.5">
                  Your trading capital is exhausted. Pay ₹199 via UPI to instantly restore $10,000.00 or choose a Pro/Elite challenge.
                </p>
              </div>
              <button
                onClick={() => onOpenBillingModal?.('reset_10k')}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 text-white text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Account (₹199 UPI)</span>
              </button>
            </div>
          )}
          
          {/* 2. Profile / User Card */}
          <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder p-4 sm:p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white text-lg font-semibold shadow-md shadow-blue-500/20">
                {user ? (user.displayName || user.email || 'U')[0].toUpperCase() : 'Z'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    {user ? (user.displayName || user.email.split('@')[0]) : 'ZeroBoss Trader'}
                  </h2>
                  <span className="text-[10px] uppercase font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                    Practice Account
                  </span>
                </div>
                <div className="text-xs text-gray-400 font-normal mt-0.5">
                  Client ID: {user ? `ZT-${user.id.toString().padStart(6, '0')}` : 'ZT-GUEST-001'} &bull; Paper Trading Desk
                </div>
              </div>
            </div>

            {user ? (
              <button
                onClick={onLogout}
                className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </button>
            )}
          </div>

          {/* 3. Funds & Virtual Margin Card (Compact & Modern) */}
          <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder p-4 shadow-sm flex flex-col gap-3">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white leading-none">
                    Funds &amp; Account Margin
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Available balance &amp; margin allocation</p>
                </div>
              </div>

              {onOpenBillingModal && (
                <button
                  onClick={() => onOpenBillingModal('tier_25k')}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-medium border border-blue-200 dark:border-blue-900/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upgrade Capital</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              <div className="p-3 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100/80 dark:border-blue-900/40">
                <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold tracking-wider">Available Cash</div>
                <div className="text-lg sm:text-xl font-bold tabular-nums text-gray-900 dark:text-white mt-0.5">
                  ${cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                  <span>100% Liquid Virtual Cash</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Used Margin</div>
                <div className="text-lg sm:text-xl font-bold tabular-nums text-gray-900 dark:text-white mt-0.5">
                  ${marketVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-gray-400 font-normal mt-0.5">Active Positions &amp; Open Orders</div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Total Portfolio Equity</div>
                <div className="text-lg sm:text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
                  ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`text-[10px] font-medium tabular-nums mt-0.5 ${netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {netPnl >= 0 ? '+' : ''}${netPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({netReturnPct.toFixed(2)}%)
                </div>
              </div>

            </div>

          </div>

          {/* 4. Menu / Navigation Options */}
          <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-surface-darkBorder">
            
            {/* Capital Packages & Instant UPI Resets */}
            {onOpenBillingModal && (
              <div 
                onClick={() => onOpenBillingModal('reset_10k')}
                className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-surface-darkHover cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>Capital Packages &amp; UPI Upgrades</span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                        From ₹199
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 font-normal">Account Resets, Pro ($25k) &amp; Elite ($100k) Challenges with instant UPI</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transition-colors" />
              </div>
            )}

            {/* Admin Payment Verification Desk (Strictly for Merchant Admin only) */}
            {user?.isAdmin && onOpenAdminModal && (
              <div 
                onClick={onOpenAdminModal}
                className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors group bg-indigo-50/20 dark:bg-indigo-950/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>Admin Payment Verification Desk</span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Merchant Admin
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 font-normal">Verify incoming 12-digit UTR bank transfers &amp; approve capital credits</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
              </div>
            )}

            {/* P&L Statement & Annual Report */}
            <div 
              onClick={() => setAccountSubTab('pnl_report')}
              className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-surface-darkHover cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <span>P&amp;L Statement &amp; Report</span>
                    <span className="text-[10px] font-normal px-2 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                      1 Year
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 font-normal">View verified profit/loss reports, win rate analytics &amp; export CSV</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>

            {/* Install Mobile App (PWA) */}
            {onOpenInstallModal && (
              <div 
                onClick={onOpenInstallModal}
                className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-surface-darkHover cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>Install ZeroVega Mobile App</span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                        PWA
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 font-normal">Add to your Home Screen for full-screen native mobile trading</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 hidden sm:inline">Install</span>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            )}

            {/* Dark / Light Mode Toggle */}
            <div 
              onClick={toggleTheme}
              className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-surface-darkHover cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-surface-darkCard flex items-center justify-center text-gray-700 dark:text-gray-300">
                  {theme === 'dark' ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Appearance Theme</div>
                  <div className="text-xs text-gray-400 font-normal">Current: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
                </div>
              </div>
              <button className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-surface-darkCard text-gray-700 dark:text-gray-300">
                Toggle
              </button>
            </div>

            {/* Common Unified Section: About ZeroVega, Privacy Policy & Terms */}
            <div 
              onClick={() => {
                setLegalTab('about');
                setIsLegalModalOpen(true);
              }}
              className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-surface-darkHover cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <span>About, Privacy &amp; Legal Policies</span>
                  </div>
                  <div className="text-xs text-gray-400 font-normal">Terminal specs, risk disclosure &amp; policies</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIFIED ABOUT & LEGAL POLICIES MODAL                                      */}
      {/* ========================================================================= */}
      {isLegalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header with Tabs */}
            <div className="p-4 border-b border-gray-100 dark:border-surface-darkBorder flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-surface-darkCard/50">
              <div className="flex items-center gap-1.5 bg-gray-200/70 dark:bg-surface-darkCard p-1 rounded-xl">
                <button
                  onClick={() => setLegalTab('about')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    legalTab === 'about'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>About ZeroVega</span>
                </button>
                <button
                  onClick={() => setLegalTab('privacy')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    legalTab === 'privacy'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Privacy &amp; Terms</span>
                </button>
              </div>

              <button 
                onClick={() => setIsLegalModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {legalTab === 'about' ? (
                <>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      What is ZeroVega?
                    </h4>
                    <p>
                      <strong>ZeroVega</strong> is a high-speed, institutional-grade simulated trading terminal designed for modern derivatives and multi-asset traders. Engineered for paper trading without real financial risk.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder space-y-2">
                    <div className="font-bold text-gray-900 dark:text-white text-xs">Live Global Feeds &amp; Capabilities:</div>
                    <ul className="space-y-1.5 list-disc list-inside">
                      <li><strong className="text-gray-900 dark:text-white">US Mega-Caps &amp; Stocks:</strong> Real-time price action for AAPL, TSLA, NVDA, MSFT, AMZN, GOOGL, META, AMD.</li>
                      <li><strong className="text-gray-900 dark:text-white">Benchmark Indices:</strong> S&amp;P 500 (SPY &amp; ^GSPC), Nasdaq 100 (QQQ &amp; ^IXIC).</li>
                      <li><strong className="text-gray-900 dark:text-white">Futures &amp; Margin Trading:</strong> 1x–20x leverage on Indices, Equities, Crypto and Commodities.</li>
                      <li><strong className="text-gray-900 dark:text-white">Crypto:</strong> Binance live WebSocket feeds (BTC, ETH, SOL, XRP, BNB, DOGE).</li>
                      <li><strong className="text-gray-900 dark:text-white">Forex:</strong> Interbank exchange rates for EUR/USD, GBP/USD, USD/JPY, USD/INR.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-cyan-500" />
                      Order Engine &amp; Realistic Risk Rules
                    </h4>
                    <p>
                      ZeroVega features institutional order execution with sub-second fills, transparent margin requirements (1x to 20x leverage), intraday (MIS) &amp; carry-forward (CNC) support, and automated 1-Year audit P&amp;L reporting.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                      1. Zero Financial Risk &amp; Virtual Currency
                    </h4>
                    <p>
                      ZeroVega does NOT process real market exchange orders or hold real securities. All account starting balances ($10,000.00 default virtual cash) are simulated practice tokens with zero real-world monetary value.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                      2. UPI Challenges, Resets &amp; Tournament Fees
                    </h4>
                    <p>
                      Payments made via UPI (Merchant: <strong>harjinder1070-1@okicici</strong>) for Account Resets (₹199), Monthly Championship Passes (₹299), or Pro/Elite Challenges (₹499/₹999) are fees for simulated assessment, gamified tournament entry, and platform maintenance. Fees are non-refundable once the virtual capital is activated.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                      3. User Security &amp; Data Protection
                    </h4>
                    <p>
                      Passwords are cryptographic hashes protected with industry-standard salt algorithms. We do not store financial credentials, bank account numbers, or real broker API keys. Authentication uses secure signed JSON Web Tokens (JWT).
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                      4. Regulatory Risk Disclaimer
                    </h4>
                    <p>
                      ZeroVega is an educational simulator and paper-trading evaluation desk. ZeroVega is not a SEBI, SEC, or CFTC registered broker-dealer, investment advisor, or asset manager. Simulated backtested performance does not guarantee future trading profits in live markets.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                      5. No Third-Party Data Selling
                    </h4>
                    <p>
                      We respect user privacy and do not sell, rent, or trade your strategies, order history, or contact information to third-party advertisers or marketing networks.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-gray-100 dark:border-surface-darkBorder flex justify-end bg-gray-50/50 dark:bg-surface-darkCard/50">
              <button
                onClick={() => setIsLegalModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

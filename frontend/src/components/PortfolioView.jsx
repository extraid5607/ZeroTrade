import React, { useState } from 'react';
import { 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  RotateCcw, 
  PieChart, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Minus, 
  X, 
  BarChart2, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap, 
  ChevronRight,
  FileText,
  Clock,
  Check,
  ShieldCheck
} from 'lucide-react';

export default function PortfolioView({
  portfolio,
  tickers = [],
  onClosePosition,
  onOpenBillingModal,
  onSelectSymbol,
  onOpenOptionChain,
  onOpenOrderModal
}) {
  const [subTab, setSubTab] = useState('positions'); // 'positions' | 'holdings'
  const [posFilter, setPosFilter] = useState('all'); // 'all' | 'open' | 'closed'
  const [selectedPos, setSelectedPos] = useState(null); // Selected position for interactive pop-up

  const openPositions = portfolio?.positions || [];
  const closedPositions = portfolio?.closedPositionsToday || [];
  const cash = Number(portfolio?.cash) || 10000;
  const marginInvested = Number(portfolio?.marginInvested) || 0;
  const marketVal = Number(portfolio?.marketValue) || 0;
  const totalEquity = Number(portfolio?.totalEquity) || (cash + marginInvested);
  const unrealizedPnl = Number(portfolio?.unrealizedPnl) || 0;
  const realizedPnlToday = Number(portfolio?.realizedPnlToday) || 0;
  const totalRealizedPnl = Number(portfolio?.realizedPnl) || 0;
  const dayPnl = Number(portfolio?.dayPnl !== undefined ? portfolio.dayPnl : (unrealizedPnl + realizedPnlToday));
  const netPnl = Number(portfolio?.netPnl) || 0;
  const isPositive = dayPnl >= 0;
  const isDepleted = cash <= 0 || totalEquity <= 0;

  // Helper to extract base symbol for chart/option chain if derivative contract
  const getBaseSymbol = (sym) => {
    if (!sym) return 'SPY';
    return sym.split(' ')[0] || sym;
  };

  // Filtered list based on 'all' | 'open' | 'closed'
  const displayPositions = subTab === 'holdings'
    ? openPositions
    : (posFilter === 'open'
        ? openPositions
        : posFilter === 'closed'
          ? closedPositions
          : [...openPositions, ...closedPositions]);

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">

      {/* Account Depleted Alert Banner */}
      {isDepleted && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <span>⚠️ Trading Capital Depleted ($0.00)</span>
            </div>
            <p className="text-xs text-rose-500/90 mt-0.5">
              Your account has run out of margin. Unlock $10,000.00 capital or upgrade with instant UPI payment.
            </p>
          </div>
          {onOpenBillingModal && (
            <button
              onClick={() => onOpenBillingModal('reset_10k')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 text-white text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shadow-md shadow-rose-600/20 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset via UPI (₹199)</span>
            </button>
          )}
        </div>
      )}
      
      {/* 1. Sub-Tabs: Positions (Open & Closed Today) vs Holdings */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-darkCard p-1 rounded-xl border border-gray-200 dark:border-surface-darkBorder">
          
          <button
            onClick={() => setSubTab('positions')}
            className={`px-3.5 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              subTab === 'positions'
                ? 'bg-blue-600 text-white shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Positions ({openPositions.length + closedPositions.length})</span>
          </button>

          <button
            onClick={() => setSubTab('holdings')}
            className={`px-3.5 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              subTab === 'holdings'
                ? 'bg-blue-600 text-white shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Holdings ({openPositions.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Positions & Margin Summary Banner */}
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          {/* Margin Invested */}
          <div>
            <div className="text-[11px] text-gray-400 uppercase font-medium tracking-wider flex items-center gap-1">
              <span>Margin Blocked</span>
            </div>
            <div className="text-base sm:text-xl font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">
              ${marginInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Nominal: ${marketVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Total Account Equity */}
          <div>
            <div className="text-[11px] text-gray-400 uppercase font-medium tracking-wider">
              Total Equity
            </div>
            <div className="text-base sm:text-xl font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">
              ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Cash: ${cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Realized P&L Today */}
          <div>
            <div className="text-[11px] text-gray-400 uppercase font-medium tracking-wider">
              Realized P&amp;L (Today)
            </div>
            <div className={`text-base sm:text-xl font-semibold tabular-nums mt-0.5 ${realizedPnlToday >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {realizedPnlToday >= 0 ? '+' : ''}${realizedPnlToday.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              All-time: <span className={`font-medium ${totalRealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)}</span>
            </div>
          </div>

          {/* Day Total P&L */}
          <div className="text-left sm:text-right">
            <div className="text-[11px] text-gray-400 uppercase font-medium tracking-wider">
              Total P&amp;L (Today)
            </div>
            <div className={`text-lg sm:text-2xl font-semibold tabular-nums mt-0.5 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isPositive ? '+' : ''}${dayPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Unrealized: <strong className={`font-medium tabular-nums ${unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}</strong>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Position Filter Bar (All / Open / Closed Today) */}
      {subTab === 'positions' && (
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPosFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                posFilter === 'all'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold'
                  : 'bg-white dark:bg-surface-darkPanel text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-surface-darkBorder'
              }`}
            >
              All ({openPositions.length + closedPositions.length})
            </button>

            <button
              onClick={() => setPosFilter('open')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                posFilter === 'open'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-white dark:bg-surface-darkPanel text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-surface-darkBorder'
              }`}
            >
              Open ({openPositions.length})
            </button>

            <button
              onClick={() => setPosFilter('closed')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                posFilter === 'closed'
                  ? 'bg-orange-600 text-white font-semibold'
                  : 'bg-white dark:bg-surface-darkPanel text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-surface-darkBorder'
              }`}
            >
              Closed Today ({closedPositions.length})
            </button>
          </div>

          <div className="text-[11px] text-gray-400 hidden sm:block">
            US Eastern Time &bull; Retained until 00:00 ET settlement
          </div>
        </div>
      )}

      {/* 4. Positions List */}
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-surface-darkBorder">
        {displayPositions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-surface-darkCard flex items-center justify-center text-gray-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {posFilter === 'closed' ? 'No Closed Positions Today' : 'No Positions Found'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5 font-normal">
                {posFilter === 'closed' 
                  ? 'Positions closed today will stay listed here until US market day-end.'
                  : 'Explore Watchlist or Option Chain to place your first trade.'}
              </div>
            </div>
          </div>
        ) : (
          displayPositions.map(p => {
            const isClosed = p.isClosed || p.quantity === 0;
            const pCurrentPrice = Number(p.currentPrice) || 0;
            const pAvgEntry = Number(p.avgEntryPrice) || 0;
            const pExitPrice = Number(p.exitPrice) || pCurrentPrice;
            const pQty = Number(p.quantity) || 0;
            const isShort = !isClosed && (p.side === 'SHORT' || pQty < 0);
            const pClosedQty = Number(p.closedQuantity) || 0;
            const pMarketVal = Number(p.marketValue) || (pQty * pCurrentPrice);
            const pMargin = Number(p.marginInvested) || ((Math.abs(pQty) * pAvgEntry) / (p.leverage || 1));
            const pPnl = isClosed ? Number(p.realizedPnl || 0) : Number(p.unrealizedPnl || 0);
            const pPnlPct = isClosed ? Number(p.realizedPnlPercent || 0) : Number(p.unrealizedPnlPercent || 0);
            const pnlPositive = pPnl >= 0;
            const isForex = p.assetClass === 'forex';
            const precision = isForex ? 4 : (pCurrentPrice < 5 ? 4 : 2);
            const pLev = Number(p.leverage) || 1;
            const isOpt = Boolean(p.isOption || p.assetClass === 'options' || p.symbol.includes(' CE') || p.symbol.includes(' PE'));
            const isOptWrite = Boolean(p.isOptionWriting || (isOpt && (isShort || pLev === 0.1)));

            return (
              <div
                key={p.id || p.symbol}
                onClick={() => setSelectedPos(p)}
                className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group select-none ${
                  isClosed 
                    ? 'bg-gray-50/50 dark:bg-surface-darkCard/20 hover:bg-gray-100/60 dark:hover:bg-surface-darkHover'
                    : 'hover:bg-blue-50/30 dark:hover:bg-surface-darkHover'
                }`}
              >
                {/* Left: Symbol, Qty, Status Tag & Avg Price */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {p.symbol}
                    </span>
                    
                    <span className="text-[10px] uppercase font-medium px-1.5 py-0.2 rounded bg-gray-100 dark:bg-surface-darkCard text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-surface-darkBorder">
                      {p.assetClass || 'CNC'}
                    </span>

                    {/* Leverage indicator for leveraged positions */}
                    {pLev > 1 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" />
                        {pLev}x LEV
                      </span>
                    )}

                    {isClosed ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-200/80 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        0 QTY (CLOSED)
                      </span>
                    ) : isShort ? (
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40">
                        SHORT
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                        LONG
                      </span>
                    )}

                    {!isClosed && (
                      <span className={`text-xs font-semibold tabular-nums ${isShort ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        Qty: {isShort ? `-${Math.abs(pQty)}` : `+${pQty}`}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-3 tabular-nums font-normal">
                    <span>{isShort ? 'Sell Avg:' : 'Buy Avg:'} <strong className="font-medium text-gray-700 dark:text-gray-300">${pAvgEntry.toFixed(precision)}</strong></span>
                    {isClosed ? (
                      <>
                        <span>Exit: <strong className="font-medium text-gray-700 dark:text-gray-300">${pExitPrice.toFixed(precision)}</strong></span>
                        <span>Closed Qty: <strong className="font-medium text-gray-700 dark:text-gray-300">{pClosedQty}</strong></span>
                        <span className="text-[11px] text-gray-400">
                          (Closed Today &bull; US ET)
                        </span>
                      </>
                    ) : (
                      <>
                        <span>LTP: <strong className="font-medium text-gray-700 dark:text-gray-300">${pCurrentPrice.toFixed(precision)}</strong></span>
                        <span>Margin Blocked: <strong className="font-medium text-gray-700 dark:text-gray-300">${pMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: P&L & Manage Button */}
                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-surface-darkBorder">
                  
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-medium text-gray-400 uppercase">
                      {isClosed ? 'Realized P&L' : 'Unrealized P&L'}
                    </div>
                    <div className={`text-base font-semibold tabular-nums ${pnlPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {pnlPositive ? '+' : ''}${pPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className={`text-xs font-medium tabular-nums ${pnlPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {pnlPositive ? '+' : ''}{pPnlPct.toFixed(2)}% on Margin
                    </div>
                  </div>

                  {/* Manage Pill */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPos(p);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1 ${
                        isClosed
                          ? 'bg-gray-100 dark:bg-surface-darkCard text-gray-600 dark:text-gray-300 border-gray-200 dark:border-surface-darkBorder hover:bg-gray-200'
                          : 'bg-gray-100 dark:bg-surface-darkCard group-hover:bg-blue-600 group-hover:text-white text-gray-700 dark:text-gray-300 border-gray-200 dark:border-surface-darkBorder group-hover:border-blue-600'
                      }`}
                    >
                      <span>{isClosed ? 'Details' : 'Manage'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. POSITION ACTION SHEET / POP-UP                                         */}
      {/* ========================================================================= */}
      {selectedPos && (() => {
        const isPosClosed = selectedPos.isClosed || selectedPos.quantity === 0;
        const posQty = Number(selectedPos.quantity) || 0;
        const isPosShort = !isPosClosed && (selectedPos.side === 'SHORT' || posQty < 0);
        const curPrice = Number(selectedPos.currentPrice) || 0;
        const avgPrice = Number(selectedPos.avgEntryPrice) || 0;
        const posLev = Number(selectedPos.leverage) || 1;
        const precision = (selectedPos.assetClass === 'forex' || curPrice < 5) ? 4 : 2;
        const posMargin = Number(selectedPos.marginInvested) || ((Math.abs(posQty) * avgPrice) / posLev);
        const nominalVal = Math.abs(posQty) * curPrice;
        const isOpt = Boolean(selectedPos.isOption || selectedPos.assetClass === 'options' || selectedPos.symbol.includes(' CE') || selectedPos.symbol.includes(' PE'));
        const isOptWrite = Boolean(selectedPos.isOptionWriting || (isOpt && (isPosShort || posLev === 0.1)));

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
            
            {/* Backdrop */}
            <div className="absolute inset-0" onClick={() => setSelectedPos(null)} />

            {/* Modal / Bottom Sheet */}
            <div className="relative w-full sm:max-w-lg bg-white dark:bg-surface-darkPanel rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden z-10 max-h-[90vh] flex flex-col">
              
              {/* Header */}
              <div className="p-4 border-b border-gray-100 dark:border-surface-darkBorder flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg text-gray-900 dark:text-white">
                      {selectedPos.symbol}
                    </span>
                    <span className="text-[10px] font-normal uppercase px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                      {selectedPos.assetClass || 'CNC'}
                    </span>
                    {posLev > 1 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-0.5">
                        <Zap className="w-3 h-3" />
                        {posLev}x LEVERAGE
                      </span>
                    )}
                    {isPosClosed ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        CLOSED
                      </span>
                    ) : isPosShort ? (
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40">
                        SHORT
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                        LONG
                      </span>
                    )}

                    {!isPosClosed && (
                      <span className={`text-xs font-semibold tabular-nums ${isPosShort ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {isPosShort ? `Short: -${Math.abs(posQty)} Qty` : `Holding: +${posQty} Qty`}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
                    {isPosShort ? 'Sell Avg:' : 'Buy Avg:'} ${avgPrice.toFixed(precision)}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                      ${curPrice.toFixed(precision)}
                    </div>
                    <div className={`text-xs font-semibold tabular-nums flex items-center justify-end gap-0.5 ${
                      ((isPosClosed ? selectedPos.realizedPnl : selectedPos.unrealizedPnl) || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {((isPosClosed ? selectedPos.realizedPnl : selectedPos.unrealizedPnl) || 0) >= 0 ? '+' : ''}${((isPosClosed ? selectedPos.realizedPnl : selectedPos.unrealizedPnl) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPos(null)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Primary Action Buttons: ADD & EXIT */}
              <div className="p-4 border-b border-gray-100 dark:border-surface-darkBorder grid grid-cols-2 gap-3">
                
                {/* BUTTON 1: BUY ACTION */}
                <button
                  onClick={() => {
                    const sym = selectedPos.symbol;
                    setSelectedPos(null);
                    if (onOpenOrderModal) {
                      onOpenOrderModal('BUY', sym);
                    }
                  }}
                  className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {isPosClosed 
                      ? 'RE-ENTER (Buy)' 
                      : isPosShort 
                        ? (isOpt ? 'COVER (Buy to Exit)' : 'COVER (Buy to Exit)') 
                        : 'ADD (Buy More)'}
                  </span>
                </button>

                {/* BUTTON 2: SELL ACTION */}
                <button
                  onClick={() => {
                    const sym = selectedPos.symbol;
                    setSelectedPos(null);
                    if (onOpenOrderModal) {
                      onOpenOrderModal('SELL', sym);
                    }
                  }}
                  className="py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm uppercase tracking-wider shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {isPosClosed 
                      ? 'RE-ENTER (Sell)' 
                      : isPosShort 
                        ? (isOpt ? 'WRITE MORE' : 'ADD SHORT (Sell More)') 
                        : 'EXIT (Square Off)'}
                  </span>
                </button>

              </div>

              {/* Secondary Quick Actions */}
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-surface-darkCard/50 border-b border-gray-100 dark:border-surface-darkBorder flex items-center gap-2">
                
                <button
                  onClick={() => {
                    const base = getBaseSymbol(selectedPos.symbol);
                    setSelectedPos(null);
                    if (onSelectSymbol) {
                      onSelectSymbol(base);
                    }
                  }}
                  className="flex-1 py-2 px-3 rounded-lg border border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkPanel text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <BarChart2 className="w-4 h-4 text-blue-500" />
                  <span>View Chart</span>
                </button>

                {onOpenOptionChain && (
                  <button
                    onClick={() => {
                      const base = getBaseSymbol(selectedPos.symbol);
                      setSelectedPos(null);
                      onOpenOptionChain(base);
                    }}
                    className="flex-1 py-2 px-3 rounded-lg border border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkPanel text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Layers className="w-4 h-4 text-cyan-500" />
                    <span>Option Chain</span>
                  </button>
                )}

              </div>

              {/* Position Breakdown & Analytics */}
              <div className="p-4 space-y-3 overflow-y-auto">
                
                <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  {isPosClosed ? 'Closed Trade Settlement Summary' : 'Position Details & Margin Allocation'}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                    <div className="text-[10px] text-gray-400 font-medium uppercase">
                      {isPosClosed ? 'Closed Quantity' : (isPosShort ? 'Short Quantity' : 'Holding Qty')}
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">
                      {isPosClosed ? (selectedPos.closedQuantity || 0) : (isPosShort ? `-${Math.abs(posQty)}` : `+${posQty}`)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                    <div className="text-[10px] text-gray-400 font-medium uppercase">
                      {isOpt ? 'Product Type' : 'Leverage'}
                    </div>
                    <div className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                      {isOpt ? 'OPTIONS' : `${posLev}x LEVERAGE`}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                    <div className="text-[10px] text-gray-400 font-medium uppercase">
                      Margin Blocked
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">
                      ${posMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                    <div className="text-[10px] text-gray-400 font-medium uppercase">
                      {isPosShort ? 'Avg Short Price' : 'Avg Entry Price'}
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">
                      ${avgPrice.toFixed(precision)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                    <div className="text-[10px] text-gray-400 font-medium uppercase">
                      {isPosClosed ? 'Exit Price' : 'Current LTP'}
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">
                      ${(Number(isPosClosed ? selectedPos.exitPrice : curPrice) || 0).toFixed(precision)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                    <div className="text-[10px] text-gray-400 font-medium uppercase">
                      {isPosClosed ? 'Realized P&L' : 'Unrealized P&L'}
                    </div>
                    <div className={`text-sm font-semibold tabular-nums mt-0.5 ${(Number(isPosClosed ? selectedPos.realizedPnl : selectedPos.unrealizedPnl) || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {(Number(isPosClosed ? selectedPos.realizedPnl : selectedPos.unrealizedPnl) || 0) >= 0 ? '+' : ''}${(Number(isPosClosed ? selectedPos.realizedPnl : selectedPos.unrealizedPnl) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                    <div className="text-[10px] text-gray-400 font-medium uppercase">Return on Margin %</div>
                    <div className={`text-sm font-semibold tabular-nums mt-0.5 ${(Number(isPosClosed ? selectedPos.realizedPnlPercent : selectedPos.unrealizedPnlPercent) || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {(Number(isPosClosed ? selectedPos.realizedPnlPercent : selectedPos.unrealizedPnlPercent) || 0) >= 0 ? '+' : ''}{(Number(isPosClosed ? selectedPos.realizedPnlPercent : selectedPos.unrealizedPnlPercent) || 0).toFixed(2)}%
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                    <div className="text-[10px] text-gray-400 font-medium uppercase">Option Total Premium</div>
                    <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">
                      ${nominalVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder">
                    <div className="text-[10px] text-gray-400 font-medium uppercase">Position Side</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {isPosClosed ? 'CLOSED' : isPosShort ? 'SHORT (WRITE)' : 'LONG'}
                    </div>
                  </div>

                </div>

                {/* Instant Full Market Square Off Option if position is open */}
                {!isPosClosed && posQty !== 0 && (
                  <div className="pt-2 border-t border-gray-100 dark:border-surface-darkBorder flex items-center justify-between">
                    <div className="text-[11px] text-gray-400">
                      Want instant 1-click market square off?
                    </div>
                    <button
                      onClick={() => {
                        const p = selectedPos;
                        setSelectedPos(null);
                        if (onClosePosition) {
                          onClosePosition(p);
                        }
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/40 transition-colors"
                    >
                      {isPosShort ? 'Quick Market Cover All' : 'Quick Market Exit All'}
                    </button>
                  </div>
                )}

              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}

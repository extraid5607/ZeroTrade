import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Calendar, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Info,
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';

const US_SYMBOLS = [
  { symbol: 'SPX', name: 'S&P 500 Index' },
  { symbol: 'NDX', name: 'Nasdaq 100 Index' },
  { symbol: 'SPY', name: 'S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)' },
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
];

export default function OptionChain({ onSelectOptionToTrade }) {
  const [selectedSymbol, setSelectedSymbol] = useState('SPX');
  const [selectedExp, setSelectedExp] = useState('');
  const [strikeCount, setStrikeCount] = useState(24);
  const [chainData, setChainData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mobileView, setMobileView] = useState('both'); // 'both' | 'calls' | 'puts'

  // Fetch option chain
  const fetchChain = async (sym = selectedSymbol, exp = selectedExp, count = strikeCount) => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/options/chain?symbol=${encodeURIComponent(sym)}&strike_count=${count}`;
      if (exp) {
        url += `&expiration=${encodeURIComponent(exp)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to fetch option chain');
      }

      setChainData(data);
      if (!exp && data.selectedExpiration) {
        setSelectedExp(data.selectedExpiration);
      }
    } catch (err) {
      console.error("Option chain error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChain(selectedSymbol, '', strikeCount);
  }, [selectedSymbol, strikeCount]);

  const handleExpChange = (e) => {
    const newExp = e.target.value;
    setSelectedExp(newExp);
    fetchChain(selectedSymbol, newExp, strikeCount);
  };

  const getDTE = (expDateStr) => {
    if (!expDateStr) return '';
    const now = new Date();
    const exp = new Date(expDateStr + 'T16:00:00Z');
    const diffTime = exp - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? `${diffDays}d` : '0d';
  };

  const underlyingPrice = chainData?.underlyingPrice || 0;
  const atmStrike = chainData?.atmStrike || 0;
  const chainRows = chainData?.chain || [];
  const expirations = chainData?.expirations || [];

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto gap-4">
      
      {/* 1. Indian Broker Controls Header */}
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder p-3.5 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        
        {/* Symbol Pills & Underlying Spot */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-darkCard p-1 rounded-xl overflow-x-auto">
            {US_SYMBOLS.slice(0, 6).map(s => (
              <button
                key={s.symbol}
                onClick={() => {
                  setSelectedSymbol(s.symbol);
                  setSelectedExp('');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all min-w-max ${
                  selectedSymbol === s.symbol
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {s.symbol}
              </button>
            ))}

            {/* Extra symbols dropdown */}
            <select
              value={US_SYMBOLS.slice(6).some(s => s.symbol === selectedSymbol) ? selectedSymbol : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedSymbol(e.target.value);
                  setSelectedExp('');
                }
              }}
              className="px-2 py-1 text-xs font-medium bg-transparent text-gray-600 dark:text-gray-400 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>More...</option>
              {US_SYMBOLS.slice(6).map(s => (
                <option key={s.symbol} value={s.symbol} className="bg-white dark:bg-surface-darkPanel text-gray-900 dark:text-white">
                  {s.symbol} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Spot Card */}
          {underlyingPrice > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder">
              <span className="text-xs text-gray-400 font-medium">Spot:</span>
              <span className="text-xs sm:text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                ${underlyingPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-amber-500 font-medium tabular-nums hidden sm:inline">
                ATM: ${atmStrike}
              </span>
            </div>
          )}
        </div>

        {/* Expiration, Strikes & Mobile View Switcher */}
        <div className="flex items-center gap-2">
          
          {/* Mobile Tab Switcher: Both | Calls | Puts (Sensibull Mobile Style) */}
          <div className="sm:hidden flex items-center bg-gray-100 dark:bg-surface-darkCard p-0.5 rounded-lg text-[10px] font-medium">
            <button
              onClick={() => setMobileView('both')}
              className={`px-2 py-1 rounded ${mobileView === 'both' ? 'bg-white dark:bg-surface-darkPanel text-blue-600 shadow-xs font-semibold' : 'text-gray-500'}`}
            >
              All
            </button>
            <button
              onClick={() => setMobileView('calls')}
              className={`px-2 py-1 rounded ${mobileView === 'calls' ? 'bg-emerald-500 text-white font-semibold' : 'text-gray-500'}`}
            >
              Calls
            </button>
            <button
              onClick={() => setMobileView('puts')}
              className={`px-2 py-1 rounded ${mobileView === 'puts' ? 'bg-rose-500 text-white font-semibold' : 'text-gray-500'}`}
            >
              Puts
            </button>
          </div>

          {/* Expiration Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-4 h-4 text-blue-600" />
            <select
              value={selectedExp}
              onChange={handleExpChange}
              disabled={loading || expirations.length === 0}
              className="px-2.5 py-1.5 text-xs font-medium tabular-nums rounded-xl bg-gray-100 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {expirations.map(exp => (
                <option key={exp} value={exp} className="bg-white dark:bg-surface-darkPanel">
                  {exp} ({getDTE(exp)})
                </option>
              ))}
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchChain(selectedSymbol, selectedExp, strikeCount)}
            title="Refresh Option Chain"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

        </div>

      </div>

      {/* 2. Option Chain Table */}
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden shadow-sm flex flex-col">
        
        {/* Table Banner Header */}
        <div className="grid grid-cols-2 border-b border-gray-200 dark:border-surface-darkBorder text-center font-medium text-xs uppercase tracking-wider select-none">
          <div className="py-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-r border-gray-200 dark:border-surface-darkBorder flex items-center justify-center gap-1.5 font-semibold">
            <ArrowUpRight className="w-4 h-4" />
            <span>CALLS (CE)</span>
          </div>
          <div className="py-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 font-semibold">
            <ArrowDownRight className="w-4 h-4" />
            <span>PUTS (PE)</span>
          </div>
        </div>

        {/* Content area */}
        {loading && chainRows.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading official CBOE option chain for {selectedSymbol}...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs text-rose-500 px-4">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[640px]">
            <table className="w-full text-left text-xs border-collapse select-none">
              
              {/* Column Headers */}
              <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-surface-darkCard text-[11px] text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-surface-darkBorder font-medium">
                <tr>
                  {/* CALLS COLUMNS */}
                  {(mobileView === 'both' || mobileView === 'calls') && (
                    <>
                      <th className="py-2.5 px-2 text-right hidden sm:table-cell">Delta</th>
                      <th className="py-2.5 px-2 text-right hidden md:table-cell">IV%</th>
                      <th className="py-2.5 px-2 text-right hidden sm:table-cell">OI</th>
                      <th className="py-2.5 px-2 text-right text-emerald-600 dark:text-emerald-400">Bid</th>
                      <th className="py-2.5 px-2 text-right text-rose-600 dark:text-rose-400">Ask</th>
                      <th className="py-2.5 px-2 text-right font-semibold text-gray-900 dark:text-white">LTP</th>
                      <th className="py-2.5 px-1.5 text-center text-[10px] text-blue-600 dark:text-blue-400">Trade</th>
                    </>
                  )}

                  {/* STRIKE COLUMN (CENTER) */}
                  <th className="py-2.5 px-4 text-center font-semibold text-gray-900 dark:text-white bg-gray-200/80 dark:bg-surface-darkBorder/90 border-x border-gray-200 dark:border-surface-darkBorder">
                    STRIKE
                  </th>

                  {/* PUTS COLUMNS */}
                  {(mobileView === 'both' || mobileView === 'puts') && (
                    <>
                      <th className="py-2.5 px-1.5 text-center text-[10px] text-blue-600 dark:text-blue-400">Trade</th>
                      <th className="py-2.5 px-2 text-left font-semibold text-gray-900 dark:text-white">LTP</th>
                      <th className="py-2.5 px-2 text-left text-emerald-600 dark:text-emerald-400">Bid</th>
                      <th className="py-2.5 px-2 text-left text-rose-600 dark:text-rose-400">Ask</th>
                      <th className="py-2.5 px-2 text-left hidden sm:table-cell">OI</th>
                      <th className="py-2.5 px-2 text-left hidden md:table-cell">IV%</th>
                      <th className="py-2.5 px-2 text-left hidden sm:table-cell">Delta</th>
                    </>
                  )}
                </tr>
              </thead>

              {/* Rows */}
              <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder">
                {chainRows.map(row => {
                  const strike = row.strike;
                  const isAtm = row.isATM;
                  const call = row.call || {};
                  const put = row.put || {};

                  const callItm = call.itm;
                  const putItm = put.itm;

                  return (
                    <tr
                      key={strike}
                      className={`hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors ${
                        isAtm ? 'bg-amber-500/10 dark:bg-amber-500/15' : ''
                      }`}
                    >
                      {/* CALLS */}
                      {(mobileView === 'both' || mobileView === 'calls') && (
                        <>
                          <td className={`py-2 px-2 text-right tabular-nums hidden sm:table-cell ${callItm ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''}`}>
                            {call.delta ? call.delta.toFixed(2) : '-'}
                          </td>
                          <td className={`py-2 px-2 text-right text-gray-400 tabular-nums hidden md:table-cell ${callItm ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''}`}>
                            {call.iv ? `${call.iv}%` : '-'}
                          </td>
                          <td className={`py-2 px-2 text-right text-gray-400 tabular-nums hidden sm:table-cell ${callItm ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''}`}>
                            {call.oi ? call.oi.toLocaleString() : '-'}
                          </td>
                          <td className={`py-2 px-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400 ${callItm ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''}`}>
                            ${call.bid ? call.bid.toFixed(2) : '0.00'}
                          </td>
                          <td className={`py-2 px-2 text-right tabular-nums text-rose-600 dark:text-rose-400 ${callItm ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''}`}>
                            ${call.ask ? call.ask.toFixed(2) : '0.00'}
                          </td>

                          {/* CALL: LTP / Click to open order modal */}
                          <td 
                            onClick={() => onSelectOptionToTrade && onSelectOptionToTrade({
                              side: 'BUY',
                              symbol: call.symbol,
                              underlying: selectedSymbol,
                              strike: strike,
                              type: 'CALL',
                              expiry: selectedExp,
                              price: call.ask || call.ltp || 1.0
                            })}
                            className={`py-2 px-2 text-right font-medium tabular-nums text-gray-900 dark:text-white cursor-pointer hover:underline ${
                              callItm ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : ''
                            }`}
                            title="Click to trade Call"
                          >
                            ${call.ltp ? call.ltp.toFixed(2) : '0.00'}
                          </td>

                          {/* CALL: BUY / SELL Buttons */}
                          <td className={`py-1 px-1.5 ${callItm ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''}`}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onSelectOptionToTrade && onSelectOptionToTrade({
                                  side: 'BUY',
                                  symbol: call.symbol,
                                  underlying: selectedSymbol,
                                  strike: strike,
                                  type: 'CALL',
                                  expiry: selectedExp,
                                  price: call.ask || call.ltp || 1.0
                                })}
                                className="px-2 py-1 text-[10px] font-semibold rounded transition-all bg-blue-600/15 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white active:scale-95 shadow-xs"
                                title="Open Buy Order Modal"
                              >
                                B
                              </button>
                              <button
                                onClick={() => onSelectOptionToTrade && onSelectOptionToTrade({
                                  side: 'SELL',
                                  symbol: call.symbol,
                                  underlying: selectedSymbol,
                                  strike: strike,
                                  type: 'CALL',
                                  expiry: selectedExp,
                                  price: call.bid || call.ltp || 1.0
                                })}
                                className="px-2 py-1 text-[10px] font-semibold rounded transition-all bg-orange-600/15 text-orange-600 dark:text-orange-400 hover:bg-orange-600 hover:text-white active:scale-95 shadow-xs"
                                title="Open Sell Order Modal"
                              >
                                S
                              </button>
                            </div>
                          </td>
                        </>
                      )}

                      {/* CENTER STRIKE */}
                      <td className={`py-2 px-4 text-center font-medium text-sm tabular-nums border-x border-gray-200 dark:border-surface-darkBorder ${
                        isAtm 
                          ? 'bg-amber-500 text-black font-semibold shadow-inner' 
                          : 'bg-gray-100/90 dark:bg-surface-darkCard text-gray-900 dark:text-white'
                      }`}>
                        <div className="flex items-center justify-center gap-1">
                          <span>${strike.toFixed(strike % 1 === 0 ? 0 : 2)}</span>
                          {isAtm && (
                            <span className="text-[9px] uppercase px-1 rounded bg-black text-amber-400 font-medium">
                              ATM
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PUTS */}
                      {(mobileView === 'both' || mobileView === 'puts') && (
                        <>
                          {/* PUT: BUY / SELL Buttons */}
                          <td className={`py-1 px-1.5 ${putItm ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''}`}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onSelectOptionToTrade && onSelectOptionToTrade({
                                  side: 'BUY',
                                  symbol: put.symbol,
                                  underlying: selectedSymbol,
                                  strike: strike,
                                  type: 'PUT',
                                  expiry: selectedExp,
                                  price: put.ask || put.ltp || 1.0
                                })}
                                className="px-2 py-1 text-[10px] font-semibold rounded transition-all bg-blue-600/15 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white active:scale-95 shadow-xs"
                                title="Open Buy Order Modal"
                              >
                                B
                              </button>
                              <button
                                onClick={() => onSelectOptionToTrade && onSelectOptionToTrade({
                                  side: 'SELL',
                                  symbol: put.symbol,
                                  underlying: selectedSymbol,
                                  strike: strike,
                                  type: 'PUT',
                                  expiry: selectedExp,
                                  price: put.bid || put.ltp || 1.0
                                })}
                                className="px-2 py-1 text-[10px] font-semibold rounded transition-all bg-orange-600/15 text-orange-600 dark:text-orange-400 hover:bg-orange-600 hover:text-white active:scale-95 shadow-xs"
                                title="Open Sell Order Modal"
                              >
                                S
                              </button>
                            </div>
                          </td>

                          {/* PUT: LTP */}
                          <td 
                            onClick={() => onSelectOptionToTrade && onSelectOptionToTrade({
                              side: 'BUY',
                              symbol: put.symbol,
                              underlying: selectedSymbol,
                              strike: strike,
                              type: 'PUT',
                              expiry: selectedExp,
                              price: put.ask || put.ltp || 1.0
                            })}
                            className={`py-2 px-2 text-left font-medium tabular-nums text-gray-900 dark:text-white cursor-pointer hover:underline ${
                              putItm ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : ''
                            }`}
                            title="Click to trade Put"
                          >
                            ${put.ltp ? put.ltp.toFixed(2) : '0.00'}
                          </td>

                          <td className={`py-2 px-2 text-left tabular-nums text-emerald-600 dark:text-emerald-400 ${putItm ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''}`}>
                            ${put.bid ? put.bid.toFixed(2) : '0.00'}
                          </td>
                          <td className={`py-2 px-2 text-left tabular-nums text-rose-600 dark:text-rose-400 ${putItm ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''}`}>
                            ${put.ask ? put.ask.toFixed(2) : '0.00'}
                          </td>
                          <td className={`py-2 px-2 text-left tabular-nums text-gray-400 hidden sm:table-cell ${putItm ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''}`}>
                            {put.oi ? put.oi.toLocaleString() : '-'}
                          </td>
                          <td className={`py-2 px-2 text-left tabular-nums text-gray-400 hidden md:table-cell ${putItm ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''}`}>
                            {put.iv ? `${put.iv}%` : '-'}
                          </td>
                          <td className={`py-2 px-2 text-left tabular-nums hidden sm:table-cell ${putItm ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''}`}>
                            {put.delta ? put.delta.toFixed(2) : '-'}
                          </td>
                        </>
                      )}

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

      </div>

      {/* Footer Info */}
      <div className="text-xs text-gray-400 flex flex-wrap items-center justify-between px-2 font-normal">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40 inline-block" />
            ITM Calls
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/40 inline-block" />
            ITM Puts
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500 text-black font-semibold text-[9px] flex items-center justify-center">ATM</span>
            ATM Strike
          </span>
        </div>
        <span>Data source: CBOE Official Institutional Option Feeds</span>
      </div>

    </div>
  );
}

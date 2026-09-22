import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Calendar, 
  Filter, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Award, 
  ShieldCheck, 
  BarChart3, 
  PieChart, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Clock,
  Layers,
  FileText,
  ArrowLeft
} from 'lucide-react';

const TIMEFRAME_OPTIONS = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: '1 Year', value: '1y' },
  { label: 'All Time', value: 'all' },
];

const ASSET_TABS = [
  { label: 'All Assets', value: 'all' },
  { label: 'Stocks & Indices', value: 'stock' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Forex', value: 'forex' },
  { label: 'Options (F&O)', value: 'options' },
];

export default function PnlReport({ onBack = null }) {
  const [timeframe, setTimeframe] = useState('1y');
  const [assetClass, setAssetClass] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPnlReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('zerotrade_token');
      const url = `/api/reports/pnl?timeframe=${timeframe}&asset_class=${assetClass}`;
      const res = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        setError('Failed to fetch P&L report');
      }
    } catch (e) {
      console.error('Error fetching PnL report:', e);
      setError('Network error while loading P&L statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnlReport();
  }, [timeframe, assetClass]);

  const summary = reportData?.summary || {
    realizedPnl: 0,
    charges: 0,
    netRealizedPnl: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRatePercent: 0,
    profitFactor: 1,
    totalProfit: 0,
    totalLoss: 0,
    avgProfit: 0,
    avgLoss: 0,
    maxWin: 0,
    maxLoss: 0
  };

  const dailyPnl = reportData?.dailyPnl || [];
  const trades = reportData?.trades || [];
  const [activeDay, setActiveDay] = useState(null);

  useEffect(() => {
    if (dailyPnl.length > 0) {
      setActiveDay(dailyPnl[dailyPnl.length - 1]);
    } else {
      setActiveDay(null);
    }
  }, [dailyPnl]);

  // Filter trades by search query
  const filteredTrades = useMemo(() => {
    if (!searchQuery.trim()) return trades;
    const q = searchQuery.toLowerCase().trim();
    return trades.filter(t => 
      t.symbol.toLowerCase().includes(q) || 
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.assetClass && t.assetClass.toLowerCase().includes(q))
    );
  }, [trades, searchQuery]);

  // Handle CSV Download
  const handleDownloadCsv = () => {
    const token = localStorage.getItem('zerotrade_token');
    const url = `/api/reports/export?timeframe=${timeframe}&asset_class=${assetClass}`;
    window.open(url, '_blank');
  };

  const isNetPositive = summary.netRealizedPnl >= 0;

  // Max daily value for bar chart normalization
  const maxDailyVal = useMemo(() => {
    if (dailyPnl.length === 0) return 100;
    const maxVal = Math.max(...dailyPnl.map(d => Math.abs(d.realizedPnl)));
    return maxVal > 0 ? maxVal : 100;
  }, [dailyPnl]);

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full pb-12">
      
      {/* 1. Header Bar: Title, Filters & CSV Export */}
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div>
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl border border-gray-200 dark:border-surface-darkBorder text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors mr-1"
                title="Back to Account Overview"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>P&amp;L Statement</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase font-sans">
                  Verified Statement
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Verified trading performance, win-loss distribution &amp; 1-year audit trail.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Timeframe Selector & CSV Download */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Timeframe Buttons */}
          <div className="flex items-center bg-gray-100 dark:bg-surface-darkCard p-1 rounded-xl border border-gray-200 dark:border-surface-darkBorder">
            {TIMEFRAME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTimeframe(opt.value)}
                className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  timeframe === opt.value
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleDownloadCsv}
            title="Download CSV Statement"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={fetchPnlReport}
            title="Refresh Report"
            className="p-1.5 rounded-xl border border-gray-200 dark:border-surface-darkBorder text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-darkCard transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>

      </div>

      {/* 2. Asset Class Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {ASSET_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setAssetClass(tab.value)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-all border ${
              assetClass === tab.value
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent shadow-xs font-semibold'
                : 'bg-white dark:bg-surface-darkPanel border-gray-200 dark:border-surface-darkBorder text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Net Realized P&L */}
        <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder shadow-xs">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Net Realized P&amp;L
          </div>
          <div className={`text-xl sm:text-2xl font-semibold tabular-nums mt-1 ${isNetPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isNetPositive ? '+' : ''}${summary.netRealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1 tabular-nums">
            <span>Gross:</span>
            <strong className="text-gray-700 dark:text-gray-300 font-medium">
              ${summary.realizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        {/* Brokerage & Charges */}
        <div className="p-4 rounded-2xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder shadow-xs">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Brokerage &amp; Charges
          </div>
          <div className="text-xl sm:text-2xl font-semibold tabular-nums text-gray-900 dark:text-white mt-1">
            $0.00
          </div>
          <div className="text-[11px] font-medium text-emerald-500 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero Brokerage Forever</span>
          </div>
        </div>

        {/* Win Rate & Trade Count */}
        <div className="p-4 rounded-2xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder shadow-xs">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Win Rate %
          </div>
          <div className="text-xl sm:text-2xl font-semibold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {summary.winRatePercent.toFixed(1)}%
          </div>
          <div className="text-[11px] text-gray-400 mt-1 tabular-nums flex items-center gap-1.5">
            <span className="text-emerald-500 font-medium">{summary.winningTrades}W</span>
            <span>&bull;</span>
            <span className="text-rose-500 font-medium">{summary.losingTrades}L</span>
            <span>&bull;</span>
            <span className="font-normal">{summary.totalTrades} Total</span>
          </div>
        </div>

        {/* Profit Factor & Risk Metrics */}
        <div className="p-4 rounded-2xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder shadow-xs">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            Profit Factor
          </div>
          <div className="text-xl sm:text-2xl font-semibold tabular-nums text-gray-900 dark:text-white mt-1">
            {summary.profitFactor.toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 tabular-nums flex items-center gap-2">
            <span>Avg W: <strong className="text-emerald-500 font-medium">+${summary.avgProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></span>
            <span>Avg L: <strong className="text-rose-500 font-medium">-${summary.avgLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></span>
          </div>
        </div>

      </div>

      {/* 4. Daily P&L Timeline Bar Visualizer */}
      {dailyPnl.length > 0 && (
        <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder p-4 sm:p-5 shadow-xs">
          
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                Daily P&amp;L Timeline Distribution
              </div>
              <div className="text-[11px] text-gray-400">
                Green indicates net profitable day &bull; Red indicates net loss day
              </div>
            </div>
            <div className="text-xs text-gray-400 tabular-nums font-normal">
              {dailyPnl.length} Trading Day{dailyPnl.length !== 1 ? 's' : ''} Tracked
            </div>
          </div>

          {/* Dedicated Active/Hovered Day P&L Details Card (Crystal Clear & Prominent) */}
          {activeDay && (
            <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder flex flex-wrap items-center justify-between gap-2 transition-all">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Trading Day: <span className="font-mono text-blue-600 dark:text-blue-400">{activeDay.date}</span>
                </span>
                <span className="text-[11px] text-gray-400">
                  ({activeDay.tradeCount} closed trade{activeDay.tradeCount !== 1 ? 's' : ''} &bull; {activeDay.winCount}W / {activeDay.lossCount}L)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-gray-500 dark:text-gray-400">Day Realized P&amp;L:</span>
                <span className={`font-bold text-sm tabular-nums ${activeDay.realizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {activeDay.realizedPnl >= 0 ? '+' : ''}${activeDay.realizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Daily Bars Container with proper headroom and no top-clipping */}
          <div className="pt-4 pb-2 border-b border-gray-100 dark:border-surface-darkBorder">
            <div className="flex items-end gap-1.5 sm:gap-2 h-36 w-full">
              {dailyPnl.map((d, i) => {
                const isProfit = d.realizedPnl >= 0;
                const isSelected = activeDay?.date === d.date;
                const heightPct = Math.max(16, Math.min(100, Math.round((Math.abs(d.realizedPnl) / maxDailyVal) * 100)));

                return (
                  <div 
                    key={d.date || i}
                    onMouseEnter={() => setActiveDay(d)}
                    onClick={() => setActiveDay(d)}
                    className={`flex-1 min-w-[14px] sm:min-w-[20px] max-w-[48px] flex flex-col items-center justify-end h-full relative cursor-pointer transition-all ${
                      isSelected ? 'opacity-100 scale-105' : 'opacity-85 hover:opacity-100'
                    }`}
                    title={`${d.date}: ${isProfit ? '+' : ''}$${d.realizedPnl.toFixed(2)} (${d.tradeCount} trades)`}
                  >
                    {/* Bar */}
                    <div 
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all ${
                        isProfit 
                          ? 'bg-emerald-500 hover:bg-emerald-400 shadow-xs shadow-emerald-500/30 ring-1 ring-emerald-400/40' 
                          : 'bg-rose-500 hover:bg-rose-400 shadow-xs shadow-rose-500/30 ring-1 ring-rose-400/40'
                      } ${isSelected ? 'ring-2 ring-white dark:ring-blue-400' : ''}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline range legend */}
          <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 px-1 tabular-nums">
            <span>{dailyPnl[0]?.date || ''}</span>
            <span>ZeroVega Verified Settlement Log</span>
            <span>{dailyPnl[dailyPnl.length - 1]?.date || ''}</span>
          </div>

        </div>
      )}

      {/* 5. Detailed Closed Trades Audit Table */}
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden shadow-xs">
        
        {/* Table Top Controls: Search Bar & Count */}
        <div className="p-4 border-b border-gray-100 dark:border-surface-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50 dark:bg-surface-darkCard/30">
          <div>
            <span className="font-semibold text-sm text-gray-900 dark:text-white uppercase tracking-tight">
              Closed Trades Breakdown
            </span>
            <span className="text-xs text-gray-400 ml-2 tabular-nums">
              ({filteredTrades.length} records)
            </span>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol (e.g. SPY, EUR/USD)..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 font-medium"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <div className="text-xs text-gray-400">Loading 1-year trade statement...</div>
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs">
              No closed trade records found for this period.
            </div>
          ) : (
            <table className="w-full text-left text-xs divide-y divide-gray-100 dark:divide-surface-darkBorder">
              <thead className="bg-gray-50/80 dark:bg-surface-darkCard/50 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date &amp; Time (UTC)</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Asset Class</th>
                  <th className="px-4 py-3 text-center">Leverage</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Buy Avg</th>
                  <th className="px-4 py-3 text-right">Sell Avg</th>
                  <th className="px-4 py-3 text-right">Realized P&amp;L</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder">
                {filteredTrades.map(t => {
                  const pnlPositive = t.realizedPnl >= 0;
                  const isForex = t.assetClass === 'forex';
                  const precision = isForex ? 4 : (t.exitPrice < 5 ? 4 : 2);
                  const tLev = Number(t.leverage) || 1;

                  return (
                    <tr 
                      key={t.id}
                      className="hover:bg-blue-50/30 dark:hover:bg-surface-darkHover transition-colors"
                    >
                      {/* Date */}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-[11px] tabular-nums">
                        {t.closedAt || '—'}
                      </td>

                      {/* Symbol */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-[13px] text-gray-900 dark:text-gray-100">
                          {t.symbol}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[130px]">
                          {t.name || t.symbol}
                        </div>
                      </td>

                      {/* Asset Class */}
                      <td className="px-4 py-3">
                        <span className="text-[10px] uppercase font-normal px-1.5 py-0.5 rounded bg-gray-100 dark:bg-surface-darkCard text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-surface-darkBorder">
                          {t.assetClass || 'CNC'}
                        </span>
                      </td>

                      {/* Leverage */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          tLev > 1 
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25' 
                            : 'bg-gray-100 dark:bg-surface-darkCard text-gray-500'
                        }`}>
                          {tLev}x
                        </span>
                      </td>

                      {/* Qty */}
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">
                        {t.quantity}
                      </td>

                      {/* Buy Avg */}
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300 font-medium">
                        ${Number(t.entryPrice || 0).toFixed(precision)}
                      </td>

                      {/* Sell Avg */}
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white font-medium">
                        ${Number(t.exitPrice || 0).toFixed(precision)}
                      </td>

                      {/* Realized PnL */}
                      <td className="px-4 py-3 text-right">
                        <div className={`font-semibold tabular-nums ${pnlPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {pnlPositive ? '+' : ''}${Number(t.realizedPnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-[10px] font-normal tabular-nums ${pnlPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {pnlPositive ? '+' : ''}{Number(t.realizedPnlPercent || 0).toFixed(2)}%
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium font-sans ${
                          pnlPositive 
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        }`}>
                          {pnlPositive ? 'PROFIT' : 'LOSS'}
                        </span>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer */}
        <div className="p-3 bg-gray-50 dark:bg-surface-darkCard/50 border-t border-gray-100 dark:border-surface-darkBorder text-center text-[11px] text-gray-400 font-mono flex items-center justify-between px-4">
          <span>{filteredTrades.length} Trades Listed</span>
          <span>ZeroVega 100% Zero-Commission Simulated Trading Statement</span>
        </div>

      </div>

    </div>
  );
}

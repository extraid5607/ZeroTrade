import React from 'react';
import { X, BarChart2, Layers, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function QuoteSheet({
  isOpen,
  onClose,
  ticker,
  onOpenOrderModal, // (side) => ...
  onViewChart,
  onOpenOptionChain
}) {
  if (!isOpen || !ticker) return null;

  const price = ticker.price || 100.0;
  const isPositive = (ticker.changePercent24h || 0) >= 0;
  const precision = price < 5 ? 4 : 2;
  const isOptionEligible = ticker.category === 'index' || ticker.category === 'stock';

  // Generate realistic 5-depth order book based on live market price
  const generateDepth = () => {
    const spread = price * 0.0003;
    const bids = [];
    const asks = [];

    for (let i = 1; i <= 5; i++) {
      const bidP = price - (spread * i);
      const askP = price + (spread * i);
      const bidQty = Math.floor(Math.random() * 500) + 50 * (6 - i);
      const askQty = Math.floor(Math.random() * 500) + 50 * (6 - i);
      bids.push({ orders: Math.floor(Math.random() * 12) + 1, qty: bidQty, price: bidP });
      asks.push({ orders: Math.floor(Math.random() * 12) + 1, qty: askQty, price: askP });
    }
    return { bids, asks };
  };

  const { bids, asks } = generateDepth();
  const totalBidQty = bids.reduce((acc, b) => acc + b.qty, 0);
  const totalAskQty = asks.reduce((acc, a) => acc + a.qty, 0);
  const buyRatio = totalBidQty + totalAskQty > 0 ? (totalBidQty / (totalBidQty + totalAskQty)) * 100 : 50;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet / Modal */}
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-surface-darkPanel rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden z-10 max-h-[90vh] flex flex-col">
        
        {/* Header Bar */}
        <div className="p-4 border-b border-gray-100 dark:border-surface-darkBorder flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg text-gray-900 dark:text-white">
                {ticker.display || ticker.symbol}
              </span>
              <span className="text-[10px] font-normal uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-surface-darkCard text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-surface-darkBorder">
                {ticker.category}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">
              {ticker.name || ticker.symbol}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                ${price.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })}
              </div>
              <div className={`text-xs font-normal tabular-nums flex items-center justify-end gap-0.5 ${
                isPositive ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {isPositive ? '+' : ''}{ticker.changePercent24h ? ticker.changePercent24h.toFixed(2) : '0.00'}%
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary Action Buttons (Indian Broker Kite / Groww Signature) */}
        <div className="p-4 border-b border-gray-100 dark:border-surface-darkBorder grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              onClose();
              onOpenOrderModal('BUY');
            }}
            className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>BUY (Long)</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenOrderModal('SELL');
            }}
            className="py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm uppercase tracking-wider shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
            <span>SELL (Short)</span>
          </button>
        </div>

        {/* Secondary Quick Navigation (Chart & Option Chain) */}
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-surface-darkCard/50 border-b border-gray-100 dark:border-surface-darkBorder flex items-center gap-2">
          <button
            onClick={() => {
              onClose();
              onViewChart(ticker.symbol);
            }}
            className="flex-1 py-2 px-3 rounded-lg border border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkPanel text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <span>View Full Chart</span>
          </button>

          {isOptionEligible && (
            <button
              onClick={() => {
                onClose();
                onOpenOptionChain(ticker.symbol);
              }}
              className="flex-1 py-2 px-3 rounded-lg border border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkPanel text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <Layers className="w-4 h-4 text-cyan-500" />
              <span>Option Chain</span>
            </button>
          )}
        </div>

        {/* Market Depth 5-Depth (Zerodha Kite Classic Feature) */}
        <div className="p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Market Depth (5-Level Bids &amp; Asks)
            </span>
            <div className="text-[10px] tabular-nums text-gray-400 font-normal">
              Buy {buyRatio.toFixed(0)}% / Sell {(100 - buyRatio).toFixed(0)}%
            </div>
          </div>

          {/* Buy/Sell Ratio Progress Bar */}
          <div className="h-1.5 w-full bg-orange-500 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${buyRatio}%` }}
            />
          </div>

          {/* 5-Depth Table */}
          <div className="grid grid-cols-2 gap-2 text-[11px] border border-gray-100 dark:border-surface-darkBorder rounded-xl overflow-hidden bg-gray-50/50 dark:bg-surface-darkCard/30 p-2">
            
            {/* Bids Column */}
            <div>
              <div className="grid grid-cols-3 text-[10px] text-gray-400 uppercase font-medium pb-1 border-b border-gray-200 dark:border-surface-darkBorder">
                <span>Orders</span>
                <span className="text-center">Qty</span>
                <span className="text-right text-blue-600 dark:text-blue-400">Bid</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-surface-darkBorder/40 tabular-nums">
                {bids.map((b, idx) => (
                  <div key={idx} className="grid grid-cols-3 py-1 text-gray-700 dark:text-gray-300">
                    <span className="text-gray-400">{b.orders}</span>
                    <span className="text-center">{b.qty}</span>
                    <span className="text-right font-medium text-blue-600 dark:text-blue-400">
                      ${b.price.toFixed(precision)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-1.5 mt-1 border-t border-gray-200 dark:border-surface-darkBorder flex justify-between font-medium text-[10px] tabular-nums">
                <span className="text-gray-400 uppercase">Total:</span>
                <span className="text-blue-600 dark:text-blue-400">{totalBidQty.toLocaleString()}</span>
              </div>
            </div>

            {/* Asks Column */}
            <div>
              <div className="grid grid-cols-3 text-[10px] text-gray-400 uppercase font-medium pb-1 border-b border-gray-200 dark:border-surface-darkBorder">
                <span className="text-orange-600 dark:text-orange-400">Ask</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Orders</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-surface-darkBorder/40 tabular-nums">
                {asks.map((a, idx) => (
                  <div key={idx} className="grid grid-cols-3 py-1 text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      ${a.price.toFixed(precision)}
                    </span>
                    <span className="text-center">{a.qty}</span>
                    <span className="text-right text-gray-400">{a.orders}</span>
                  </div>
                ))}
              </div>
              <div className="pt-1.5 mt-1 border-t border-gray-200 dark:border-surface-darkBorder flex justify-between font-medium text-[10px] tabular-nums">
                <span className="text-gray-400 uppercase">Total:</span>
                <span className="text-orange-600 dark:text-orange-400">{totalAskQty.toLocaleString()}</span>
              </div>
            </div>

          </div>

          {/* Day Statistics Summary */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] bg-gray-50 dark:bg-surface-darkCard p-2 rounded-lg border border-gray-100 dark:border-surface-darkBorder tabular-nums">
            <div>
              <div className="text-gray-400 font-medium">Open</div>
              <div className="font-medium text-gray-900 dark:text-white">
                ${(ticker.open24h || price).toFixed(precision)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 font-medium">24h High</div>
              <div className="font-medium text-emerald-500">
                ${(ticker.high24h || price * 1.01).toFixed(precision)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 font-medium">24h Low</div>
              <div className="font-medium text-rose-500">
                ${(ticker.low24h || price * 0.99).toFixed(precision)}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

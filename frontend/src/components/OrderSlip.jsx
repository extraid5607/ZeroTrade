import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, DollarSign, Percent, AlertCircle, Zap, ShieldCheck } from 'lucide-react';

const LEVERAGE_OPTIONS = [1, 2, 5, 10, 20];

export default function OrderSlip({
  symbol,
  activeTicker,
  portfolio,
  onOrderPlaced,
  onShowToast
}) {
  const [side, setSide] = useState('BUY'); // BUY or SELL
  const [orderType, setOrderType] = useState('MARKET'); // MARKET or LIMIT
  const [leverage, setLeverage] = useState(1); // 1x up to 20x
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isOption = Boolean(
    activeTicker?.category === 'options' || 
    symbol.includes(' CE') || 
    symbol.includes(' PE') ||
    symbol.includes(' CALL') ||
    symbol.includes(' PUT')
  );

  const price = activeTicker?.price || 100.0;
  const cash = portfolio?.cash || 0.0;

  // Find existing position for this symbol
  const existingPosition = portfolio?.positions?.find(p => p.symbol === symbol);
  const availableQty = existingPosition ? existingPosition.quantity : 0;

  // Set default limit price when symbol or price changes
  useEffect(() => {
    if (price && (!limitPrice || orderType === 'MARKET')) {
      setLimitPrice(price.toString());
    }
  }, [symbol, price]);

  // Calculations
  const numQty = parseFloat(quantity) || 0;
  const numLimitPrice = parseFloat(limitPrice) || price;
  const executionPrice = orderType === 'MARKET' ? price : numLimitPrice;
  const nominalValue = numQty * executionPrice;

  // Percentage quick selectors
  const currentPositionQty = existingPosition ? Number(existingPosition.quantity) || 0 : 0;
  const isShortPosition = currentPositionQty < 0;
  const isLongPosition = currentPositionQty > 0;

  let requiredMargin = 0;
  if (isOption) {
    if (side === 'BUY') {
      requiredMargin = isShortPosition ? 0 : nominalValue; // Full margin
    } else {
      requiredMargin = isLongPosition ? 0 : (nominalValue * 10.0); // 10x premium margin for write
    }
  } else {
    requiredMargin = nominalValue / leverage;
  }

  const handleQuickPercent = (pct) => {
    setError(null);
    if (side === 'BUY') {
      if (isShortPosition) {
        const absShort = Math.abs(currentPositionQty);
        const computed = absShort * (pct / 100);
        const precision = activeTicker?.category === 'crypto' ? 4 : (activeTicker?.category === 'forex' ? 2 : 0);
        const finalQty = precision === 0 ? Math.max(1, Math.round(computed)) : Math.max(0.0001, parseFloat(computed.toFixed(precision)));
        setQuantity(finalQty.toString());
      } else {
        if (price <= 0) return;
        const targetMargin = cash * (pct / 100);
        const maxNominal = isOption ? targetMargin : (targetMargin * leverage);
        const computedQty = maxNominal / price;
        const precision = activeTicker?.category === 'crypto' ? 4 : (activeTicker?.category === 'forex' ? 2 : 0);
        const finalQty = precision === 0 ? Math.max(1, Math.floor(computedQty)) : Math.max(0.0001, parseFloat(computedQty.toFixed(precision)));
        setQuantity(finalQty.toString());
      }
    } else {
      // side === 'SELL'
      if (isLongPosition) {
        const computed = currentPositionQty * (pct / 100);
        const precision = activeTicker?.category === 'crypto' ? 4 : (activeTicker?.category === 'forex' ? 2 : 0);
        const finalQty = precision === 0 ? Math.max(1, Math.round(computed)) : Math.max(0.0001, parseFloat(computed.toFixed(precision)));
        setQuantity(finalQty.toString());
      } else {
        // Short sell
        if (price <= 0) return;
        const targetMargin = cash * (pct / 100);
        const maxNominal = isOption ? (targetMargin / 10.0) : (targetMargin * leverage);
        const computedQty = maxNominal / price;
        const precision = activeTicker?.category === 'crypto' ? 4 : (activeTicker?.category === 'forex' ? 2 : 0);
        const finalQty = precision === 0 ? Math.max(1, Math.floor(computedQty)) : Math.max(0.0001, parseFloat(computedQty.toFixed(precision)));
        setQuantity(finalQty.toString());
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (numQty <= 0) {
      setError("Please enter a quantity greater than zero.");
      return;
    }

    if (side === 'BUY' && !isShortPosition && requiredMargin > cash) {
      setError(`Insufficient cash for order. Needed Margin: $${requiredMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}, Available: $${cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      return;
    }

    if (side === 'SELL' && !isLongPosition && requiredMargin > cash) {
      setError(`Insufficient cash. Needed Margin: $${requiredMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}, Available: $${cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      return;
    }

    if (orderType === 'LIMIT' && (!numLimitPrice || numLimitPrice <= 0)) {
      setError("Please enter a valid limit price.");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('zerotrade_token');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          symbol: symbol,
          side: side,
          order_type: orderType,
          quantity: numQty,
          limit_price: orderType === 'LIMIT' ? numLimitPrice : null,
          leverage: isOption ? 1.0 : leverage,
          asset_class: isOption ? 'options' : (activeTicker?.category || 'stock')
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to place order');
      }

      onShowToast({
        type: 'success',
        title: isOption 
          ? `${side === 'BUY' ? 'Option Bought' : (isLongPosition ? 'Option Exited' : 'Option Written')}` 
          : (orderType === 'MARKET' ? `Order Filled (${leverage}x)` : `Limit Order Placed (${leverage}x)`),
        message: `${side} ${numQty} ${symbol} @ $${data.fillPrice || executionPrice} executed!`
      });

      if (onOrderPlaced) onOrderPlaced(data);

      // Reset quantity input
      setQuantity('1');

    } catch (err) {
      setError(err.message);
      onShowToast({
        type: 'error',
        title: 'Order Rejected',
        message: err.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-surface-darkPanel rounded-xl border border-gray-200 dark:border-surface-darkBorder p-4 shadow-sm flex flex-col gap-4">
      
      {/* Header: Order Slip Title & Current Live Price */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-surface-darkBorder">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            {isOption ? 'Option Order Slip' : 'Futures / Stock Slip'}
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isOption ? 'Options' : 'Futures & Stocks'}
          </span>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
            ${price.toLocaleString('en-US', { minimumFractionDigits: price < 5 ? 4 : 2 })}
          </div>
          <div className={`text-[11px] font-normal tabular-nums ${
            (activeTicker?.changePercent24h || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {(activeTicker?.changePercent24h || 0) >= 0 ? '+' : ''}
            {(activeTicker?.changePercent24h || 0).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Buy / Sell Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-gray-100 dark:bg-surface-darkCard">
        <button
          type="button"
          onClick={() => { setSide('BUY'); setError(null); }}
          className={`py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
            side === 'BUY'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          {isShortPosition ? (isOption ? 'BUY / COVER' : 'BUY / COVER') : (isOption ? 'BUY OPTION' : 'BUY / LONG')}
        </button>

        <button
          type="button"
          onClick={() => { setSide('SELL'); setError(null); }}
          className={`py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
            side === 'SELL'
              ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <ArrowDownRight className="w-4 h-4" />
          {isLongPosition ? (isOption ? 'SELL / EXIT' : 'SELL / EXIT') : (isOption ? 'WRITE OPTION' : 'SELL / SHORT')}
        </button>
      </div>

      {/* Futures Leverage Selector (Up to 20x) */}
      {!isOption && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Futures Leverage:</span>
            </label>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {leverage}x
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {LEVERAGE_OPTIONS.map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => setLeverage(lev)}
                className={`py-1 text-xs font-bold rounded border transition-all ${
                  leverage === lev
                    ? side === 'BUY'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-orange-600 border-orange-600 text-white shadow-sm'
                    : 'border-gray-200 dark:border-surface-darkBorder bg-gray-50 dark:bg-surface-darkCard text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-surface-darkHover'
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Order Type Selector: Market vs Limit */}
      <div className="flex items-center justify-between text-xs font-medium bg-gray-50 dark:bg-surface-darkCard/60 p-1 rounded-lg border border-gray-200 dark:border-surface-darkBorder">
        <button
          type="button"
          onClick={() => setOrderType('MARKET')}
          className={`flex-1 py-1 text-center rounded-md font-medium transition-colors ${
            orderType === 'MARKET'
              ? 'bg-white dark:bg-surface-darkBorder text-gray-900 dark:text-white shadow-xs font-semibold'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Market Order
        </button>
        <button
          type="button"
          onClick={() => setOrderType('LIMIT')}
          className={`flex-1 py-1 text-center rounded-md font-medium transition-colors ${
            orderType === 'LIMIT'
              ? 'bg-white dark:bg-surface-darkBorder text-gray-900 dark:text-white shadow-xs font-semibold'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Limit Order
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        
        {/* Limit Price Input (if LIMIT) */}
        {orderType === 'LIMIT' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Limit Price ($)
            </label>
            <input
              type="number"
              step="any"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="Target execution price"
              className="w-full px-3 py-2 text-sm font-medium tabular-nums rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Quantity Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Quantity / Units
            </label>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              {isShortPosition 
                ? <>Short: <strong className="font-semibold text-orange-600 dark:text-orange-400">-{Math.abs(availableQty)}</strong></>
                : <>Holding: <strong className="font-semibold text-blue-600 dark:text-blue-400">+{availableQty}</strong></>}
            </span>
          </div>
          <input
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); setError(null); }}
            placeholder="0.0"
            className="w-full px-3 py-2 text-sm font-medium tabular-nums rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Quick Allocation Percentages */}
        <div className="grid grid-cols-4 gap-1.5">
          {[25, 50, 75, 100].map(pct => (
            <button
              key={pct}
              type="button"
              onClick={() => handleQuickPercent(pct)}
              className="py-1 text-[11px] font-medium tabular-nums rounded bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-700 dark:text-gray-300 transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Order Summary & Cost Breakdown */}
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-surface-darkCard/50 border border-gray-100 dark:border-surface-darkBorder flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span>
              {isOption 
                ? (side === 'BUY' ? 'Required Margin:' : (isLongPosition ? 'Estimated Proceeds:' : 'Required Margin:'))
                : `Required Margin (${leverage}x):`}
            </span>
            <span className="tabular-nums font-bold text-gray-900 dark:text-white">
              ${requiredMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-[11px]">
            <span>{isOption ? 'Option Premium Value:' : 'Nominal Position Value:'}</span>
            <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">
              ${nominalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-[11px]">
            <span>Available Cash:</span>
            <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
              ${cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-2.5 rounded-lg font-bold text-sm tracking-wide text-white transition-all shadow-md ${
            side === 'BUY'
              ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
              : 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
          } ${submitting ? 'opacity-50 cursor-not-allowed' : 'active:scale-98'}`}
        >
          {submitting
            ? 'Executing order...'
            : side === 'BUY'
              ? (isShortPosition ? `Cover Short (${numQty} ${symbol})` : (isOption ? `Buy Option ${numQty} ${symbol}` : `${orderType === 'MARKET' ? 'Market' : 'Limit'} Buy ${numQty} ${symbol} (${leverage}x)`))
              : (isLongPosition ? `Sell / Exit (${numQty} ${symbol})` : (isOption ? `Write Option ${numQty} ${symbol}` : `${orderType === 'MARKET' ? 'Market' : 'Limit'} Short Sell ${numQty} ${symbol} (${leverage}x)`))
          }
        </button>

      </form>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, ShieldCheck, Info, Check, Plus, Minus, Zap, AlertTriangle, Lock, Sparkles } from 'lucide-react';
import { BorderBeam } from './magicui/BorderBeam';

const LEVERAGE_OPTIONS = [1, 2, 5, 10, 20];

export default function OrderModal({
  isOpen,
  onClose,
  initialSide = 'BUY', // 'BUY' | 'SELL'
  symbol,
  activeTicker,
  portfolio,
  user = null,
  onOpenAuth = null,
  onOpenBillingModal = null,
  onOrderPlaced,
  onShowToast
}) {
  const [side, setSide] = useState(initialSide);
  const [productType, setProductType] = useState('CNC'); // 'CNC' (Delivery/Hold) | 'MIS' (Intraday)
  const [orderType, setOrderType] = useState('MARKET'); // 'MARKET' | 'LIMIT'
  const [leverage, setLeverage] = useState(1); // 1x up to 20x Futures Leverage
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Existing position
  const existingPos = portfolio?.positions?.find(p => p.symbol === symbol);
  const currentPositionQty = existingPos ? Number(existingPos.quantity) || 0 : 0;
  const isShortPosition = currentPositionQty < 0;
  const isLongPosition = currentPositionQty > 0;

  const livePrice = Number(activeTicker?.price || existingPos?.currentPrice || existingPos?.avgEntryPrice || 100.0);
  const cash = Number(portfolio?.cash ?? (user?.virtualCash ?? 10000.0));

  useEffect(() => {
    if (isOpen) {
      setSide(initialSide);
      setError(null);
      setSubmitting(false);
      if (initialSide === 'SELL' && isLongPosition) {
        setQuantity(currentPositionQty.toString());
        setLeverage(existingPos?.leverage || 1);
      } else if (initialSide === 'BUY' && isShortPosition) {
        setQuantity(Math.abs(currentPositionQty).toString());
        setLeverage(existingPos?.leverage || 1);
      } else {
        setQuantity('1');
      }
    }
  }, [isOpen, initialSide, currentPositionQty, isLongPosition, isShortPosition]);

  useEffect(() => {
    if (livePrice && (!limitPrice || orderType === 'MARKET')) {
      setLimitPrice(livePrice.toFixed(livePrice < 5 ? 4 : 2));
    }
  }, [symbol, livePrice, orderType]);

  if (!isOpen) return null;

  const numQty = parseFloat(quantity) || 0;
  const numLimitPrice = parseFloat(limitPrice) || livePrice;
  const execPrice = orderType === 'MARKET' ? livePrice : numLimitPrice;
  const nominalValue = numQty * execPrice;
  const requiredMargin = nominalValue / leverage;

  const handleStepQty = (delta) => {
    const next = Math.max(1, (parseFloat(quantity) || 0) + delta);
    setQuantity(next.toString());
  };

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
        if (execPrice <= 0) return;
        const targetMargin = cash * (pct / 100);
        const maxNominal = targetMargin * leverage;
        const computedQty = maxNominal / execPrice;
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
        // Short Sell
        if (execPrice <= 0) return;
        const targetMargin = cash * (pct / 100);
        const maxNominal = targetMargin * leverage;
        const computedQty = maxNominal / execPrice;
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
      setError("Please enter a quantity greater than 0.");
      return;
    }

    if (side === 'BUY' && !isShortPosition && requiredMargin > cash) {
      setError(`Insufficient funds. Required Margin: $${requiredMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}, Available Cash: $${cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      return;
    }

    if (side === 'SELL' && !isLongPosition && requiredMargin > cash) {
      setError(`Insufficient funds. Required Margin: $${requiredMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}, Available Cash: $${cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      return;
    }

    if (orderType === 'LIMIT' && (!numLimitPrice || numLimitPrice <= 0)) {
      setError("Please enter a valid limit price.");
      return;
    }

    const token = localStorage.getItem('zerotrade_token');
    if (!token) {
      setError("Please sign in to execute live simulated trades.");
      if (onOpenAuth) {
        onOpenAuth();
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          symbol: symbol,
          side: side,
          order_type: orderType,
          quantity: numQty,
          limit_price: orderType === 'LIMIT' ? numLimitPrice : null,
          price: execPrice,
          leverage: leverage,
          asset_class: activeTicker?.category || 'stock'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Order execution failed');
      }

      onShowToast?.({
        type: 'success',
        title: `${side} Order Executed (${leverage}x)`,
        message: `${side} ${numQty} ${symbol} @ $${data.fillPrice || execPrice} successful!`
      });

      onOrderPlaced?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isBuy = side === 'BUY';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Order Window */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-surface-darkPanel rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden z-10 max-h-[92vh] flex flex-col pb-safe">
        <BorderBeam size={220} duration={10} colorFrom={isBuy ? "#3b82f6" : "#ea580c"} colorTo={isBuy ? "#06b6d4" : "#f59e0b"} />
        
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-surface-darkBorder" />
        </div>

        {/* Styled Header Banner */}
        <div className={`px-4 py-3 sm:py-4 flex items-center justify-between transition-colors ${
          isBuy 
            ? 'bg-blue-600 text-white' 
            : 'bg-orange-600 text-white'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/20">
                {isBuy 
                  ? (isShortPosition ? 'BUY / COVER SHORT' : 'BUY (LONG)') 
                  : (isLongPosition ? 'SELL / EXIT LONG' : 'SELL (SHORT)')
                }
              </span>
              <span className="font-semibold text-base sm:text-lg tracking-tight">
                {activeTicker?.display || symbol}
              </span>
            </div>
            <div className="text-xs text-white/80 tabular-nums mt-0.5 flex items-center gap-2 font-medium">
              <span>LTP: ${livePrice.toLocaleString('en-US', { minimumFractionDigits: livePrice < 5 ? 4 : 2 })}</span>
              <span>&bull; {activeTicker?.category ? activeTicker.category.toUpperCase() : 'FUTURES'}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/20 text-white transition-colors active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side Switcher: BUY / SELL tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-gray-100 dark:bg-surface-darkCard border-b border-gray-200 dark:border-surface-darkBorder">
          <button
            type="button"
            onClick={() => { setSide('BUY'); setError(null); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all active:scale-95 ${
              isBuy
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {isShortPosition ? 'BUY (Cover Short)' : 'BUY (Long)'}
          </button>
          <button
            type="button"
            onClick={() => { setSide('SELL'); setError(null); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all active:scale-95 ${
              !isBuy
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {isLongPosition ? 'SELL (Exit Long)' : 'SELL (Short)'}
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex flex-col gap-3.5">
          
          {/* Futures Leverage Selector (1x up to 20x) */}
          <div>
            {(() => {
              const isPaidUser = Boolean(user?.isPaidPlan || user?.isAdmin || user?.is_admin === 1);
              const maxAllowedLeverage = isPaidUser ? 20 : (Number(user?.maxLeverage) || 2);

              return (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Futures Leverage</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isPaidUser 
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                          : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25'
                      }`}>
                        {isPaidUser ? 'Up to 20x (PRO)' : 'Max 2x (Free)'}
                      </span>
                    </label>
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {leverage}x Multiplier
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {LEVERAGE_OPTIONS.map((lev) => {
                      const isLocked = lev > maxAllowedLeverage;
                      return (
                        <button
                          key={lev}
                          type="button"
                          onClick={() => {
                            if (isLocked) {
                              setError(`20x Leverage is a Pro feature! Free plan is capped at 2x leverage. Upgrade to unlock 5x, 10x & 20x leverage.`);
                              onOpenBillingModal?.('reset_10k');
                              return;
                            }
                            setLeverage(lev);
                            setError(null);
                          }}
                          className={`relative py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            leverage === lev
                              ? isBuy
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                                : 'bg-orange-600 border-orange-600 text-white shadow-sm ring-1 ring-orange-500'
                              : isLocked
                              ? 'border-gray-200/80 dark:border-surface-darkBorder/60 bg-gray-100/70 dark:bg-surface-darkCard/40 text-gray-400 dark:text-gray-500 hover:border-amber-400'
                              : 'border-gray-200 dark:border-surface-darkBorder bg-gray-50 dark:bg-surface-darkCard text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-surface-darkHover'
                          }`}
                          title={isLocked ? "Upgrade Plan to unlock 20x Leverage" : `${lev}x Leverage`}
                        >
                          <span className="flex items-center justify-center gap-0.5">
                            <span>{lev}x</span>
                            {isLocked && <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {!isPaidUser && (
                    <div 
                      onClick={() => onOpenBillingModal?.('reset_10k')}
                      className="mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between cursor-pointer hover:bg-amber-500/15 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Free Plan: <strong>2x Max Leverage</strong>. Upgrade to unlock <strong>20x</strong>!</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 underline">
                        Upgrade
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Product Type Tabs: Intraday (MIS) vs Longterm (CNC) */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
              Product Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProductType('CNC')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-all ${
                  productType === 'CNC'
                    ? isBuy 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500 font-semibold'
                      : 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500 font-semibold'
                    : 'border-gray-200 dark:border-surface-darkBorder text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-darkHover'
                }`}
              >
                <div>Longterm (CNC / NRML)</div>
                <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-0.5">Positional Futures / Delivery</div>
              </button>

              <button
                type="button"
                onClick={() => setProductType('MIS')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-all ${
                  productType === 'MIS'
                    ? isBuy 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500 font-semibold'
                      : 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500 font-semibold'
                    : 'border-gray-200 dark:border-surface-darkBorder text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-darkHover'
                }`}
              >
                <div>Intraday (MIS)</div>
                <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-0.5">Day Trade (Square Off)</div>
              </button>
            </div>
          </div>

          {/* Order Type: Market vs Limit */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
              Order Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderType('MARKET')}
                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                  orderType === 'MARKET'
                    ? isBuy
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-semibold'
                    : 'border-gray-200 dark:border-surface-darkBorder text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-darkHover'
                }`}
              >
                Market (Instant)
              </button>
              <button
                type="button"
                onClick={() => setOrderType('LIMIT')}
                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                  orderType === 'LIMIT'
                    ? isBuy
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-semibold'
                    : 'border-gray-200 dark:border-surface-darkBorder text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-darkHover'
                }`}
              >
                Limit (Custom Price)
              </button>
            </div>
          </div>

          {/* Quantity Stepper Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Quantity (Qty / Lots)
              </label>
              <span className="text-[11px] tabular-nums text-gray-400 font-normal">
                {isLongPosition 
                  ? `Holding: +${currentPositionQty} (LONG)` 
                  : isShortPosition 
                    ? `Position: ${currentPositionQty} (SHORT)` 
                    : 'Holding: 0 (Flat)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStepQty(-1)}
                className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-darkHover font-bold active:scale-95 transition-transform"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                type="number"
                step="any"
                min="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1 h-10 px-3 text-center text-sm font-medium tabular-nums rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1"
              />

              <button
                type="button"
                onClick={() => handleStepQty(1)}
                className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-darkHover font-bold active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Multiplier Chips */}
            <div className="flex items-center gap-1.5 mt-2">
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPercent(pct)}
                  className="flex-1 py-1 text-[10px] font-medium tabular-nums rounded bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-surface-darkBorder transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Limit Price Input (Only for Limit Orders) */}
          {orderType === 'LIMIT' && (
            <div>
              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                Limit Price ($)
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="w-full h-10 px-3 text-sm font-medium tabular-nums rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={livePrice.toString()}
              />
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Margin & Funds Calculation Bar */}
          <div className="bg-gray-50 dark:bg-surface-darkCard rounded-xl p-3 border border-gray-200 dark:border-surface-darkBorder flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium">
                  {`Required Margin (${leverage}x Leverage)`}
                </div>
                <div className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                  ${requiredMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium">Available Cash</div>
                <div className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  ${cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-gray-200/60 dark:border-surface-darkBorder/60 text-[11px] text-gray-500 dark:text-gray-400">
              <span>Nominal Position Value:</span>
              <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                ${nominalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Big Action Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 px-4 rounded-xl text-sm font-semibold uppercase tracking-wider text-white shadow-lg transition-all active:scale-[0.98] ${
              isBuy
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                : 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/25'
            } ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {submitting 
              ? 'Executing Simulated Trade...' 
              : isBuy
                ? (isShortPosition ? `BUY TO COVER ${symbol}` : `BUY ${symbol} (LONG ${leverage}x)`)
                : (isLongPosition ? `SELL / EXIT ${symbol}` : `SHORT SELL ${symbol} (${leverage}x)`)
            }
          </button>

          <div className="text-center text-[10px] text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1 -mt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Simulated Paper Trade &bull; Zero Real Money Risk</span>
          </div>

        </form>

      </div>

    </div>
  );
}

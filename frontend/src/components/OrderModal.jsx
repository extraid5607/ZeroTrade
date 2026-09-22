import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, ShieldCheck, Info, Check, Plus, Minus, Zap, AlertTriangle } from 'lucide-react';

const LEVERAGE_OPTIONS = [1, 2, 5, 10, 20];

export default function OrderModal({
  isOpen,
  onClose,
  initialSide = 'BUY', // 'BUY' | 'SELL'
  symbol,
  activeTicker,
  portfolio,
  onOrderPlaced,
  onShowToast,
  contractInfo = null // for options: { type: 'CALL'|'PUT', strike, expiry, price }
}) {
  const [side, setSide] = useState(initialSide);
  const [productType, setProductType] = useState('CNC'); // 'CNC' (Delivery/Normal) | 'MIS' (Intraday)
  const [orderType, setOrderType] = useState('MARKET'); // 'MARKET' | 'LIMIT'
  const [leverage, setLeverage] = useState(1); // 1x up to 20x (Futures/Stocks only)
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Identify if trading an Option Contract vs Futures/Stocks
  const tradeSymbol = contractInfo ? `${symbol} ${contractInfo.strike} ${contractInfo.type === 'CALL' ? 'CE' : 'PE'}` : symbol;
  const isOption = Boolean(
    contractInfo || 
    activeTicker?.category === 'options' || 
    tradeSymbol.includes(' CE') || 
    tradeSymbol.includes(' PE') || 
    tradeSymbol.includes(' CALL') || 
    tradeSymbol.includes(' PUT')
  );

  // Existing position
  const existingPos = portfolio?.positions?.find(p => p.symbol === tradeSymbol || p.symbol === symbol);
  const currentPositionQty = existingPos ? Number(existingPos.quantity) || 0 : 0;
  const isShortPosition = currentPositionQty < 0;
  const isLongPosition = currentPositionQty > 0;

  const livePrice = Number(contractInfo?.price || (activeTicker?.price && activeTicker.symbol === symbol ? activeTicker.price : null) || existingPos?.currentPrice || existingPos?.avgEntryPrice || activeTicker?.price || 100.0);
  const cash = Number(portfolio?.cash || 0.0);

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
        if (isOption) {
          setLeverage(1);
        }
      }
    }
  }, [isOpen, initialSide, currentPositionQty, isLongPosition, isShortPosition, isOption]);

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

  // Margin Calculation Rules:
  // 1. Options:
  //    - Option Buying: 100% Full Cash Margin (No leverage)
  //    - Option Writing (Selling without holding): 10x Option Premium Margin Required ($10 premium = $100 margin)
  // 2. Futures / Stocks / Crypto / Forex:
  //    - Up to 20x Leverage: Margin = Nominal / Leverage
  let requiredMargin = 0;
  if (isOption) {
    if (side === 'BUY') {
      requiredMargin = isShortPosition ? 0 : nominalValue; // 100% full margin for option buy
    } else {
      // side === 'SELL'
      requiredMargin = isLongPosition ? 0 : (nominalValue * 10.0); // 10x Option Premium margin for option write
    }
  } else {
    // Futures / Stocks
    requiredMargin = nominalValue / leverage;
  }

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
        const maxNominal = isOption ? targetMargin : (targetMargin * leverage);
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
        // Short Sell / Option Write
        if (execPrice <= 0) return;
        const targetMargin = cash * (pct / 100);
        const maxNominal = isOption ? (targetMargin / 10.0) : (targetMargin * leverage);
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
          symbol: tradeSymbol,
          side: side,
          order_type: orderType,
          quantity: numQty,
          limit_price: orderType === 'LIMIT' ? numLimitPrice : null,
          price: execPrice,
          leverage: isOption ? 1.0 : leverage,
          asset_class: isOption ? 'options' : (activeTicker?.category || 'stock')
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Order execution failed');
      }

      onShowToast?.({
        type: 'success',
        title: isOption 
          ? `${side === 'BUY' ? 'Option Bought' : (isLongPosition ? 'Option Exited' : 'Option Written')}`
          : `${side} Order Executed (${leverage}x)`,
        message: `${side} ${numQty} ${tradeSymbol} @ $${data.fillPrice || execPrice} successful!`
      });

      onOrderPlaced?.();
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
      <div className="relative w-full sm:max-w-md bg-white dark:bg-surface-darkPanel rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden z-10 max-h-[92vh] flex flex-col">
        
        {/* Styled Header Banner */}
        <div className={`px-4 py-3 sm:py-4 flex items-center justify-between transition-colors ${
          isBuy 
            ? 'bg-blue-600 text-white' 
            : 'bg-orange-600 text-white'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-black/20">
                {isBuy 
                  ? (isShortPosition ? (isOption ? 'BUY TO COVER (Option)' : 'BUY / COVER') : (isOption ? 'BUY OPTION' : 'BUY')) 
                  : (isLongPosition ? (isOption ? 'EXIT OPTION' : 'SELL / EXIT') : (isOption ? 'WRITE OPTION' : 'SHORT SELL'))
                }
              </span>
              <span className="font-semibold text-base sm:text-lg tracking-tight">
                {contractInfo ? `${symbol} $${contractInfo.strike} ${contractInfo.type}` : (activeTicker?.display || symbol)}
              </span>
            </div>
            <div className="text-xs text-white/80 tabular-nums mt-0.5 flex items-center gap-2 font-medium">
              <span>{isOption ? 'Premium LTP' : 'LTP'}: ${livePrice.toLocaleString('en-US', { minimumFractionDigits: livePrice < 5 ? 4 : 2 })}</span>
              {contractInfo?.expiry && <span>&bull; Exp: {contractInfo.expiry}</span>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side Switcher: BUY / SELL tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-gray-100 dark:bg-surface-darkCard border-b border-gray-200 dark:border-surface-darkBorder">
          <button
            type="button"
            onClick={() => { setSide('BUY'); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              isBuy
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {isShortPosition ? (isOption ? 'BUY (Cover Option)' : 'BUY (Cover Short)') : (isOption ? 'BUY (Option)' : 'BUY (Long)')}
          </button>
          <button
            type="button"
            onClick={() => { setSide('SELL'); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              !isBuy
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {isLongPosition 
              ? (isOption ? 'SELL (Exit Option)' : 'SELL (Exit Long)') 
              : (isOption ? 'SELL / WRITE' : 'SELL (Short)')}
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex flex-col gap-3.5">
          
          {/* Futures / Stocks: Interactive Leverage Selector (Up to 20x) */}
          {!isOption && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Futures Leverage</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                    Up to 20x
                  </span>
                </label>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {leverage}x Multiplier
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {LEVERAGE_OPTIONS.map((lev) => (
                  <button
                    key={lev}
                    type="button"
                    onClick={() => setLeverage(lev)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      leverage === lev
                        ? isBuy
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                          : 'bg-orange-600 border-orange-600 text-white shadow-sm ring-1 ring-orange-500'
                        : 'border-gray-200 dark:border-surface-darkBorder bg-gray-50 dark:bg-surface-darkCard text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-surface-darkHover'
                    }`}
                  >
                    {lev}x
                  </button>
                ))}
              </div>
            </div>
          )}

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
                <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-0.5">Hold until Expiry / Close</div>
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
                  {isOption 
                    ? (side === 'BUY' 
                        ? 'Required Margin' 
                        : (isLongPosition ? 'Estimated Proceeds' : 'Required Margin'))
                    : `Required Margin (${leverage}x Leverage)`}
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
              <span>{isOption ? 'Option Premium Total Value:' : 'Nominal Position Value:'}</span>
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
                ? (isShortPosition ? `BUY TO COVER ${tradeSymbol}` : (isOption ? `BUY OPTION ${tradeSymbol}` : `BUY ${tradeSymbol} (${leverage}x)`))
                : (isLongPosition ? `SELL / EXIT ${tradeSymbol}` : (isOption ? `WRITE / SELL ${tradeSymbol}` : `SHORT SELL ${tradeSymbol} (${leverage}x)`))
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

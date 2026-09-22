import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCw,
  Trash2,
  Edit3,
  RotateCcw,
  X,
  Plus,
  Minus,
  Check,
  Zap,
  Repeat
} from 'lucide-react';

export default function OrdersLog({
  onCancelOrder,
  onReorder,
  onOrderModified,
  onShowToast,
  lastOrderUpdate
}) {
  const [tab, setTab] = useState('open'); // 'open' | 'executed'
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modifying open order state
  const [modifyingOrder, setModifyingOrder] = useState(null);
  const [modQty, setModQty] = useState('1');
  const [modPrice, setModPrice] = useState('');
  const [modSubmitting, setModSubmitting] = useState(false);
  const [modError, setModError] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zerotrade_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [ordRes, txRes] = await Promise.all([
        fetch('/api/orders?limit=60', { headers }),
        fetch('/api/transactions?limit=60', { headers })
      ]);

      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(ordData.orders || []);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }
    } catch (e) {
      console.error("Error fetching order logs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, lastOrderUpdate]);

  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const executedOrders = orders.filter(o => o.status === 'FILLED' || o.status === 'CANCELLED');

  // Open Modification Modal
  const handleOpenModify = (order) => {
    setModifyingOrder(order);
    setModQty((order.quantity || 1).toString());
    setModPrice((order.limit_price || 100).toFixed(order.limit_price < 5 ? 4 : 2));
    setModError(null);
  };

  // Submit Order Modification
  const handleSaveModification = async (e) => {
    e.preventDefault();
    if (!modifyingOrder) return;
    setModError(null);

    const numQty = parseFloat(modQty);
    const numPrice = parseFloat(modPrice);

    if (!numQty || numQty <= 0) {
      setModError("Please enter a valid quantity greater than 0.");
      return;
    }
    if (!numPrice || numPrice <= 0) {
      setModError("Please enter a valid limit price.");
      return;
    }

    setModSubmitting(true);
    try {
      const token = localStorage.getItem('zerotrade_token');
      const res = await fetch(`/api/orders/${modifyingOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          quantity: numQty,
          limit_price: numPrice
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to modify order');
      }

      if (onShowToast) {
        onShowToast({
          type: 'success',
          title: 'Order Modified',
          message: `Order #${modifyingOrder.id} (${modifyingOrder.symbol}) updated to ${numQty} @ $${numPrice.toFixed(2)}`
        });
      }

      setModifyingOrder(null);
      fetchOrders();
      if (onOrderModified) onOrderModified();
    } catch (err) {
      setModError(err.message);
    } finally {
      setModSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
      
      {/* Top Header & Subtabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-darkCard p-1 rounded-xl">
          <button
            onClick={() => setTab('open')}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              tab === 'open'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Open Orders ({pendingOrders.length})
          </button>
          <button
            onClick={() => setTab('executed')}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              tab === 'executed'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Executed &amp; Closed ({executedOrders.length})
          </button>
        </div>

        <button
          onClick={fetchOrders}
          title="Refresh orders"
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Orders List */}
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-surface-darkBorder">
        
        {/* ========================================================================= */}
        {/* TAB 1: OPEN PENDING LIMIT ORDERS                                          */}
        {/* ========================================================================= */}
        {tab === 'open' && (
          pendingOrders.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-surface-darkCard flex items-center justify-center text-gray-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">No Open Orders</div>
                <div className="text-xs text-gray-400 mt-0.5 font-normal">Place a Limit order to see pending triggers here.</div>
              </div>
            </div>
          ) : (
            pendingOrders.map(o => (
              <div
                key={o.id}
                className="p-4 hover:bg-gray-50/50 dark:hover:bg-surface-darkHover transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded text-white ${
                      o.side === 'BUY' ? 'bg-blue-600' : 'bg-orange-600'
                    }`}>
                      {o.side}
                    </span>
                    <span className="font-medium text-base text-gray-900 dark:text-white">
                      {o.symbol}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-blue-600 dark:text-blue-400">
                      Qty: {o.quantity}
                    </span>
                    <span className="text-[10px] uppercase font-normal px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      LIMIT &bull; PENDING
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-3 tabular-nums font-normal">
                    <span>Limit Price: <strong className="font-medium text-gray-900 dark:text-white">${Number(o.limit_price || 0).toFixed(Number(o.limit_price || 0) < 5 ? 4 : 2)}</strong></span>
                    <span>Total: <strong className="font-medium">${(Number(o.quantity || 0) * Number(o.limit_price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                    <span>Placed: {new Date(o.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Open Order Action Buttons: MODIFY & CANCEL (Zerodha Kite Style) */}
                <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-surface-darkBorder">
                  
                  {/* Modify Button */}
                  <button
                    onClick={() => handleOpenModify(o)}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-200 dark:border-blue-900/40 text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                    title="Modify Limit Price or Quantity"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modify</span>
                  </button>

                  {/* Cancel Button */}
                  <button
                    onClick={() => onCancelOrder(o.id)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-200 dark:border-rose-900/40 text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                    title="Cancel Limit Order & Refund Funds"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>

                </div>
              </div>
            ))
          )
        )}

        {/* ========================================================================= */}
        {/* TAB 2: EXECUTED & CLOSED ORDERS (WITH REORDER OPTION)                      */}
        {/* ========================================================================= */}
        {tab === 'executed' && (
          executedOrders.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400 font-normal">
              No executed or closed orders yet.
            </div>
          ) : (
            executedOrders.map(o => {
              const isFilled = o.status === 'FILLED';

              return (
                <div
                  key={o.id}
                  className="p-4 hover:bg-gray-50/50 dark:hover:bg-surface-darkHover transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded text-white ${
                        o.side === 'BUY' ? 'bg-blue-600' : 'bg-orange-600'
                      }`}>
                        {o.side}
                      </span>
                      <span className="font-medium text-base text-gray-900 dark:text-white">
                        {o.symbol}
                      </span>
                      <span className="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">
                        Qty: {o.quantity}
                      </span>
                      <span className={`text-[10px] uppercase font-normal px-1.5 py-0.5 rounded border ${
                        isFilled
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-gray-100 text-gray-500 border-gray-200 dark:border-surface-darkBorder'
                      }`}>
                        {o.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-3 tabular-nums font-normal">
                      <span>Fill Price: <strong className="font-medium text-gray-900 dark:text-white">${o.filled_price ? Number(o.filled_price).toFixed(Number(o.filled_price) < 5 ? 4 : 2) : '-'}</strong></span>
                      <span>Type: {o.order_type}</span>
                      <span>Time: {new Date(o.filled_at || o.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Reorder Action (Zerodha Kite Style) */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-surface-darkBorder">
                    <button
                      onClick={() => {
                        if (onReorder) {
                          onReorder(o);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-surface-darkCard hover:bg-blue-600 hover:text-white text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-surface-darkBorder hover:border-blue-600 text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                      title="Repeat / Reorder this exact trade"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>Reorder</span>
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}

      </div>

      {/* ========================================================================= */}
      {/* 3. ORDER MODIFICATION MODAL (Zerodha Kite Signature)                       */}
      {/* ========================================================================= */}
      {modifyingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder w-full max-w-md overflow-hidden shadow-2xl p-6 flex flex-col gap-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-surface-darkBorder">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-medium uppercase px-2 py-0.5 rounded text-white ${
                    modifyingOrder.side === 'BUY' ? 'bg-blue-600' : 'bg-orange-600'
                  }`}>
                    MODIFY {modifyingOrder.side}
                  </span>
                  <span className="font-semibold text-base text-gray-900 dark:text-white">
                    {modifyingOrder.symbol}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Order ID: #{modifyingOrder.id} &bull; Limit Trigger
                </div>
              </div>

              <button
                onClick={() => setModifyingOrder(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-darkHover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {modError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modError}</span>
              </div>
            )}

            <form onSubmit={handleSaveModification} className="space-y-4">
              
              {/* Quantity Input */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                  Quantity
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1, (parseFloat(modQty) || 0) - 1);
                      setModQty(next.toString());
                    }}
                    className="p-2.5 rounded-xl bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-surface-darkBorder transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    step="any"
                    value={modQty}
                    onChange={(e) => setModQty(e.target.value)}
                    required
                    className="w-full bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder rounded-xl px-3 py-2 text-center text-sm font-medium tabular-nums text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = (parseFloat(modQty) || 0) + 1;
                      setModQty(next.toString());
                    }}
                    className="p-2.5 rounded-xl bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-surface-darkBorder transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Limit Price Input */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                  Limit Price ($)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const step = parseFloat(modPrice) < 5 ? 0.05 : 0.5;
                      const next = Math.max(0.01, (parseFloat(modPrice) || 0) - step);
                      setModPrice(next.toFixed(next < 5 ? 4 : 2));
                    }}
                    className="p-2.5 rounded-xl bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-surface-darkBorder transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    step="any"
                    value={modPrice}
                    onChange={(e) => setModPrice(e.target.value)}
                    required
                    className="w-full bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder rounded-xl px-3 py-2 text-center text-sm font-medium tabular-nums text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const step = parseFloat(modPrice) < 5 ? 0.05 : 0.5;
                      const next = (parseFloat(modPrice) || 0) + step;
                      setModPrice(next.toFixed(next < 5 ? 4 : 2));
                    }}
                    className="p-2.5 rounded-xl bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-surface-darkBorder transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Cost Summary */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-100 dark:border-surface-darkBorder flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 uppercase font-medium">New Total Value:</span>
                <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                  ${((parseFloat(modQty) || 0) * (parseFloat(modPrice) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModifyingOrder(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-surface-darkBorder text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {modSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{modSubmitting ? 'Updating...' : 'Modify Order'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

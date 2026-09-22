import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  ShieldCheck, 
  Check, 
  Copy, 
  AlertCircle, 
  RotateCcw, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  RefreshCw, 
  Lock, 
  User, 
  ExternalLink,
  Filter
} from 'lucide-react';

export default function AdminPaymentsModal({ isOpen, onClose, user }) {
  const [orders, setOrders] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [filterTab, setFilterTab] = useState('pending'); // 'pending' | 'all' | 'completed' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUtr, setCopiedUtr] = useState(null);
  
  // Admin Key Management
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('zerotrade_admin_key') || 'zerobossadmin2026');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [rejectPromptId, setRejectPromptId] = useState(null);
  const [rejectReason, setRejectReason] = useState('UTR not found in bank statement / Fake reference');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('zerotrade_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (adminKey) headers['X-Admin-Key'] = adminKey;

      const res = await fetch('/api/billing/admin/orders', { headers });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setShowKeyInput(true);
          throw new Error('Admin authorization required. Please provide your Admin Passkey.');
        }
        throw new Error(data.detail || 'Failed to load payment orders.');
      }

      setOrders(data.orders || []);
      setPendingCount(data.pendingCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen, fetchOrders]);

  if (!isOpen) return null;

  const handleCopyUtr = (utr) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleApprove = async (orderId) => {
    if (!window.confirm(`Are you sure you verified this payment in your bank/UPI app and want to approve Order #${orderId}?`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [orderId]: 'approving' }));
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('zerotrade_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (adminKey) headers['X-Admin-Key'] = adminKey;

      const res = await fetch(`/api/billing/admin/orders/${orderId}/approve`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to approve payment.');
      }

      setSuccessMsg(`Order #${orderId} approved successfully! User balance credited.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: null }));
    }
  };

  const handleReject = async (orderId) => {
    setActionLoading(prev => ({ ...prev, [orderId]: 'rejecting' }));
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('zerotrade_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (adminKey) headers['X-Admin-Key'] = adminKey;

      const res = await fetch(`/api/billing/admin/orders/${orderId}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: rejectReason })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to reject payment.');
      }

      setSuccessMsg(`Order #${orderId} marked as REJECTED.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setRejectPromptId(null);
      fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: null }));
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (filterTab === 'pending' && order.status !== 'pending') return false;
    if (filterTab === 'completed' && order.status !== 'completed') return false;
    if (filterTab === 'rejected' && order.status !== 'rejected') return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const utrMatch = order.utr_ref?.toLowerCase().includes(query);
      const emailMatch = order.user_email?.toLowerCase().includes(query);
      const nameMatch = order.user_name?.toLowerCase().includes(query);
      const planMatch = order.plan_name?.toLowerCase().includes(query);
      return utrMatch || emailMatch || nameMatch || planMatch;
    }
    return true;
  });

  const totalCollected = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (Number(o.amount_inr) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-surface-darkPanel rounded-2xl shadow-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden z-10 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-surface-darkBorder bg-gray-50/80 dark:bg-surface-darkCard/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Payment Verification &amp; Approval Desk
                </h2>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                    {pendingCount} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Verify incoming ₹ UPI deposits against bank records and approve/reject with 1-click
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-surface-darkBorder hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-600 dark:text-gray-300 transition-colors"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-100/50 dark:bg-surface-darkCard/30 border-b border-gray-200 dark:border-surface-darkBorder">
          <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder">
            <div className="text-[10px] text-gray-400 uppercase font-semibold">Total Orders</div>
            <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{orders.length}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
            <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Pending Approval</div>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">{pendingCount}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Verified Completed</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {orders.filter(o => o.status === 'completed').length}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
            <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold">Total Revenue (INR)</div>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">₹{totalCollected.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Notifications & Alert Banner */}
        {error && (
          <div className="m-3 sm:m-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button 
              onClick={() => setShowKeyInput(true)} 
              className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
            >
              Enter Passkey
            </button>
          </div>
        )}

        {successMsg && (
          <div className="m-3 sm:m-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Admin Passkey Prompt */}
        {showKeyInput && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex-1">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>Enter Admin Passkey:</span>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value);
                  localStorage.setItem('zerotrade_admin_key', e.target.value);
                }}
                placeholder="zerobossadmin2026"
                className="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-surface-darkCard border border-indigo-200 dark:border-indigo-800 text-gray-900 dark:text-white font-mono"
              />
            </div>
            <button
              onClick={() => {
                setShowKeyInput(false);
                fetchOrders();
              }}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
            >
              Apply Key
            </button>
          </div>
        )}

        {/* Filters & Search Toolbar */}
        <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-surface-darkBorder flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-darkCard p-1 rounded-xl border border-gray-200 dark:border-surface-darkBorder w-full sm:w-auto">
            <button
              onClick={() => setFilterTab('pending')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                filterTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending ({pendingCount})</span>
            </button>

            <button
              onClick={() => setFilterTab('all')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                filterTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>All ({orders.length})</span>
            </button>

            <button
              onClick={() => setFilterTab('completed')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                filterTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed</span>
            </button>

            <button
              onClick={() => setFilterTab('rejected')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                filterTab === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search UTR, email, plan..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

        </div>

        {/* Orders List Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 flex flex-col gap-3">
          
          {loading && orders.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-xs">Loading payment orders...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2 text-center">
              <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {filterTab === 'pending' ? 'No pending payments waiting for approval.' : 'No orders found.'}
              </div>
              <p className="text-xs text-gray-400 max-w-xs">
                When users pay via UPI QR and enter their 12-digit UTR, their verification request will show up here.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isPending = order.status === 'pending';
              const isCompleted = order.status === 'completed';
              const isRejected = order.status === 'rejected';
              const isApproving = actionLoading[order.id] === 'approving';
              const isRejecting = actionLoading[order.id] === 'rejecting';

              return (
                <div
                  key={order.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                    isPending
                      ? 'border-amber-300 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/10 shadow-xs'
                      : isCompleted
                      ? 'border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-surface-darkCard/40'
                      : 'border-rose-200 dark:border-rose-900/40 bg-gray-50/50 dark:bg-surface-darkCard/20 opacity-80'
                  }`}
                >
                  {/* Top Line: User Info & Status */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                        {order.user_name ? order.user_name[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>{order.user_name || 'Anonymous User'}</span>
                          <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400 font-mono">
                            ({order.user_email})
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Submitted: {order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : 'Recent'} &bull; Current Cash: ${Number(order.current_virtual_cash || 0).toLocaleString('en-US')}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPending && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>PENDING VERIFICATION</span>
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>APPROVED &amp; CREDITED</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          <span>REJECTED</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle Info: Plan + Amount + UTR Reference Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white dark:bg-surface-darkCard p-3 rounded-xl border border-gray-100 dark:border-surface-darkBorder text-xs">
                    
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium block">Package</span>
                      <span className="font-bold text-gray-900 dark:text-white">{order.plan_name}</span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-semibold">
                        +${(order.virtual_cash_granted || (order.plan_id === 'tier_100k' ? 100000 : order.plan_id === 'tier_25k' ? 25000 : 10000)).toLocaleString('en-US')} Capital
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium block">Amount Received</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">₹{order.amount_inr}.00</span>
                      <span className="text-[10px] text-gray-400 block">via {order.upi_id || 'UPI'}</span>
                    </div>

                    {/* Prominent UTR Reference with 1-Click Copy */}
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium block">12-Digit Bank UTR</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/60 select-all">
                          {order.utr_ref || 'NO_UTR'}
                        </span>
                        <button
                          onClick={() => handleCopyUtr(order.utr_ref)}
                          className="p-1 rounded bg-gray-100 dark:bg-surface-darkBorder hover:bg-blue-600 hover:text-white text-gray-600 dark:text-gray-300 transition-colors"
                          title="Copy UTR to check in GPay/PhonePe"
                        >
                          {copiedUtr === order.utr_ref ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Notes & Actions */}
                  {order.admin_notes && (
                    <div className="text-[11px] text-gray-500 italic bg-gray-50 dark:bg-surface-darkCard/50 px-2.5 py-1 rounded-lg">
                      Note: {order.admin_notes}
                    </div>
                  )}

                  {/* Reject Prompt Drawer if triggered */}
                  {rejectPromptId === order.id && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 flex flex-col gap-2">
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                        Reason for Rejecting Order #{order.id}:
                      </span>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. UTR not in ICICI statement / Amount mismatch"
                        className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkCard border border-rose-300 text-gray-900 dark:text-white"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setRejectPromptId(null)}
                          className="px-3 py-1 text-xs text-gray-600 dark:text-gray-300 hover:underline"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleReject(order.id)}
                          disabled={isRejecting}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons for Pending Orders */}
                  {isPending && rejectPromptId !== order.id && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => {
                          setRejectPromptId(order.id);
                          setRejectReason('UTR not found in bank statement / Fake reference');
                        }}
                        disabled={isRejecting || isApproving}
                        className="px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject (Fake UTR)</span>
                      </button>

                      <button
                        onClick={() => handleApprove(order.id)}
                        disabled={isApproving || isRejecting}
                        className={`px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center gap-1.5 ${
                          isApproving ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                      >
                        {isApproving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Crediting Capital...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Approve &amp; Credit Balance</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                </div>
              );
            })
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 dark:bg-surface-darkCard/80 border-t border-gray-200 dark:border-surface-darkBorder flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>ZeroVega Internal Merchant Admin &bull; Real-time Bank Reconciliation</span>
          </div>

          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <Lock className="w-3 h-3" />
            <span>Admin Passkey</span>
          </button>
        </div>

      </div>

    </div>
  );
}

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
  Filter,
  Users,
  CreditCard,
  Activity,
  BarChart3,
  Sparkles,
  Zap,
  TrendingUp,
  Edit,
  Trash2
} from 'lucide-react';

export default function AdminPaymentsModal({ isOpen, onClose, user }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'payments' | 'positions' | 'stats'
  
  // Stats State
  const [stats, setStats] = useState(null);

  // Users State
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('all'); // 'all' | 'paid' | 'free' | 'admin'
  const [selectedUserForAction, setSelectedUserForAction] = useState(null);
  const [grantPlanId, setGrantPlanId] = useState('reset_10k');
  const [grantDays, setGrantDays] = useState(30);
  const [grantCash, setGrantCash] = useState(10000);
  const [customCashAmount, setCustomCashAmount] = useState('');

  // Orders State
  const [orders, setOrders] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [filterTab, setFilterTab] = useState('pending'); // 'pending' | 'all' | 'completed' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUtr, setCopiedUtr] = useState(null);
  const [rejectPromptId, setRejectPromptId] = useState(null);
  const [rejectReason, setRejectReason] = useState('UTR not found in bank statement / Fake reference');

  // Positions State
  const [positions, setPositions] = useState([]);

  // General State
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  // Admin Key Management
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('zerotrade_admin_key') || 'zerobossadmin2026');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('zerotrade_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (adminKey) headers['X-Admin-Key'] = adminKey;
    return headers;
  }, [adminKey]);

  // 1. Fetch Overview Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      // ignore
    }
  }, [getHeaders]);

  // 2. Fetch Users List
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/users?${userSearch ? `search=${encodeURIComponent(userSearch)}&` : ''}${userPlanFilter !== 'all' ? `plan_filter=${userPlanFilter}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setUsersList(data.users || []);
      } else {
        if (res.status === 403) setShowKeyInput(true);
        throw new Error(data.detail || 'Failed to fetch users');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getHeaders, userSearch, userPlanFilter]);

  // 3. Fetch Payment Orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/admin/orders', { headers: getHeaders() });
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
  }, [getHeaders]);

  // 4. Fetch Active Positions
  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/positions', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setPositions(data.positions || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  // Refresh current active tab
  const refreshActiveData = useCallback(() => {
    fetchStats();
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'payments') fetchOrders();
    else if (activeTab === 'positions') fetchPositions();
  }, [activeTab, fetchStats, fetchUsers, fetchOrders, fetchPositions]);

  useEffect(() => {
    if (isOpen) {
      refreshActiveData();
    }
  }, [isOpen, activeTab, refreshActiveData]);

  if (!isOpen) return null;

  const showToastMsg = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Admin Actions on Users
  const handleGrantPlan = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: 'granting' }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/grant-plan`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          plan_id: grantPlanId,
          custom_days: grantPlanId === 'free' ? null : grantDays,
          override_cash: grantPlanId === 'free' ? 2000 : grantCash
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to grant plan');
      showToastMsg(data.message || 'Plan granted successfully');
      setSelectedUserForAction(null);
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleAdjustCash = async (userId) => {
    const amount = parseFloat(customCashAmount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid cash amount');
      return;
    }
    setActionLoading(prev => ({ ...prev, [userId]: 'cash' }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/adjust-cash`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ virtual_cash: amount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to adjust cash');
      showToastMsg(data.message || 'Cash updated');
      setSelectedUserForAction(null);
      setCustomCashAmount('');
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleToggleAdmin = async (userId) => {
    if (!window.confirm(`Are you sure you want to toggle Admin privileges for User #${userId}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-admin`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to toggle admin');
      showToastMsg(data.message);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetUserPortfolio = async (userId) => {
    if (!window.confirm(`Are you sure you want to wipe all open positions/orders and reset User #${userId}'s balance?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-portfolio`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to reset portfolio');
      showToastMsg(data.message);
      fetchUsers();
      fetchPositions();
    } catch (err) {
      setError(err.message);
    }
  };

  // Position Actions
  const handleForceClosePosition = async (posId, sym) => {
    if (!window.confirm(`Are you sure you want to FORCE-CLOSE position #${posId} (${sym}) at current market price?`)) return;
    try {
      const res = await fetch(`/api/admin/positions/${posId}/force-close`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to force-close position');
      showToastMsg(data.message);
      fetchPositions();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  // Payment Approvals
  const handleApprove = async (orderId) => {
    if (!window.confirm(`Are you sure you verified this payment in your bank/UPI app and want to approve Order #${orderId}?`)) return;

    setActionLoading(prev => ({ ...prev, [orderId]: 'approving' }));
    try {
      const res = await fetch(`/api/billing/admin/orders/${orderId}/approve`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to approve payment.');
      showToastMsg(`Order #${orderId} approved successfully! User balance credited.`);
      fetchOrders();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: null }));
    }
  };

  const handleReject = async (orderId) => {
    setActionLoading(prev => ({ ...prev, [orderId]: 'rejecting' }));
    try {
      const res = await fetch(`/api/billing/admin/orders/${orderId}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: rejectReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to reject payment.');
      showToastMsg(`Order #${orderId} marked as REJECTED.`);
      setRejectPromptId(null);
      fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: null }));
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filterTab === 'pending' && order.status !== 'pending') return false;
    if (filterTab === 'completed' && order.status !== 'completed') return false;
    if (filterTab === 'rejected' && order.status !== 'rejected') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchUtr = order.utr_ref?.toLowerCase().includes(q);
      const matchEmail = order.user_email?.toLowerCase().includes(q);
      const matchName = order.user_name?.toLowerCase().includes(q);
      return matchUtr || matchEmail || matchName;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Window */}
      <div className="relative w-full max-w-5xl bg-white dark:bg-surface-darkPanel rounded-2xl shadow-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden z-10 max-h-[94vh] flex flex-col">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-surface-darkBorder bg-gray-50 dark:bg-surface-darkCard/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Master Admin Control Desk
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  PLATFORM ROOT
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                User database, plan management, UPI bank approvals &amp; exchange risk monitor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshActiveData}
              className="p-2 rounded-xl border border-gray-200 dark:border-surface-darkBorder hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-600 dark:text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Alert Notices */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {successMsg && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Key Metrics Quick Ribbon */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-4 py-3 bg-gray-100/60 dark:bg-surface-darkCard/40 border-b border-gray-100 dark:border-surface-darkBorder text-xs select-none">
            <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-gray-200/60 dark:border-surface-darkBorder/60">
              <span className="text-[10px] text-gray-400 uppercase font-medium block">Total Users</span>
              <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{stats.totalUsers} Traders</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-gray-200/60 dark:border-surface-darkBorder/60">
              <span className="text-[10px] text-blue-500 uppercase font-medium block">Paid Subscribers</span>
              <span className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">{stats.paidUsers} Active</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-gray-200/60 dark:border-surface-darkBorder/60">
              <span className="text-[10px] text-emerald-500 uppercase font-medium block">Total Revenue</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">₹{stats.totalRevenueInr.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-gray-200/60 dark:border-surface-darkBorder/60">
              <span className="text-[10px] text-amber-500 uppercase font-medium block">Pending Deposits</span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">{stats.pendingOrders} Orders</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-gray-200/60 dark:border-surface-darkBorder/60 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-purple-500 uppercase font-medium block">Open Positions</span>
              <span className="text-base font-bold text-purple-600 dark:text-purple-400 tabular-nums">{stats.openPositions} Active</span>
            </div>
          </div>
        )}

        {/* Navigation Tabs Header */}
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-gray-100 dark:border-surface-darkBorder overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Registered Users &amp; Plans ({usersList.length || stats?.totalUsers || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'payments'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>UPI Approvals Desk</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('positions')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'positions'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Live Risk &amp; Open Positions ({positions.length})</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: REGISTERED USERS & PLANS MANAGER                                    */}
        {/* ========================================================================= */}
        {activeTab === 'users' && (
          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user by email, name, or ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-darkCard p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                {['all', 'paid', 'free', 'admin'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setUserPlanFilter(filter)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                      userPlanFilter === filter
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden">
              <div className="overflow-x-auto max-h-[50vh]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-surface-darkCard sticky top-0 border-b border-gray-200 dark:border-surface-darkBorder text-gray-500 font-semibold select-none">
                    <tr>
                      <th className="p-3">User ID &amp; Trader</th>
                      <th className="p-3">Active Plan &amp; Expiry</th>
                      <th className="p-3">Cash / Equity</th>
                      <th className="p-3">Max Leverage</th>
                      <th className="p-3">Trades / P&amp;L</th>
                      <th className="p-3 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder">
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 text-xs">
                          {loading ? 'Loading user directory...' : 'No users found matching query.'}
                        </td>
                      </tr>
                    ) : (
                      usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/70 dark:hover:bg-surface-darkHover/40 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.displayName}</span>
                              {u.isAdmin && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              ZT-{u.id.toString().padStart(6, '0')} &bull; {u.email}
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.isPaidPlan
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50'
                              }`}>
                                {u.planName || (u.isPaidPlan ? 'Pro Plan' : 'Free Basic')}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {u.isPaidPlan && u.daysLeft !== null
                                ? `${u.daysLeft} days remaining`
                                : u.isPaidPlan ? 'Active Paid' : 'Non-expiring basic'}
                            </div>
                          </td>

                          <td className="p-3 font-semibold text-gray-900 dark:text-white tabular-nums">
                            ${u.virtualCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="p-3">
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {u.maxLeverage}x
                            </span>
                          </td>

                          <td className="p-3">
                            <div className="text-gray-700 dark:text-gray-300">
                              {u.ordersCount} orders &bull; {u.positionsCount} open
                            </div>
                            <div className={`text-[10px] font-medium tabular-nums ${u.totalPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {u.totalPnl >= 0 ? '+' : ''}${u.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })} Realized
                            </div>
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedUserForAction(u)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-200 dark:border-blue-900/40 cursor-pointer"
                                title="Grant Plan / Adjust Capital"
                              >
                                Edit / Grant
                              </button>
                              <button
                                onClick={() => handleToggleAdmin(u.id)}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-400 hover:text-purple-500 cursor-pointer"
                                title="Toggle Admin"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleResetUserPortfolio(u.id)}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-400 hover:text-rose-500 cursor-pointer"
                                title="Wipe Portfolio & Reset"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick User Action Drawer / Modal */}
            {selectedUserForAction && (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span>Manage User #{selectedUserForAction.id} ({selectedUserForAction.email})</span>
                  </div>
                  <button onClick={() => setSelectedUserForAction(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left: Grant Plan */}
                  <div className="p-3 rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder space-y-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">Direct Plan Grant</span>
                    
                    <select
                      value={grantPlanId}
                      onChange={(e) => {
                        setGrantPlanId(e.target.value);
                        if (e.target.value === 'reset_10k') { setGrantDays(30); setGrantCash(10000); }
                        else if (e.target.value === 'tier_20k') { setGrantDays(60); setGrantCash(20000); }
                        else if (e.target.value === 'tier_25k') { setGrantDays(180); setGrantCash(25000); }
                        else if (e.target.value === 'free') { setGrantDays(0); setGrantCash(2000); }
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white"
                    >
                      <option value="reset_10k">Starter Trader ($10,000 / 30 Days)</option>
                      <option value="tier_20k">Pro Trader ($20,000 / 60 Days)</option>
                      <option value="tier_25k">Elite Master ($25,000 / 180 Days)</option>
                      <option value="free">Revert to Free Basic ($2,000 / 2x Max)</option>
                    </select>

                    {grantPlanId !== 'free' && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-gray-400">Validity (Days)</label>
                          <input
                            type="number"
                            value={grantDays}
                            onChange={(e) => setGrantDays(parseInt(e.target.value) || 30)}
                            className="w-full px-2 py-1 text-xs rounded bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400">Virtual Cash ($)</label>
                          <input
                            type="number"
                            value={grantCash}
                            onChange={(e) => setGrantCash(parseFloat(e.target.value) || 10000)}
                            className="w-full px-2 py-1 text-xs rounded bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleGrantPlan(selectedUserForAction.id)}
                      disabled={actionLoading[selectedUserForAction.id] === 'granting'}
                      className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {actionLoading[selectedUserForAction.id] === 'granting' ? 'Applying Plan...' : 'Grant Plan to User'}
                    </button>
                  </div>

                  {/* Right: Direct Balance Adjustment */}
                  <div className="p-3 rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder space-y-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">Manual Cash Balance Set</span>
                    
                    <input
                      type="number"
                      value={customCashAmount}
                      onChange={(e) => setCustomCashAmount(e.target.value)}
                      placeholder={`Current: $${selectedUserForAction.virtualCash.toLocaleString('en-US')}`}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white"
                    />

                    <button
                      onClick={() => handleAdjustCash(selectedUserForAction.id)}
                      disabled={actionLoading[selectedUserForAction.id] === 'cash'}
                      className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {actionLoading[selectedUserForAction.id] === 'cash' ? 'Updating...' : 'Set User Cash Balance'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: UPI PAYMENT APPROVALS DESK                                          */}
        {/* ========================================================================= */}
        {activeTab === 'payments' && (
          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
            
            {/* Search and Tabs */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 12-digit UTR, email, trader name..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-darkCard p-1 rounded-xl w-full sm:w-auto">
                <button
                  onClick={() => setFilterTab('pending')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterTab === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Pending ({pendingCount})</span>
                </button>
                <button
                  onClick={() => setFilterTab('completed')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterTab === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Approved</span>
                </button>
                <button
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    filterTab === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All ({orders.length})
                </button>
              </div>
            </div>

            {/* Orders Cards List */}
            <div className="space-y-3 max-h-[52vh] overflow-y-auto">
              {filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No payment orders found in this category.
                </div>
              ) : (
                filteredOrders.map((ord) => {
                  const isPending = ord.status === 'pending';
                  const isCompleted = ord.status === 'completed';
                  const isRejected = ord.status === 'rejected';

                  return (
                    <div 
                      key={ord.id}
                      className={`p-4 rounded-xl border text-xs flex flex-col gap-3 transition-all ${
                        isPending 
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 shadow-xs'
                          : isCompleted 
                          ? 'bg-white dark:bg-surface-darkCard/70 border-gray-200 dark:border-surface-darkBorder'
                          : 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 opacity-75'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">
                            Order #{ord.id}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isPending 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                              : isCompleted 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                          }`}>
                            {ord.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {ord.created_at ? new Date(ord.created_at).toLocaleString() : ''}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-gray-50/70 dark:bg-surface-darkCard p-3 rounded-xl border border-gray-100 dark:border-surface-darkBorder text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-medium block">User</span>
                          <span className="font-bold text-gray-900 dark:text-white">{ord.user_name || 'Trader'}</span>
                          <span className="text-[11px] text-gray-500 block">{ord.user_email}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-medium block">Package</span>
                          <span className="font-bold text-gray-900 dark:text-white">{ord.plan_name}</span>
                          <span className="text-emerald-600 font-bold block">₹{ord.amount_inr} INR</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-medium block">Bank UTR</span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm select-all">
                            {ord.utr_ref}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons for Pending */}
                      {isPending && (
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-surface-darkBorder">
                          <button
                            onClick={() => setRejectPromptId(ord.id)}
                            disabled={actionLoading[ord.id] === 'rejecting'}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                          >
                            Reject Fake UTR
                          </button>
                          <button
                            onClick={() => handleApprove(ord.id)}
                            disabled={actionLoading[ord.id] === 'approving'}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                          >
                            {actionLoading[ord.id] === 'approving' ? 'Approving...' : 'Approve & Credit Capital'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LIVE RISK & OPEN POSITIONS MONITOR                                 */}
        {/* ========================================================================= */}
        {activeTab === 'positions' && (
          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>All open derivative and margin contracts actively running across trader desks.</span>
              <span className="font-bold text-gray-900 dark:text-white">{positions.length} Open Positions</span>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden">
              <div className="overflow-x-auto max-h-[50vh]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-surface-darkCard sticky top-0 border-b border-gray-200 dark:border-surface-darkBorder text-gray-500 font-semibold select-none">
                    <tr>
                      <th className="p-3">Trader Email</th>
                      <th className="p-3">Symbol &amp; Asset</th>
                      <th className="p-3">Side &amp; Qty</th>
                      <th className="p-3">Entry &rarr; Live Mark</th>
                      <th className="p-3">Leverage / Margin</th>
                      <th className="p-3">Unrealized P&amp;L</th>
                      <th className="p-3 text-right">Force Close</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder">
                    {positions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 text-xs">
                          No open positions currently active on the exchange.
                        </td>
                      </tr>
                    ) : (
                      positions.map((pos) => (
                        <tr key={pos.id} className="hover:bg-gray-50/70 dark:hover:bg-surface-darkHover/40 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-gray-900 dark:text-white">{pos.userName}</div>
                            <div className="text-[11px] text-gray-400">{pos.userEmail}</div>
                          </td>
                          <td className="p-3 font-semibold text-gray-900 dark:text-white">
                            {pos.symbol}
                            <span className="text-[10px] text-gray-400 block">{pos.assetClass?.toUpperCase()}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pos.side === 'LONG' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400'
                            }`}>
                              {pos.side} {pos.quantity}
                            </span>
                          </td>
                          <td className="p-3 tabular-nums">
                            <div>Entry: ${pos.avgEntryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            <div className="text-gray-400 text-[10px]">Mark: ${pos.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-blue-600">{pos.leverage}x</span>
                            <span className="text-[10px] text-gray-400 block">${pos.marginUsed} Margin</span>
                          </td>
                          <td className={`p-3 font-bold tabular-nums ${pos.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleForceClosePosition(pos.id, pos.symbol)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-900/40 cursor-pointer"
                            >
                              Force Close
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

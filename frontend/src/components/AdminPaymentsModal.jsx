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
  Trash2,
  Ban,
  Megaphone,
  Percent,
  Layers,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  History,
  Sliders,
  CheckSquare,
  FileText
} from 'lucide-react';

export default function AdminPaymentsModal({ isOpen, onClose, user }) {
  // Tabs: 'users' | 'payments' | 'positions' | 'leverage' | 'coupons' | 'plans' | 'announcements' | 'audit'
  const [activeTab, setActiveTab] = useState('users');
  
  // Stats State
  const [stats, setStats] = useState(null);

  // Users State
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('all'); // 'all' | 'paid' | 'free' | 'admin' | 'banned'
  const [usersPage, setUsersPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(15);
  const [selectedUserForAction, setSelectedUserForAction] = useState(null);
  const [grantPlanId, setGrantPlanId] = useState('reset_10k');
  const [grantDays, setGrantDays] = useState(30);
  const [grantCash, setGrantCash] = useState(10000);
  const [customCashAmount, setCustomCashAmount] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('Terms violation or excessive risk');

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

  // Leverage Overrides State
  const [leverageOverrides, setLeverageOverrides] = useState([]);
  const [newSymOverride, setNewSymOverride] = useState({ symbol: '', max_leverage: 10, is_trading_disabled: false, notes: '' });

  // Coupons State
  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({ code: '', discount_percent: 20, discount_amount_inr: 0, max_uses: 100, plan_id: '' });

  // Plans Editor State
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);

  // Announcements State
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ message: '', announcement_type: 'info', is_active: true });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');

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
      if (res.ok) {
        setOrders(data.orders || []);
        setPendingCount(data.pendingCount || 0);
      } else {
        if (res.status === 403) setShowKeyInput(true);
        throw new Error(data.detail || 'Failed to load payment orders.');
      }
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

  // 5. Fetch Leverage Overrides
  const fetchLeverageOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/leverage-overrides', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setLeverageOverrides(data.overrides || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  // 6. Fetch Coupons
  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coupons', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setCoupons(data.coupons || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  // 7. Fetch Plans
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/plans', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setPlans(data.plans || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  // 8. Fetch Announcements
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/announcements', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setAnnouncements(data.announcements || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  // 9. Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/audit-logs?${auditSearch ? `search=${encodeURIComponent(auditSearch)}&` : ''}limit=100`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setAuditLogs(data.logs || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getHeaders, auditSearch]);

  // Refresh current active tab
  const refreshActiveTab = useCallback(() => {
    fetchStats();
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'payments') fetchOrders();
    else if (activeTab === 'positions') fetchPositions();
    else if (activeTab === 'leverage') fetchLeverageOverrides();
    else if (activeTab === 'coupons') fetchCoupons();
    else if (activeTab === 'plans') fetchPlans();
    else if (activeTab === 'announcements') fetchAnnouncements();
    else if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab, fetchStats, fetchUsers, fetchOrders, fetchPositions, fetchLeverageOverrides, fetchCoupons, fetchPlans, fetchAnnouncements, fetchAuditLogs]);

  useEffect(() => {
    if (isOpen) {
      refreshActiveTab();
    }
  }, [isOpen, activeTab, refreshActiveTab]);

  // Flash message helper
  const showToast = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // =========================================================================
  // ACTIONS: Users
  // =========================================================================

  const handleGrantPlan = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/grant-plan`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          plan_id: grantPlanId,
          custom_days: Number(grantDays),
          override_cash: Number(grantCash)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to grant plan');
      showToast(data.message || 'Plan granted successfully!');
      setSelectedUserForAction(null);
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleAdjustCash = async (userId) => {
    if (!customCashAmount || isNaN(customCashAmount)) return;
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/adjust-cash`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ virtual_cash: parseFloat(customCashAmount) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to adjust cash');
      showToast(data.message || 'Balance updated!');
      setCustomCashAmount('');
      setSelectedUserForAction(null);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleToggleBan = async (userId, currentBanned) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-ban`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          is_banned: !currentBanned,
          reason: banReasonInput || 'Violated terms of platform'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to toggle ban');
      showToast(data.message || 'Ban status updated!');
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleToggleAdmin = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-admin`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to toggle admin status');
      showToast(data.message || 'Admin status changed');
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleResetPortfolio = async (userId) => {
    if (!window.confirm(`Are you sure you want to wipe open positions and reset User #${userId}'s account?`)) return;
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-portfolio`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to reset portfolio');
      showToast(data.message || 'User portfolio wiped clean');
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  // =========================================================================
  // ACTIONS: Payments
  // =========================================================================

  const handleApproveOrder = async (orderId) => {
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch(`/api/billing/admin/orders/${orderId}/approve`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Approval failed');
      showToast(data.message || 'Order approved & credited!');
      fetchOrders();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleRejectOrder = async (orderId) => {
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch(`/api/billing/admin/orders/${orderId}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: rejectReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Rejection failed');
      showToast(`Order #${orderId} marked as rejected.`);
      setRejectPromptId(null);
      fetchOrders();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // =========================================================================
  // ACTIONS: Positions Risk Force-Close
  // =========================================================================

  const handleForceClose = async (positionId, symbol) => {
    if (!window.confirm(`Emergency Risk Action: Force close position #${positionId} (${symbol}) at market price?`)) return;
    setActionLoading(prev => ({ ...prev, [`pos_${positionId}`]: true }));
    try {
      const res = await fetch(`/api/admin/positions/${positionId}/force-close`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ position_id: positionId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Force close failed');
      showToast(data.message || 'Position force-closed.');
      fetchPositions();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`pos_${positionId}`]: false }));
    }
  };

  // =========================================================================
  // ACTIONS: Leverage Overrides
  // =========================================================================

  const handleSaveLeverageOverride = async (e) => {
    e.preventDefault();
    if (!newSymOverride.symbol.trim()) return;
    try {
      const res = await fetch('/api/admin/leverage-overrides', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newSymOverride)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to set override');
      showToast(data.message || 'Leverage override saved!');
      setNewSymOverride({ symbol: '', max_leverage: 10, is_trading_disabled: false, notes: '' });
      fetchLeverageOverrides();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteLeverageOverride = async (sym) => {
    try {
      const res = await fetch(`/api/admin/leverage-overrides/${encodeURIComponent(sym)}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete override');
      showToast(data.message || 'Override removed');
      fetchLeverageOverrides();
    } catch (err) {
      setError(err.message);
    }
  };

  // =========================================================================
  // ACTIONS: Coupons
  // =========================================================================

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!newCoupon.code.trim()) return;
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newCoupon)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create coupon');
      showToast(data.message || 'Coupon created!');
      setNewCoupon({ code: '', discount_percent: 20, discount_amount_inr: 0, max_uses: 100, plan_id: '' });
      fetchCoupons();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleCoupon = async (couponId) => {
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}/toggle`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to toggle coupon');
      showToast(data.message);
      fetchCoupons();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteCoupon = async (couponId) => {
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      showToast('Coupon removed');
      fetchCoupons();
    } catch (err) {
      setError(err.message);
    }
  };

  // =========================================================================
  // ACTIONS: Plans Editor
  // =========================================================================

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!editingPlan || !editingPlan.id) return;
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(editingPlan)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save plan');
      showToast(data.message || 'Plan saved!');
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      setError(err.message);
    }
  };

  // =========================================================================
  // ACTIONS: Announcements
  // =========================================================================

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.message.trim()) return;
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newAnnouncement)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to post announcement');
      showToast(data.message || 'Broadcast published!');
      setNewAnnouncement({ message: '', announcement_type: 'info', is_active: true });
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleAnnouncement = async (annId) => {
    try {
      const res = await fetch(`/api/admin/announcements/${annId}/toggle`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      showToast(data.message);
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAnnouncement = async (annId) => {
    try {
      const res = await fetch(`/api/admin/announcements/${annId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      showToast('Announcement deleted');
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  };

  // =========================================================================
  // CSV Data Export Downloader
  // =========================================================================

  const handleExportCsv = (reportType) => {
    const token = localStorage.getItem('zerotrade_token');
    const url = `/api/admin/export/${reportType}`;
    
    // Trigger download with auth headers via fetch blob
    fetch(url, { headers: getHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Failed to export CSV report');
        return res.blob();
      })
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `zerotrade_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast(`Exported ${reportType.toUpperCase()} CSV report!`);
      })
      .catch(err => setError(err.message));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative w-full max-w-7xl bg-white dark:bg-surface-darkPanel rounded-2xl shadow-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden z-10 max-h-[94vh] flex flex-col">
        
        {/* ========================================================================= */}
        {/* TOP HEADER & ADMIN STATS RIBBON                                           */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-surface-darkBorder bg-gray-50/90 dark:bg-surface-darkCard flex flex-col gap-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                    ZeroVega Master Admin Control Desk
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    GOD MODE
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Full platform authority: User directory, UPI approvals, real-time risk, announcements, leverage caps &amp; pricing.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshActiveTab}
                className="p-2 rounded-xl border border-gray-200 dark:border-surface-darkBorder hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-600 dark:text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Refresh All Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="p-2 rounded-xl border border-gray-200 dark:border-surface-darkBorder hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-600 dark:text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Admin Passkey Config"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Total Users</span>
                <span className="text-base font-black text-gray-900 dark:text-white">{stats.totalUsers}</span>
                <span className="text-[10px] text-gray-400 block">{stats.realUsers} verified</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">Paid Subscribers</span>
                <span className="text-base font-black text-blue-600 dark:text-blue-400">{stats.paidUsers}</span>
                <span className="text-[10px] text-gray-400 block">{stats.freeUsers} on free tier</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">Platform Revenue</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">₹{stats.totalRevenueInr.toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-gray-400 block">INR Verified</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">Pending Deposits</span>
                <span className="text-base font-black text-amber-500">{stats.pendingOrders}</span>
                <span className="text-[10px] text-gray-400 block">Awaiting UTR check</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 block">Open Positions</span>
                <span className="text-base font-black text-purple-500">{stats.openPositions}</span>
                <span className="text-[10px] text-gray-400 block">${stats.totalNotionalExposure.toLocaleString('en-US', { maximumFractionDigits: 0 })} notional</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">Frozen Accounts</span>
                <span className="text-base font-black text-rose-500">{stats.bannedUsers || 0}</span>
                <span className="text-[10px] text-gray-400 block">{stats.totalOrders} total fills</span>
              </div>
            </div>
          )}

          {/* Passkey Input Drawer (if needed) */}
          {showKeyInput && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 animate-in fade-in duration-150">
              <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <input
                type="password"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value);
                  localStorage.setItem('zerotrade_admin_key', e.target.value);
                }}
                placeholder="Enter Admin Secret Passkey"
                className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white"
              />
              <button
                onClick={() => {
                  setShowKeyInput(false);
                  refreshActiveTab();
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              >
                Save Key
              </button>
            </div>
          )}

          {/* Toast / Status Notifications */}
          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-xs hover:underline">Dismiss</button>
            </div>
          )}

          {/* 8-Tab Navigation Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-gray-200/50 dark:border-surface-darkBorder/50 pt-2 select-none">
            {[
              { id: 'users', label: 'Registered Users', icon: Users, badge: stats?.totalUsers },
              { id: 'payments', label: 'UPI Approvals', icon: CreditCard, badge: pendingCount, badgeColor: 'bg-amber-500 text-white' },
              { id: 'positions', label: 'Live Risk & Force-Close', icon: Activity, badge: positions.length },
              { id: 'leverage', label: 'Symbol Risk Caps', icon: Sliders },
              { id: 'coupons', label: 'Coupons & Promos', icon: Percent },
              { id: 'plans', label: 'Monetization Plans', icon: Layers },
              { id: 'announcements', label: 'Announcements', icon: Megaphone },
              { id: 'audit', label: 'Audit Trail', icon: History }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setError(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white dark:bg-surface-darkCard text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-darkHover border border-gray-200 dark:border-surface-darkBorder'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      tab.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-surface-darkBorder text-gray-700 dark:text-gray-200')
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>

        {/* ========================================================================= */}
        {/* TAB 1: USERS & PLANS DIRECTORY                                            */}
        {/* ========================================================================= */}
        {activeTab === 'users' && (() => {
          const totalUsersCount = usersList.length;
          const totalUserPages = usersPerPage === 'all' ? 1 : Math.max(1, Math.ceil(totalUsersCount / usersPerPage));
          const currentUserPage = Math.min(usersPage, totalUserPages);
          const displayedUsers = usersPerPage === 'all'
            ? usersList
            : usersList.slice((currentUserPage - 1) * usersPerPage, currentUserPage * usersPerPage);

          return (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
              
              {/* Search, Filters & Export Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setUsersPage(1);
                      }}
                      placeholder="Search by email, name, or User ID..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setUsersPage(1);
                      fetchUsers();
                    }}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                  >
                    Search
                  </button>
                  <span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-surface-darkCard px-2.5 py-2 rounded-xl border border-gray-200 dark:border-surface-darkBorder">
                    {totalUsersCount} Traders
                  </span>
                </div>

                {/* Plan Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {[
                    { id: 'all', label: 'All Users' },
                    { id: 'paid', label: 'Paid Plans' },
                    { id: 'free', label: 'Free Basic' },
                    { id: 'banned', label: 'Frozen / Banned' },
                    { id: 'admin', label: 'Admins' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setUserPlanFilter(f.id);
                        setUsersPage(1);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        userPlanFilter === f.id
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-surface-darkCard text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}

                  {/* 1-Click Export CSV */}
                  <button
                    onClick={() => handleExportCsv('users')}
                    className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 transition-colors"
                    title="Export complete users database to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Users CSV</span>
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden bg-white dark:bg-surface-darkPanel shadow-xs flex flex-col">
                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-surface-darkCard border-b border-gray-200 dark:border-surface-darkBorder text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-xs">
                      <tr>
                        <th className="p-3">User &amp; Profile</th>
                        <th className="p-3">Active Plan</th>
                        <th className="p-3">Validity / Days Left</th>
                        <th className="p-3">Cash Balance</th>
                        <th className="p-3">Max Lev</th>
                        <th className="p-3">Trades / P&amp;L</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder font-mono">
                      {displayedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-gray-400 font-sans">
                            No users matching this search or filter.
                          </td>
                        </tr>
                      ) : (
                        displayedUsers.map((u) => {
                          const isActionLoading = actionLoading[u.id];
                          return (
                            <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-surface-darkCard/40 transition-colors">
                              
                              {/* User & Email */}
                              <td className="p-3 font-sans">
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                                    u.isAdmin ? 'bg-amber-500 text-white' : (u.isBanned ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white')
                                  }`}>
                                    {u.displayName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                      <span>{u.displayName}</span>
                                      {u.isAdmin && <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-500 font-bold">ADMIN</span>}
                                      {u.isBanned && <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-500 font-bold">FROZEN</span>}
                                    </div>
                                    <div className="text-[11px] text-gray-400 font-mono">#{u.id} • {u.email}</div>
                                  </div>
                                </div>
                              </td>

                              {/* Plan Badge */}
                              <td className="p-3 font-sans">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  u.isPaidPlan 
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-gray-100 dark:bg-surface-darkBorder text-gray-600 dark:text-gray-400'
                                }`}>
                                  {u.planName}
                                </span>
                              </td>

                              {/* Validity / Expiry */}
                              <td className="p-3 text-[11px]">
                                {u.isPaidPlan ? (
                                  <div>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                      {u.daysLeft !== null ? `${u.daysLeft} Days left` : 'Active'}
                                    </span>
                                    <span className="block text-[10px] text-gray-400">
                                      {u.planExpiresAt ? u.planExpiresAt.slice(0, 10) : 'Lifetime'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">Lifetime Basic</span>
                                )}
                              </td>

                              {/* Balance */}
                              <td className="p-3 font-bold text-gray-900 dark:text-white">
                                ${u.virtualCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>

                              {/* Max Leverage */}
                              <td className="p-3">
                                <span className="font-bold text-indigo-500">{u.maxLeverage}x</span>
                              </td>

                              {/* Volume & P&L */}
                              <td className="p-3">
                                <div className="text-[11px]">
                                  <span className={`font-bold ${u.totalPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {u.totalPnl >= 0 ? '+' : ''}${u.totalPnl.toFixed(2)}
                                  </span>
                                  <span className="block text-[10px] text-gray-400">
                                    {u.positionsCount} open • {u.ordersCount} fills
                                  </span>
                                </div>
                              </td>

                              {/* Ban / Active Status */}
                              <td className="p-3 font-sans">
                                {u.isBanned ? (
                                  <div>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center gap-1 w-fit">
                                      <Ban className="w-3 h-3" /> Frozen
                                    </span>
                                    {u.banReason && <span className="block text-[9px] text-rose-400 truncate max-w-[120px]">{u.banReason}</span>}
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 w-fit">
                                    <Check className="w-3 h-3" /> Active
                                  </span>
                                )}
                              </td>

                              {/* Actions Drawer Trigger */}
                              <td className="p-3 text-right font-sans">
                                <button
                                  onClick={() => {
                                    setSelectedUserForAction(u);
                                    setGrantCash(u.virtualCash || 10000);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-surface-darkBorder hover:bg-blue-600 hover:text-white text-gray-700 dark:text-gray-200 text-xs font-bold transition-all"
                                >
                                  Manage
                                </button>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer & Pagination Ribbon */}
                <div className="p-3 border-t border-gray-200 dark:border-surface-darkBorder bg-gray-50/70 dark:bg-surface-darkCard/50 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
                  <div className="text-gray-500 dark:text-gray-400 font-medium">
                    Showing <span className="font-bold text-gray-900 dark:text-white">{totalUsersCount === 0 ? 0 : (usersPerPage === 'all' ? 1 : (currentUserPage - 1) * usersPerPage + 1)}</span> to <span className="font-bold text-gray-900 dark:text-white">{usersPerPage === 'all' ? totalUsersCount : Math.min(currentUserPage * usersPerPage, totalUsersCount)}</span> of <span className="font-bold text-blue-600 dark:text-blue-400">{totalUsersCount}</span> registered traders
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-400">Rows:</span>
                      <select
                        value={usersPerPage}
                        onChange={(e) => {
                          setUsersPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value));
                          setUsersPage(1);
                        }}
                        className="px-2 py-1 rounded-md bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder text-xs font-semibold text-gray-900 dark:text-white"
                      >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value="all">Show All ({totalUsersCount})</option>
                      </select>
                    </div>

                    {usersPerPage !== 'all' && totalUserPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                          disabled={currentUserPage <= 1}
                          className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkPanel hover:bg-gray-100 dark:hover:bg-surface-darkHover disabled:opacity-40 font-semibold transition-colors"
                        >
                          Prev
                        </button>
                        <span className="px-2 font-mono text-[11px] text-gray-500">
                          {currentUserPage} / {totalUserPages}
                        </span>
                        <button
                          onClick={() => setUsersPage(p => Math.min(totalUserPages, p + 1))}
                          disabled={currentUserPage >= totalUserPages}
                          className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkPanel hover:bg-gray-100 dark:hover:bg-surface-darkHover disabled:opacity-40 font-semibold transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Selected User Management Drawer / Modal */}
              {selectedUserForAction && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                  <div className="relative w-full max-w-lg bg-white dark:bg-surface-darkPanel rounded-2xl p-5 border border-gray-200 dark:border-surface-darkBorder shadow-2xl flex flex-col gap-4">
                    
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-surface-darkBorder pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                          Manage User #{selectedUserForAction.id} ({selectedUserForAction.displayName})
                        </h3>
                        <p className="text-xs text-gray-400 font-mono">{selectedUserForAction.email}</p>
                      </div>
                      <button onClick={() => setSelectedUserForAction(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-darkHover">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 1. Grant Plan Fast Override */}
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex flex-col gap-2.5">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> 1-Click Plan Grant / Upgrade
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'reset_10k', label: 'Starter $10k', days: 30, cash: 10000 },
                          { id: 'tier_20k', label: 'Pro $20k', days: 60, cash: 20000 },
                          { id: 'tier_25k', label: 'Elite $25k', days: 180, cash: 25000 },
                          { id: 'free', label: 'Revert Free', days: 0, cash: 2000 }
                        ].map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setGrantPlanId(p.id);
                              setGrantDays(p.days);
                              setGrantCash(p.cash);
                            }}
                            className={`p-2 rounded-xl text-center text-xs font-bold border transition-all ${
                              grantPlanId === p.id 
                                ? 'border-blue-600 bg-blue-600 text-white' 
                                : 'border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={grantDays}
                          onChange={(e) => setGrantDays(e.target.value)}
                          placeholder="Days validity"
                          className="w-1/2 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white"
                        />
                        <input
                          type="number"
                          value={grantCash}
                          onChange={(e) => setGrantCash(e.target.value)}
                          placeholder="Capital ($)"
                          className="w-1/2 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white"
                        />
                      </div>

                      <button
                        onClick={() => handleGrantPlan(selectedUserForAction.id)}
                        disabled={actionLoading[selectedUserForAction.id]}
                        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <span>Grant Plan Directly (No Payment Required)</span>
                      </button>
                    </div>

                    {/* 2. Direct Cash Balance Override */}
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder flex flex-col gap-2">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        Override Cash Balance ($)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={customCashAmount}
                          onChange={(e) => setCustomCashAmount(e.target.value)}
                          placeholder={`Current: $${selectedUserForAction.virtualCash.toLocaleString('en-US')}`}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder font-mono text-gray-900 dark:text-white"
                        />
                        <button
                          onClick={() => handleAdjustCash(selectedUserForAction.id)}
                          disabled={!customCashAmount}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                        >
                          Set Cash
                        </button>
                      </div>
                    </div>

                    {/* 3. Freeze / Ban Trading Controls */}
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex flex-col gap-2">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <Ban className="w-3.5 h-3.5" /> Trading Suspension &amp; Account Freeze
                      </span>
                      <input
                        type="text"
                        value={banReasonInput}
                        onChange={(e) => setBanReasonInput(e.target.value)}
                        placeholder="Reason for suspension (visible to trader)"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleBan(selectedUserForAction.id, selectedUserForAction.isBanned)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                            selectedUserForAction.isBanned 
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                              : 'bg-rose-600 hover:bg-rose-700 text-white'
                          }`}
                        >
                          {selectedUserForAction.isBanned ? 'Unban / Restore Trading' : 'Freeze Trading Privileges'}
                        </button>

                        <button
                          onClick={() => handleToggleAdmin(selectedUserForAction.id)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-surface-darkBorder text-xs font-semibold hover:bg-gray-100"
                        >
                          {selectedUserForAction.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                      </div>
                    </div>

                    {/* 4. Wipe / Reset Account */}
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Emergency Reset</span>
                      <button
                        onClick={() => handleResetPortfolio(selectedUserForAction.id)}
                        className="text-xs text-rose-500 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Wipe Portfolio &amp; Close Open Trades
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          );
        })()}


        {/* ========================================================================= */}
        {/* TAB 2: UPI PAYMENTS & APPROVALS                                           */}
        {/* ========================================================================= */}
        {activeTab === 'payments' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by 12-digit UTR, email, or user..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {[
                  { id: 'pending', label: 'Pending Verification' },
                  { id: 'completed', label: 'Approved & Completed' },
                  { id: 'rejected', label: 'Rejected / Fake' },
                  { id: 'all', label: 'All Submissions' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilterTab(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filterTab === f.id
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-surface-darkCard text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                <button
                  onClick={() => handleExportCsv('payments')}
                  className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Payments CSV</span>
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden bg-white dark:bg-surface-darkPanel shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-surface-darkCard border-b border-gray-200 dark:border-surface-darkBorder text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Order ID &amp; Date</th>
                      <th className="p-3">Trader</th>
                      <th className="p-3">Plan Requested</th>
                      <th className="p-3">Amount (INR)</th>
                      <th className="p-3">Bank UTR Ref No</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Verification Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder font-mono">
                    {orders
                      .filter(o => {
                        if (filterTab === 'pending') return o.status === 'pending';
                        if (filterTab === 'completed') return o.status === 'completed';
                        if (filterTab === 'rejected') return o.status === 'rejected';
                        return true;
                      })
                      .filter(o => {
                        if (!searchQuery) return true;
                        const q = searchQuery.toLowerCase();
                        return o.utr_ref?.toLowerCase().includes(q) || o.user_email?.toLowerCase().includes(q) || String(o.id).includes(q);
                      })
                      .map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50/60 dark:hover:bg-surface-darkCard/40 transition-colors">
                          <td className="p-3">
                            <span className="font-bold text-gray-900 dark:text-white">#{o.id}</span>
                            <span className="block text-[10px] text-gray-400 font-sans">{o.created_at?.slice(0, 16)}</span>
                          </td>
                          <td className="p-3 font-sans">
                            <div className="font-bold text-gray-900 dark:text-white">{o.user_name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">#{o.user_id} • {o.user_email}</div>
                          </td>
                          <td className="p-3 font-sans">
                            <span className="font-bold text-blue-600 dark:text-blue-400">{o.plan_name}</span>
                          </td>
                          <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            ₹{o.amount_inr}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-surface-darkCard px-2 py-1 rounded-md border border-gray-200 dark:border-surface-darkBorder w-fit">
                              <span className="font-bold text-gray-900 dark:text-white">{o.utr_ref}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(o.utr_ref);
                                  setCopiedUtr(o.utr_ref);
                                  setTimeout(() => setCopiedUtr(null), 2000);
                                }}
                                className="text-gray-400 hover:text-gray-700"
                              >
                                {copiedUtr === o.utr_ref ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="p-3 font-sans">
                            {o.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                Pending
                              </span>
                            )}
                            {o.status === 'completed' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                Approved
                              </span>
                            )}
                            {o.status === 'rejected' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-sans">
                            {o.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleApproveOrder(o.id)}
                                  disabled={actionLoading[o.id]}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
                                >
                                  Approve &amp; Credit
                                </button>
                                <button
                                  onClick={() => setRejectPromptId(o.id)}
                                  className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400">{o.admin_notes || 'Processed'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rejection Reason Modal */}
            {rejectPromptId && (
              <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
                <div className="relative w-full max-w-sm bg-white dark:bg-surface-darkPanel rounded-2xl p-5 border border-gray-200 dark:border-surface-darkBorder shadow-2xl flex flex-col gap-3">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Reject Order #{rejectPromptId}</h4>
                  <p className="text-xs text-gray-500">Specify reason why this UTR is invalid:</p>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => setRejectPromptId(null)} className="flex-1 py-1.5 rounded-lg border text-xs font-semibold">
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRejectOrder(rejectPromptId)}
                      className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LIVE POSITIONS RISK & FORCE-CLOSE                                  */}
        {/* ========================================================================= */}
        {activeTab === 'positions' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" /> Platform-Wide Open Positions Monitor
                </h3>
                <p className="text-xs text-gray-400">Live mark prices &amp; liquidation exposure across all active traders.</p>
              </div>
              <button
                onClick={() => handleExportCsv('positions')}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Positions CSV</span>
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden bg-white dark:bg-surface-darkPanel shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-surface-darkCard border-b border-gray-200 dark:border-surface-darkBorder text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Trader</th>
                      <th className="p-3">Symbol &amp; Side</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3">Entry Price</th>
                      <th className="p-3">Live Mark Price</th>
                      <th className="p-3">Leverage</th>
                      <th className="p-3">Unrealized P&amp;L</th>
                      <th className="p-3 text-right">Emergency Risk Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder font-mono">
                    {positions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-400 font-sans">
                          No open positions currently active on the platform.
                        </td>
                      </tr>
                    ) : (
                      positions.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/60 dark:hover:bg-surface-darkCard/40 transition-colors">
                          <td className="p-3 font-sans">
                            <div className="font-bold text-gray-900 dark:text-white">{p.userName}</div>
                            <div className="text-[10px] text-gray-400 font-mono">#{p.userId} • {p.userEmail}</div>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-gray-900 dark:text-white">{p.symbol}</span>
                            <span className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              p.side === 'LONG' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                            }`}>
                              {p.side}
                            </span>
                          </td>
                          <td className="p-3 font-bold">{p.quantity}</td>
                          <td className="p-3">${p.avgEntryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 font-bold text-blue-500">${p.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 font-bold text-purple-500">{p.leverage}x</td>
                          <td className={`p-3 font-bold ${p.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnl.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-sans">
                            <button
                              onClick={() => handleForceClose(p.id, p.symbol)}
                              disabled={actionLoading[`pos_${p.id}`]}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
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

        {/* ========================================================================= */}
        {/* TAB 4: SYMBOL RISK & LEVERAGE OVERRIDES                                   */}
        {/* ========================================================================= */}
        {activeTab === 'leverage' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-500" /> Set Symbol Leverage Cap / Halt Trading
              </h3>
              <form onSubmit={handleSaveLeverageOverride} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Symbol (e.g. BTCUSDT, EUR/USD)</label>
                  <input
                    type="text"
                    required
                    value={newSymOverride.symbol}
                    onChange={(e) => setNewSymOverride({ ...newSymOverride, symbol: e.target.value.toUpperCase() })}
                    placeholder="BTCUSDT"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Max Leverage Cap (x)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newSymOverride.max_leverage}
                    onChange={(e) => setNewSymOverride({ ...newSymOverride, max_leverage: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Risk Note</label>
                  <input
                    type="text"
                    value={newSymOverride.notes}
                    onChange={(e) => setNewSymOverride({ ...newSymOverride, notes: e.target.value })}
                    placeholder="e.g. Extreme volatility cap"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newSymOverride.is_trading_disabled}
                      onChange={(e) => setNewSymOverride({ ...newSymOverride, is_trading_disabled: e.target.checked })}
                      className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-rose-500 font-bold">Halt Trading</span>
                  </label>
                  <button type="submit" className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
                    Save Override
                  </button>
                </div>
              </form>
            </div>

            {/* Overrides Table */}
            <div className="rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden bg-white dark:bg-surface-darkPanel shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-surface-darkCard border-b border-gray-200 dark:border-surface-darkBorder text-gray-500 dark:text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Symbol</th>
                    <th className="p-3">Max Leverage Cap</th>
                    <th className="p-3">Trading Status</th>
                    <th className="p-3">Risk Notes</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder font-mono">
                  {leverageOverrides.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 font-sans">
                        No custom symbol overrides active. Default platform limits apply to all assets.
                      </td>
                    </tr>
                  ) : (
                    leverageOverrides.map(o => (
                      <tr key={o.symbol} className="hover:bg-gray-50/60 dark:hover:bg-surface-darkCard/40">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{o.symbol}</td>
                        <td className="p-3 font-bold text-purple-500">{o.max_leverage}x</td>
                        <td className="p-3 font-sans">
                          {o.is_trading_disabled === 1 ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-500 font-bold text-[10px]">HALTED</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 font-bold text-[10px]">ACTIVE</span>
                          )}
                        </td>
                        <td className="p-3 text-gray-400 font-sans">{o.notes || '—'}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteLeverageOverride(o.symbol)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: COUPONS & PROMO CODES                                              */}
        {/* ========================================================================= */}
        {activeTab === 'coupons' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-500" /> Create Promo / Discount Coupon
              </h3>
              <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Coupon Code</label>
                  <input
                    type="text"
                    required
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. VIP50"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder font-mono uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Discount (% or Flat ₹)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newCoupon.discount_percent}
                      onChange={(e) => setNewCoupon({ ...newCoupon, discount_percent: Number(e.target.value), discount_amount_inr: 0 })}
                      placeholder="20%"
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder font-mono"
                    />
                    <span className="text-xs text-gray-400 font-bold">%</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Max Redemptions</label>
                  <input
                    type="number"
                    value={newCoupon.max_uses}
                    onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: Number(e.target.value) })}
                    placeholder="100"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder font-mono"
                  />
                </div>
                <button type="submit" className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs">
                  Create Coupon
                </button>
              </form>
            </div>

            {/* Coupons Table */}
            <div className="rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden bg-white dark:bg-surface-darkPanel shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-surface-darkCard border-b border-gray-200 dark:border-surface-darkBorder text-gray-500 dark:text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Coupon Code</th>
                    <th className="p-3">Discount</th>
                    <th className="p-3">Redemptions</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Toggle / Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder font-mono">
                  {coupons.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 font-sans">
                        No coupons generated yet.
                      </td>
                    </tr>
                  ) : (
                    coupons.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50/60 dark:hover:bg-surface-darkCard/40">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{c.code}</td>
                        <td className="p-3 font-bold text-emerald-500">
                          {c.discount_percent > 0 ? `${c.discount_percent}% OFF` : `₹${c.discount_amount_inr} OFF`}
                        </td>
                        <td className="p-3 text-gray-400">{c.used_count} / {c.max_uses} used</td>
                        <td className="p-3 font-sans">
                          {c.is_active === 1 ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 font-bold text-[10px]">ACTIVE</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-gray-200 dark:bg-surface-darkBorder text-gray-500 font-bold text-[10px]">DISABLED</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleToggleCoupon(c.id)}
                              className="px-2 py-1 rounded bg-gray-100 dark:bg-surface-darkCard text-[11px] font-semibold hover:bg-gray-200"
                            >
                              {c.is_active === 1 ? 'Disable' : 'Enable'}
                            </button>
                            <button onClick={() => handleDeleteCoupon(c.id)} className="p-1 rounded text-rose-500 hover:bg-rose-50">
                              <Trash2 className="w-3.5 h-3.5" />
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
        )}

        {/* ========================================================================= */}
        {/* TAB 6: MONETIZATION PLANS EDITOR                                          */}
        {/* ========================================================================= */}
        {activeTab === 'plans' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-500" /> Monetization Plans &amp; Pricing Editor
                </h3>
                <p className="text-xs text-gray-400">Modify ₹ prices, validity days, capital amounts, and descriptions in real time.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {plans.map(p => (
                <div key={p.id} className="p-4 rounded-2xl bg-white dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder flex flex-col justify-between gap-3 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 uppercase">
                        {p.badge || `${p.durationDays} DAYS`}
                      </span>
                      <span className="text-lg font-black text-gray-900 dark:text-white">₹{p.priceInr}</span>
                    </div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white mt-1.5">{p.name}</h4>
                    <p className="text-xs font-bold text-emerald-500">+${p.virtualCash.toLocaleString('en-US')} Capital</p>
                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">{p.description}</p>
                  </div>

                  <button
                    onClick={() => setEditingPlan(p)}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Plan Details &amp; Price
                  </button>
                </div>
              ))}
            </div>

            {/* Plan Edit Modal */}
            {editingPlan && (
              <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
                <form onSubmit={handleSavePlan} className="relative w-full max-w-md bg-white dark:bg-surface-darkPanel rounded-2xl p-5 border border-gray-200 dark:border-surface-darkBorder shadow-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-surface-darkBorder">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Edit Plan: {editingPlan.id}</h4>
                    <button type="button" onClick={() => setEditingPlan(null)}><X className="w-4 h-4" /></button>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Plan Display Name</label>
                    <input
                      type="text"
                      required
                      value={editingPlan.name}
                      onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder font-bold text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">Price in INR (₹)</label>
                      <input
                        type="number"
                        required
                        value={editingPlan.priceInr}
                        onChange={(e) => setEditingPlan({ ...editingPlan, priceInr: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">Validity (Days)</label>
                      <input
                        type="number"
                        required
                        value={editingPlan.durationDays}
                        onChange={(e) => setEditingPlan({ ...editingPlan, durationDays: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Capital Granted ($)</label>
                    <input
                      type="number"
                      required
                      value={editingPlan.virtualCash}
                      onChange={(e) => setEditingPlan({ ...editingPlan, virtualCash: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Badge Tag</label>
                    <input
                      type="text"
                      value={editingPlan.badge || ''}
                      onChange={(e) => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                      placeholder="e.g. 30 DAYS • POPULAR"
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button type="button" onClick={() => setEditingPlan(null)} className="flex-1 py-2 rounded-xl border text-xs font-semibold">
                      Cancel
                    </button>
                    <button type="submit" className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: GLOBAL ANNOUNCEMENTS & BROADCAST BANNER                            */}
        {/* ========================================================================= */}
        {activeTab === 'announcements' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-amber-500" /> Post Global Broadcast Announcement
              </h3>
              <form onSubmit={handlePostAnnouncement} className="flex flex-col gap-3">
                <textarea
                  required
                  rows={2}
                  value={newAnnouncement.message}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                  placeholder="e.g. ⚠️ Scheduled Platform Maintenance at 18:00 UTC. Open positions will not be affected."
                  className="w-full p-3 text-xs rounded-xl bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Banner Type:</span>
                    {['info', 'warning', 'danger', 'success'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewAnnouncement({ ...newAnnouncement, announcement_type: t })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                          newAnnouncement.announcement_type === t
                            ? (t === 'danger' ? 'bg-rose-600 text-white' : (t === 'warning' ? 'bg-amber-500 text-white' : (t === 'success' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white')))
                            : 'bg-white dark:bg-surface-darkPanel border text-gray-500'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <button type="submit" className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs">
                    Publish Banner Broadcast
                  </button>
                </div>
              </form>
            </div>

            {/* Announcements History */}
            <div className="rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden bg-white dark:bg-surface-darkPanel shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-surface-darkCard border-b border-gray-200 dark:border-surface-darkBorder text-gray-500 dark:text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Message</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Live Status</th>
                    <th className="p-3 text-right">Toggle / Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder">
                  {announcements.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400">No past broadcast announcements.</td>
                    </tr>
                  ) : (
                    announcements.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50/60 dark:hover:bg-surface-darkCard/40">
                        <td className="p-3 font-semibold text-gray-900 dark:text-white max-w-md truncate">{a.message}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            a.announcement_type === 'danger' ? 'bg-rose-500/15 text-rose-500' : (a.announcement_type === 'warning' ? 'bg-amber-500/15 text-amber-500' : 'bg-blue-500/15 text-blue-500')
                          }`}>
                            {a.announcement_type}
                          </span>
                        </td>
                        <td className="p-3">
                          {a.is_active === 1 ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 font-bold text-[10px] animate-pulse">BROADCASTING</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-gray-200 dark:bg-surface-darkBorder text-gray-500 font-bold text-[10px]">INACTIVE</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleToggleAnnouncement(a.id)}
                              className="px-2.5 py-1 rounded bg-gray-100 dark:bg-surface-darkCard text-[11px] font-semibold hover:bg-gray-200"
                            >
                              {a.is_active === 1 ? 'Hide' : 'Broadcast'}
                            </button>
                            <button onClick={() => handleDeleteAnnouncement(a.id)} className="p-1 rounded text-rose-500 hover:bg-rose-50">
                              <Trash2 className="w-3.5 h-3.5" />
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
        )}

        {/* ========================================================================= */}
        {/* TAB 8: AUDIT LOG TRACKER                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search audit actions, admin email, or target..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={fetchAuditLogs}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  Filter
                </button>
              </div>

              <button
                onClick={() => handleExportCsv('orders')}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Orders History CSV</span>
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden bg-white dark:bg-surface-darkPanel shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-surface-darkCard border-b border-gray-200 dark:border-surface-darkBorder text-gray-500 dark:text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Timestamp (UTC)</th>
                    <th className="p-3">Admin</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder font-mono">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 font-sans">No audit events recorded yet.</td>
                    </tr>
                  ) : (
                    auditLogs.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50/60 dark:hover:bg-surface-darkCard/40">
                        <td className="p-3 text-gray-400">{l.created_at?.slice(0, 19)}</td>
                        <td className="p-3 font-sans font-bold text-gray-900 dark:text-white">{l.admin_email}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-500">
                            {l.action}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500">{l.target_type} #{l.target_id}</td>
                        <td className="p-3 font-sans text-gray-600 dark:text-gray-300 max-w-md truncate">{l.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

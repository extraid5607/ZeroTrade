import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Check, 
  Copy, 
  QrCode, 
  ShieldCheck, 
  Zap, 
  RotateCcw, 
  Award, 
  TrendingUp, 
  ArrowRight, 
  Sparkles,
  ExternalLink,
  DollarSign,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  RefreshCw,
  Info
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const MERCHANT_UPI = "harjinder1070-1@okicici";
const MERCHANT_NAME = "ZeroVega";

const PLANS = [
  {
    id: 'reset_10k',
    name: 'Account Reset (Extra Life)',
    priceInr: 199,
    virtualCash: 10000,
    badge: 'POPULAR',
    popular: true,
    icon: RotateCcw,
    color: 'from-blue-600 to-indigo-600',
    description: 'Restore your blown account back to $10,000.00 capital upon UPI verification.',
    features: [
      'Instant $10,000.00 virtual capital reset',
      'Wipe all liquidated / negative positions',
      'Unlocks 20x Futures & US Options',
      'Verified UPI Bank Confirmation'
    ]
  },
  {
    id: 'tier_25k',
    name: 'Pro Trader Challenge ($25k)',
    priceInr: 499,
    virtualCash: 25000,
    badge: 'PRO',
    popular: false,
    icon: Zap,
    color: 'from-purple-600 to-indigo-600',
    description: 'Upgrade your account to $25,000.00 capital for swing & multi-position trading.',
    features: [
      '$25,000.00 High-Capacity Virtual Balance',
      '20x Multiplier on Futures & Stocks',
      'Full CBOE Options Institutional Feeds',
      '1-Year P&L Statement Access'
    ]
  },
  {
    id: 'tier_100k',
    name: 'Elite Whale Challenge ($100k)',
    priceInr: 999,
    virtualCash: 100000,
    badge: 'BEST VALUE',
    popular: false,
    icon: TrendingUp,
    color: 'from-amber-500 to-orange-600',
    description: 'Institutional-scale $100,000.00 capital for high-volume options writing.',
    features: [
      '$100,000.00 Institutional Virtual Capital',
      'Unrestricted Multi-Strike Option Writing',
      'Priority Global Leaderboard Ranking',
      'Elite VIP Badge on Profile'
    ]
  },
  {
    id: 'tournament_pass',
    name: 'Monthly Championship Pass',
    priceInr: 299,
    virtualCash: 10000,
    badge: 'CONTEST',
    popular: false,
    icon: Award,
    color: 'from-emerald-600 to-teal-600',
    description: 'Enter the monthly trading competition with $10,000 capital & win rewards.',
    features: [
      'Entry into Monthly Trader Contest',
      '$10,000.00 Verified Competition Capital',
      'Top 5 Trader Prize Pool Eligibility',
      'Verified Contestant Badge'
    ]
  }
];

export default function BillingModal({ 
  isOpen, 
  onClose, 
  initialPlanId = 'reset_10k',
  onPaymentSuccess,
  onOpenAuth,
  user
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);
  const [utrRef, setUtrRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [step, setStep] = useState('select'); // 'select' | 'pay' | 'submitted' | 'history'
  
  // User payment history state
  const [historyOrders, setHistoryOrders] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (initialPlanId) {
      setSelectedPlanId(initialPlanId);
    }
  }, [initialPlanId]);

  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setUtrRef('');
      setError(null);
      setSuccessData(null);
      setCopied(false);
    }
  }, [isOpen]);

  const fetchMyOrders = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('zerotrade_token');
      if (!token) return;
      const res = await fetch('/api/billing/my-orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setHistoryOrders(data.orders || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    if (step === 'history' && isOpen) {
      fetchMyOrders();
    }
  }, [step, isOpen, fetchMyOrders]);

  if (!isOpen) return null;

  const selectedPlan = PLANS.find(p => p.id === selectedPlanId) || PLANS[0];

  // Standard UPI URI format
  const upiUri = `upi://pay?pa=${MERCHANT_UPI}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${selectedPlan.priceInr}&cu=INR&tn=${encodeURIComponent(selectedPlan.name)}`;

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(MERCHANT_UPI);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleProceedToPay = () => {
    if (!user) {
      onClose();
      onOpenAuth?.();
      return;
    }
    setStep('pay');
    setError(null);
  };

  const handleUtrChange = (e) => {
    // Only allow numeric digits and limit to 12 chars
    const numeric = e.target.value.replace(/\D/g, '').slice(0, 12);
    setUtrRef(numeric);
    if (error) setError(null);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    const cleanUtr = utrRef.trim();
    if (!cleanUtr || cleanUtr.length !== 12) {
      setError("Please enter a valid 12-digit numeric UPI Transaction Reference (UTR) Number.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('zerotrade_token');
      const res = await fetch('/api/billing/submit-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          utr_ref: cleanUtr,
          amount_inr: selectedPlan.priceInr
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Payment submission failed');
      }

      setSuccessData(data);
      setStep('submitted');
      onPaymentSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Payment submission failed. Please check UTR number.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full sm:max-w-2xl bg-white dark:bg-surface-darkPanel rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-surface-darkBorder overflow-hidden z-10 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-surface-darkBorder bg-gray-50/80 dark:bg-surface-darkCard/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                {step === 'select' && 'Capital Packages & Account Resets'}
                {step === 'pay' && 'UPI Payment & Verification'}
                {step === 'submitted' && 'Payment Submitted — Verification in Progress'}
                {step === 'history' && 'My Payment Orders & Verification Status'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {step === 'select' && 'Choose an evaluation challenge tier or instant reset token'}
                {step === 'pay' && `Pay ₹${selectedPlan.priceInr} via any UPI App (GPay, PhonePe, Paytm)`}
                {step === 'submitted' && 'Bank verification takes 5–15 minutes'}
                {step === 'history' && 'View pending approvals and past transaction receipts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {user && step !== 'history' && (
              <button
                onClick={() => {
                  setStep('history');
                  fetchMyOrders();
                }}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-surface-darkBorder hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-600 dark:text-gray-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="View My Payment History"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">My Orders</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4">
          
          {/* ========================================================================= */}
          {/* STEP 1: SELECT PLAN                                                      */}
          {/* ========================================================================= */}
          {step === 'select' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {PLANS.map((plan) => {
                  const Icon = plan.icon;
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 select-none ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-md ring-1 ring-blue-500'
                          : 'border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard/40 hover:border-gray-300 dark:hover:border-surface-darkHover'
                      }`}
                    >
                      {/* Top Badge */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          plan.popular 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'bg-gray-100 dark:bg-surface-darkBorder text-gray-600 dark:text-gray-300'
                        }`}>
                          {plan.badge}
                        </span>

                        <div className="flex items-baseline gap-1 text-right">
                          <span className="text-xl font-bold text-gray-900 dark:text-white">
                            ₹{plan.priceInr}
                          </span>
                          <span className="text-[10px] text-gray-400">INR</span>
                        </div>
                      </div>

                      {/* Plan Details */}
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${plan.color} text-white`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                            {plan.name}
                          </h3>
                        </div>

                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                          +${plan.virtualCash.toLocaleString('en-US')} Capital
                        </div>

                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                          {plan.description}
                        </p>
                      </div>

                      {/* Bullet Features */}
                      <ul className="space-y-1 pt-2 border-t border-gray-100 dark:border-surface-darkBorder text-[11px] text-gray-600 dark:text-gray-300">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Selection Radio Circle */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-gray-400">One-time payment</span>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleProceedToPay}
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <span>Proceed to Pay ₹{selectedPlan.priceInr} via UPI</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>

                {!user && (
                  <p className="text-center text-xs text-amber-500 mt-2">
                    * You will be prompted to sign in / create an account before activating your plan.
                  </p>
                )}
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: UPI PAYMENT & UTR SUBMISSION                                      */}
          {/* ========================================================================= */}
          {step === 'pay' && (
            <div className="flex flex-col gap-4">
              
              {/* Selected Plan Summary Banner */}
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider">
                    Selected Package
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedPlan.name} (+${selectedPlan.virtualCash.toLocaleString('en-US')})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    ₹{selectedPlan.priceInr}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setStep('select')}
                    className="text-[11px] text-gray-400 hover:underline"
                  >
                    Change Plan
                  </button>
                </div>
              </div>

              {/* QR Code & UPI Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                
                {/* Left: Dynamic QR Code */}
                <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-surface-darkCard rounded-2xl border border-gray-200 dark:border-surface-darkBorder shadow-xs">
                  <div className="p-3 bg-white rounded-xl shadow-inner border border-gray-100">
                    <QRCodeSVG
                      value={upiUri}
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mt-2 flex items-center gap-1.5 text-center">
                    <QrCode className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    Scan with Google Pay, PhonePe, Paytm, or BHIM
                  </span>
                </div>

                {/* Right: Manual UPI ID & Intent Links */}
                <div className="flex flex-col gap-3">
                  
                  {/* Copy UPI Box */}
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
                      Official Merchant UPI ID:
                    </label>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-100 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder">
                      <span className="text-xs font-mono font-bold text-gray-900 dark:text-white flex-1 select-all">
                        {MERCHANT_UPI}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyUPI}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-1 shadow-xs"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Direct Mobile UPI App Links */}
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
                      Fast Pay on Mobile:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={upiUri}
                        className="p-2 rounded-xl border border-gray-200 dark:border-surface-darkBorder bg-gray-50 dark:bg-surface-darkCard hover:bg-gray-100 text-center text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-500" />
                        <span>Open UPI App</span>
                      </a>
                      <a
                        href={`gpay://upi/pay?pa=${MERCHANT_UPI}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${selectedPlan.priceInr}&cu=INR`}
                        className="p-2 rounded-xl border border-gray-200 dark:border-surface-darkBorder bg-gray-50 dark:bg-surface-darkCard hover:bg-gray-100 text-center text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1 transition-colors"
                      >
                        <span>Google Pay</span>
                      </a>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
                    🛡️ <strong>Anti-Fraud Verification:</strong> After transferring ₹{selectedPlan.priceInr}, copy the <strong>exact 12-digit UTR</strong> from your UPI app and submit below. Your capital will be unlocked upon bank statement match.
                  </div>

                </div>

              </div>

              {/* Step 2 Form: Enter UTR */}
              <form onSubmit={handleSubmitPayment} className="pt-2 flex flex-col gap-3">
                
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      12-Digit UPI Transaction Reference (UTR) <span className="text-rose-500">*</span>
                    </label>
                    <span className={`text-[11px] font-mono font-semibold ${
                      utrRef.length === 12 ? 'text-emerald-500' : 'text-gray-400'
                    }`}>
                      {utrRef.length}/12 digits {utrRef.length === 12 && '✓'}
                    </span>
                  </div>
                  
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={utrRef}
                    onChange={handleUtrChange}
                    placeholder="e.g. 426189304812"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-wider"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    Find this 12-digit number under "UPI Transaction ID / Ref No" in your Google Pay, PhonePe, or Paytm receipt.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('select')}
                    className="py-3 px-4 rounded-xl border border-gray-200 dark:border-surface-darkBorder text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-darkHover"
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || utrRef.length !== 12}
                    className={`flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${
                      submitting || utrRef.length !== 12 ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting for Verification...</span>
                      </>
                    ) : (
                      <span>Submit 12-Digit UTR Reference</span>
                    )}
                  </button>
                </div>

              </form>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SUBMITTED (PENDING VERIFICATION)                                  */}
          {/* ========================================================================= */}
          {step === 'submitted' && (
            <div className="py-4 flex flex-col items-center justify-center text-center gap-4">
              
              <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-500 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/20 animate-in zoom-in-50 duration-300">
                <Clock className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  STATUS: PENDING BANK VERIFICATION
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-2">
                  Payment Reference Submitted!
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                  Our verification desk is matching your ₹{selectedPlan.priceInr} deposit with ICICI bank records. Your <strong>${selectedPlan.virtualCash.toLocaleString('en-US')}</strong> capital will be credited automatically within <strong>5–15 minutes</strong>.
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="w-full max-w-sm p-4 rounded-2xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-xs flex flex-col gap-2.5 text-left">
                <div className="flex items-center justify-between text-gray-500">
                  <span>Order Reference:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">#ZT-{successData?.orderId || 'NEW'}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Selected Package:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{selectedPlan.name}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Amount to Verify:</span>
                  <span className="font-bold text-gray-900 dark:text-white">₹{selectedPlan.priceInr}.00</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Submitted UTR:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900">
                    {successData?.utrRef || utrRef}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Capital to Unlock:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+${selectedPlan.virtualCash.toLocaleString('en-US')}.00</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full max-w-sm">
                <button
                  onClick={() => {
                    setStep('history');
                    fetchMyOrders();
                  }}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors flex items-center justify-center gap-1.5"
                >
                  <History className="w-4 h-4" />
                  <span>Check Live Status</span>
                </button>

                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/25 transition-all"
                >
                  Close &amp; Continue
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: USER ORDER HISTORY & VERIFICATION STATUS                         */}
          {/* ========================================================================= */}
          {step === 'history' && (
            <div className="flex flex-col gap-3">
              
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep('select')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  &larr; Back to Buy Packages
                </button>

                <button
                  onClick={fetchMyOrders}
                  disabled={loadingHistory}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-surface-darkBorder hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-600 dark:text-gray-300 text-xs flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-blue-500' : ''}`} />
                  <span>Refresh Status</span>
                </button>
              </div>

              {loadingHistory && historyOrders.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Loading your orders...
                </div>
              ) : historyOrders.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  No payment orders found. Select a package to get started.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                  {historyOrders.map((ord) => {
                    const isPend = ord.status === 'pending';
                    const isComp = ord.status === 'completed';
                    const isRej = ord.status === 'rejected';

                    return (
                      <div
                        key={ord.id}
                        className={`p-3 rounded-xl border text-xs flex flex-col gap-2 ${
                          isPend
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                            : isComp
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                            : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {ord.plan_name}
                          </div>
                          <div>
                            {isPend && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Verification Pending</span>
                              </span>
                            )}
                            {isComp && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approved &amp; Unlocked</span>
                              </span>
                            )}
                            {isRej && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                <span>Rejected</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-[11px]">
                          <span>Amount: ₹{ord.amount_inr} &bull; UTR: <strong className="font-mono text-gray-800 dark:text-gray-200">{ord.utr_ref}</strong></span>
                          <span>{ord.created_at ? new Date(ord.created_at).toLocaleDateString() : ''}</span>
                        </div>

                        {ord.admin_notes && (
                          <div className="text-[10px] italic text-gray-500">
                            Admin Note: {ord.admin_notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Security Disclaimer */}
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-surface-darkCard/80 border-t border-gray-100 dark:border-surface-darkBorder text-center text-[10px] text-gray-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>ZeroVega Simulated Trading Assessment & Educational Desk &bull; Non-refundable challenge fee</span>
        </div>

      </div>

    </div>
  );
}

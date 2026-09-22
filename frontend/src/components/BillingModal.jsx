import React, { useState, useEffect } from 'react';
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
  AlertCircle
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
    description: 'Instant reset of your depleted account back to $10,000.00 capital.',
    features: [
      'Instant $10,000.00 virtual capital reset',
      'Wipe all liquidated / negative positions',
      'Unlocks 20x Futures & US Options',
      'Instant UPI Activation'
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
  const [step, setStep] = useState('select'); // 'select' | 'pay' | 'success'

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

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!utrRef || utrRef.trim().length < 4) {
      setError("Please enter a valid 12-digit UPI Transaction Reference (UTR) Number.");
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
          utr_ref: utrRef.trim(),
          amount_inr: selectedPlan.priceInr
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Payment verification failed');
      }

      setSuccessData(data);
      setStep('success');
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
                {step === 'pay' && 'UPI Payment & Instant Activation'}
                {step === 'success' && 'Payment Verified & Capital Activated!'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {step === 'select' && 'Select an evaluation challenge or instant reset token'}
                {step === 'pay' && `Pay ₹${selectedPlan.priceInr} via any UPI App (GPay, PhonePe, Paytm)`}
                {step === 'success' && `Your account has been credited with $${selectedPlan.virtualCash.toLocaleString('en-US')} virtual funds`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-surface-darkHover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
                  <span>Pay ₹{selectedPlan.priceInr} via UPI</span>
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
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mt-2 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-blue-600" />
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

                  <div className="text-[11px] text-gray-400 bg-gray-50 dark:bg-surface-darkCard/40 p-2.5 rounded-xl border border-gray-100 dark:border-surface-darkBorder">
                    💡 After completing payment in your UPI app, copy the <strong>12-digit UTR / Transaction Reference ID</strong> and paste below to activate immediately.
                  </div>

                </div>

              </div>

              {/* Step 2 Form: Enter UTR */}
              <form onSubmit={handleSubmitPayment} className="pt-2 flex flex-col gap-3">
                
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    UPI Transaction Reference / UTR Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={utrRef}
                    onChange={(e) => setUtrRef(e.target.value)}
                    placeholder="e.g. 426189304812 (12-digit number)"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
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
                    disabled={submitting}
                    className={`flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${
                      submitting ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                  >
                    {submitting ? 'Verifying Transaction...' : `Confirm ₹${selectedPlan.priceInr} Payment`}
                  </button>
                </div>

              </form>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SUCCESS CONFIRMATION                                             */}
          {/* ========================================================================= */}
          {step === 'success' && (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-4">
              
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-500/20 animate-in zoom-in-50 duration-300">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Payment Confirmed!
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                  {successData?.message || `Your account has been granted $${selectedPlan.virtualCash.toLocaleString('en-US')} virtual trading capital.`}
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="w-full max-w-sm p-4 rounded-2xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-xs flex flex-col gap-2">
                <div className="flex items-center justify-between text-gray-500">
                  <span>Receipt Order ID:</span>
                  <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">#ZT-{successData?.orderId || '108'}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Activated Plan:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{selectedPlan.name}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Paid Amount:</span>
                  <span className="font-bold text-gray-900 dark:text-white">₹{selectedPlan.priceInr}.00</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>New Virtual Cash:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">${selectedPlan.virtualCash.toLocaleString('en-US')}.00</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>UPI ID Used:</span>
                  <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">{MERCHANT_UPI}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full max-w-sm py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all"
              >
                Start Trading Now
              </button>

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

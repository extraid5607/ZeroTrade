import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';

export default function ResetModal({ isOpen, onClose, onConfirmReset }) {
  const [resetting, setResetting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setResetting(true);
    try {
      await onConfirmReset();
      onClose();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder w-full max-w-md overflow-hidden shadow-2xl p-6">
        
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-surface-darkBorder">
          <div className="flex items-center gap-2 text-rose-500 font-bold text-base">
            <AlertTriangle className="w-5 h-5" />
            <span>Reset Virtual Portfolio</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300 space-y-2">
          <p>
            Are you sure you want to start over?
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-500 dark:text-gray-400">
            <li>All active stock, crypto, and forex positions will be closed.</li>
            <li>All pending limit orders will be cancelled.</li>
            <li>Your virtual cash balance will reset to <strong>$100,000.00</strong>.</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={resetting}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-surface-darkCard text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={resetting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>{resetting ? 'Resetting...' : 'Yes, Reset to $100,000'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

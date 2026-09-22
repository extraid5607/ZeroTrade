import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white dark:bg-surface-darkPanel border border-gray-200 dark:border-surface-darkBorder rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-3 duration-200">
      <div className="flex-shrink-0 mt-0.5">
        {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        {isError && <AlertCircle className="w-5 h-5 text-rose-500" />}
        {!isSuccess && !isError && <Info className="w-5 h-5 text-cyan-500" />}
      </div>
      <div className="flex-1">
        <h4 className="text-xs font-bold text-gray-900 dark:text-white">
          {toast.title}
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
          {toast.message}
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

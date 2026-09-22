import React, { useState, useEffect } from 'react';
import { Trophy, Medal, X, Flame, Percent } from 'lucide-react';

export default function LeaderboardModal({ isOpen, onClose }) {
  const [traders, setTraders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/leaderboard')
        .then(res => res.json())
        .then(data => {
          setTraders(data.leaderboard || []);
        })
        .catch(err => console.error("Leaderboard error:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder w-full max-w-2xl overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-surface-darkBorder bg-gray-50 dark:bg-surface-darkCard/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                ZeroVega Leaderboard
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Top simulated traders ranked by virtual ROI & performance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              Loading rankings...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-surface-darkBorder text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                    <th className="py-2.5 px-3 text-center">Rank</th>
                    <th className="py-2.5 px-3">Trader</th>
                    <th className="py-2.5 px-3 text-right">Net Equity</th>
                    <th className="py-2.5 px-3 text-right">Return %</th>
                    <th className="py-2.5 px-3 text-right">Win Rate</th>
                    <th className="py-2.5 px-3 text-right">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-surface-darkBorder">
                  {traders.map((t) => {
                    const isPositive = t.returnPercent >= 0;
                    return (
                      <tr key={t.userId} className="hover:bg-gray-50 dark:hover:bg-surface-darkHover">
                        <td className="py-3 px-3 text-center">
                          {t.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white font-medium text-xs shadow-sm">
                              1
                            </span>
                          ) : t.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400 text-white font-medium text-xs shadow-sm">
                              2
                            </span>
                          ) : t.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-medium text-xs shadow-sm">
                              3
                            </span>
                          ) : (
                            <span className="text-gray-400 font-medium">{t.rank}</span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{t.displayName}</span>
                            {t.rank <= 3 && <Flame className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">
                          ${t.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className={`py-3 px-3 text-right font-medium tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isPositive ? '+' : ''}{t.returnPercent.toFixed(2)}%
                        </td>

                        <td className="py-3 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300 font-medium">
                          {t.winRate.toFixed(1)}%
                        </td>

                        <td className="py-3 px-3 text-right tabular-nums text-gray-500">
                          {t.totalTrades}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-surface-darkBorder bg-gray-50 dark:bg-surface-darkCard/50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-surface-darkBorder text-gray-800 dark:text-white hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

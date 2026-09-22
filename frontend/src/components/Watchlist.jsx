import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Edit3, 
  Check, 
  X, 
  ChevronRight,
  MoreVertical,
  RotateCcw,
  Sparkles,
  BarChart2,
  Layers
} from 'lucide-react';

const DEFAULT_WATCHLISTS = [
  {
    id: 'wl-1',
    name: 'Watchlist 1',
    symbols: ['SPY', '^GSPC', 'AAPL', 'NVDA', 'XAU/USD', 'XAG/USD', 'BTCUSDT', 'ETHUSDT', 'EUR/USD']
  },
  {
    id: 'wl-commodities',
    name: 'Commodities',
    symbols: ['XAU/USD', 'XAG/USD', 'GLD', 'SLV']
  },
  {
    id: 'wl-indices',
    name: 'Indices',
    symbols: ['^GSPC', '^IXIC', 'SPY', 'QQQ']
  },
  {
    id: 'wl-stocks',
    name: 'US Stocks',
    symbols: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD']
  },
  {
    id: 'wl-crypto',
    name: 'Crypto',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT']
  },
  {
    id: 'wl-forex',
    name: 'Forex',
    symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/INR', 'AUD/USD', 'USD/CAD']
  }
];


export default function Watchlist({
  tickers = [],
  selectedSymbol,
  onSelectSymbol, // opens QuoteSheet or selects symbol
  onViewChart,
  onOpenOrderModal,
  isDesktopSidebar = false
}) {
  // Load watchlists from localStorage or defaults
  const [watchlists, setWatchlists] = useState(() => {
    try {
      const saved = localStorage.getItem('zerotrade_user_watchlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Error loading watchlists:", e);
    }
    return DEFAULT_WATCHLISTS;
  });

  const [activeWlId, setActiveWlId] = useState(() => watchlists[0]?.id || 'wl-1');
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal / prompt states for adding/renaming watchlist
  const [isCreatingWl, setIsCreatingWl] = useState(false);
  const [newWlName, setNewWlName] = useState('');
  const [editingWlId, setEditingWlId] = useState(null);
  const [editingWlName, setEditingWlName] = useState('');

  // Persist watchlists to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('zerotrade_user_watchlists', JSON.stringify(watchlists));
    } catch (e) {
      console.error("Error saving watchlists:", e);
    }
  }, [watchlists]);

  // Current active watchlist
  const activeWl = watchlists.find(w => w.id === activeWlId) || watchlists[0] || { id: 'wl-1', name: 'Watchlist 1', symbols: [] };

  // Map of symbol -> ticker data
  const tickerMap = useMemo(() => {
    const map = {};
    tickers.forEach(t => {
      map[t.symbol] = t;
    });
    return map;
  }, [tickers]);

  // List of items in the current active watchlist
  const currentItems = useMemo(() => {
    const list = [];
    (activeWl.symbols || []).forEach(sym => {
      const t = tickerMap[sym] || {
        symbol: sym,
        display: sym,
        name: sym,
        category: sym.endsWith('USDT') ? 'crypto' : (sym.includes('/') ? 'forex' : 'stock'),
        price: 100.0,
        changePercent24h: 0.0
      };
      list.push(t);
    });

    // If searching while in list view (filtering existing symbols)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return list.filter(t => 
        t.symbol.toLowerCase().includes(q) || 
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.display && t.display.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeWl, tickerMap, searchQuery]);

  // Search Results for all available market tickers (when searching to add)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return tickers.filter(t => 
      t.symbol.toLowerCase().includes(q) || 
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.display && t.display.toLowerCase().includes(q))
    );
  }, [tickers, searchQuery]);

  // --- Watchlist Management Functions ---

  // 1. Create New Watchlist
  const handleCreateWatchlist = (e) => {
    e.preventDefault();
    const name = newWlName.trim() || `Watchlist ${watchlists.length + 1}`;
    const newWl = {
      id: `wl-${Date.now()}`,
      name: name,
      symbols: ['SPY', 'BTCUSDT', 'AAPL']
    };
    const updated = [...watchlists, newWl];
    setWatchlists(updated);
    setActiveWlId(newWl.id);
    setNewWlName('');
    setIsCreatingWl(false);
  };

  // 2. Rename Watchlist
  const handleRenameWatchlist = (wlId) => {
    if (!editingWlName.trim()) {
      setEditingWlId(null);
      return;
    }
    setWatchlists(prev => prev.map(w => w.id === wlId ? { ...w, name: editingWlName.trim() } : w));
    setEditingWlId(null);
    setEditingWlName('');
  };

  // 3. Delete Watchlist
  const handleDeleteWatchlist = (wlId, e) => {
    e?.stopPropagation();
    if (watchlists.length <= 1) {
      alert("You must have at least one active watchlist.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this watchlist?")) {
      const remaining = watchlists.filter(w => w.id !== wlId);
      setWatchlists(remaining);
      if (activeWlId === wlId) {
        setActiveWlId(remaining[0].id);
      }
    }
  };

  // 4. Add Symbol to Active Watchlist
  const handleAddSymbol = (sym) => {
    if (activeWl.symbols.includes(sym)) return;
    setWatchlists(prev => prev.map(w => {
      if (w.id === activeWlId) {
        return { ...w, symbols: [...w.symbols, sym] };
      }
      return w;
    }));
  };

  // 5. Remove Symbol from Active Watchlist
  const handleRemoveSymbol = (sym, e) => {
    e?.stopPropagation();
    setWatchlists(prev => prev.map(w => {
      if (w.id === activeWlId) {
        return { ...w, symbols: w.symbols.filter(s => s !== sym) };
      }
      return w;
    }));
  };

  // 6. Move Symbol UP
  const handleMoveUp = (index, e) => {
    e?.stopPropagation();
    if (index <= 0) return;
    setWatchlists(prev => prev.map(w => {
      if (w.id === activeWlId) {
        const copy = [...w.symbols];
        const temp = copy[index - 1];
        copy[index - 1] = copy[index];
        copy[index] = temp;
        return { ...w, symbols: copy };
      }
      return w;
    }));
  };

  // 7. Move Symbol DOWN
  const handleMoveDown = (index, e) => {
    e?.stopPropagation();
    if (index >= activeWl.symbols.length - 1) return;
    setWatchlists(prev => prev.map(w => {
      if (w.id === activeWlId) {
        const copy = [...w.symbols];
        const temp = copy[index + 1];
        copy[index + 1] = copy[index];
        copy[index] = temp;
        return { ...w, symbols: copy };
      }
      return w;
    }));
  };

  // 8. Restore Defaults
  const handleRestoreDefaults = () => {
    if (window.confirm("Reset all watchlists to default presets?")) {
      setWatchlists(DEFAULT_WATCHLISTS);
      setActiveWlId('wl-1');
      setIsEditing(false);
    }
  };

  return (
    <div className={`bg-white dark:bg-surface-darkPanel flex flex-col h-full overflow-hidden w-full ${
      isDesktopSidebar ? 'rounded-none border-0' : 'rounded-2xl border border-gray-200 dark:border-surface-darkBorder shadow-sm max-w-4xl mx-auto'
    }`}>
      
      {/* 1. Indian Broker Search Bar & Header */}
      <div className="p-3.5 sm:p-4 border-b border-gray-100 dark:border-surface-darkBorder flex flex-col gap-3">
        
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search & Add eg. GOLD, SILVER, XAU/USD, AAPL, BTC, NVDA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 text-xs sm:text-[13px] font-normal rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200 dark:border-surface-darkBorder text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Watchlist Tabs & Edit Controls Bar */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 no-scrollbar select-none">
          
          {/* Watchlists Pill List */}
          <div className="flex items-center gap-1.5 min-w-max">
            {watchlists.map(wl => {
              const isActive = wl.id === activeWlId;
              const isRenaming = editingWlId === wl.id;

              if (isRenaming) {
                return (
                  <div key={wl.id} className="flex items-center gap-1 bg-white dark:bg-surface-darkCard border border-blue-500 rounded-lg p-0.5">
                    <input
                      type="text"
                      autoFocus
                      value={editingWlName}
                      onChange={(e) => setEditingWlName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameWatchlist(wl.id)}
                      className="px-2 py-1 text-xs font-medium rounded bg-transparent text-gray-900 dark:text-white focus:outline-none w-24"
                    />
                    <button
                      onClick={() => handleRenameWatchlist(wl.id)}
                      className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={wl.id}
                  onClick={() => {
                    setActiveWlId(wl.id);
                    setSearchQuery('');
                  }}
                  className={`group relative flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkHover'
                  }`}
                >
                  <span>{wl.name}</span>
                  <span className="text-[10px] tabular-nums opacity-75">
                    ({wl.symbols?.length || 0})
                  </span>

                  {/* Actions when in Edit mode */}
                  {isEditing && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingWlId(wl.id);
                          setEditingWlName(wl.name);
                        }}
                        className="p-0.5 hover:bg-black/20 rounded text-white"
                        title="Rename Watchlist"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      {watchlists.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteWatchlist(wl.id, e)}
                          className="p-0.5 hover:bg-rose-500 rounded text-white"
                          title="Delete Watchlist"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add New Watchlist Button */}
            {!isCreatingWl ? (
              <button
                onClick={() => setIsCreatingWl(true)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-dashed border-gray-300 dark:border-surface-darkBorder text-gray-500 hover:text-blue-600 hover:border-blue-500 transition-colors flex items-center gap-1"
                title="Create New Watchlist"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New List</span>
              </button>
            ) : (
              <form onSubmit={handleCreateWatchlist} className="flex items-center gap-1 bg-white dark:bg-surface-darkCard border border-blue-500 rounded-lg p-0.5">
                <input
                  type="text"
                  autoFocus
                  placeholder="List Name"
                  value={newWlName}
                  onChange={(e) => setNewWlName(e.target.value)}
                  className="px-2 py-1 text-xs font-medium rounded bg-transparent text-gray-900 dark:text-white focus:outline-none w-24"
                />
                <button
                  type="submit"
                  className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingWl(false)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            )}
          </div>

          {/* Right Action: Edit Watchlist Toggle */}
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                isEditing
                  ? 'bg-emerald-500 text-white font-semibold'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-darkHover'
              }`}
            >
              {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              <span>{isEditing ? 'Done' : 'Edit'}</span>
            </button>

            {isEditing && (
              <button
                onClick={handleRestoreDefaults}
                className="p-1 text-xs font-medium text-gray-400 hover:text-rose-500 transition-colors"
                title="Reset to default watchlists"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

      </div>

      {/* 2. Search Add Dropdown Mode (When user types a query) */}
      {searchQuery.trim() ? (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-surface-darkBorder">
          <div className="px-4 py-2 bg-gray-50 dark:bg-surface-darkCard/50 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            All Market Results ({searchResults.length}) &bull; Tap &ldquo;+ Add&rdquo; to add to {activeWl.name}
          </div>

          {searchResults.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">
              No market instruments found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            searchResults.map(t => {
              const isAlreadyInWl = activeWl.symbols.includes(t.symbol);
              const isForex5 = ['EUR/USD', 'GBP/USD', 'AUD/USD', 'USD/CAD'].includes(t.symbol);
              const isForex3 = ['USD/JPY', 'USD/INR'].includes(t.symbol);
              const precision = isForex5 ? 5 : (isForex3 ? 3 : (t.price < 5 ? 4 : 2));
              const isPositive = (t.changePercent24h || 0) >= 0;

              return (
                <div
                  key={t.symbol}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-darkHover transition-colors"
                >
                  <div 
                    onClick={() => onSelectSymbol(t)}
                    className="flex flex-col cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[13px] sm:text-sm text-gray-900 dark:text-gray-100">
                        {t.display || t.symbol}
                      </span>
                      <span className="text-[10px] font-normal uppercase text-gray-400 dark:text-gray-500">
                        {t.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 truncate max-w-xs mt-0.5 font-normal">
                      {t.name || t.symbol}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[13px] sm:text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                        ${t.price.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })}
                      </div>
                      <div className={`text-[11px] font-normal tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPositive ? '+' : ''}{t.changePercent24h ? t.changePercent24h.toFixed(2) : '0.00'}%
                      </div>
                    </div>

                    {isAlreadyInWl ? (
                      <span className="px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-500/30 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Added</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddSymbol(t.symbol)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs active:scale-95 transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* 3. Normal Clean Watchlist Items (Indian Broker Kite Style) */
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-surface-darkBorder">
          {currentItems.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3 text-gray-400">
              <div className="text-sm font-medium text-gray-900 dark:text-white">This Watchlist is Empty</div>
              <div className="text-xs text-gray-400 font-normal">Search above to add your favorite stocks, indices, crypto, or forex.</div>
            </div>
          ) : (
            currentItems.map((t, index) => {
              const isSelected = t.symbol === selectedSymbol;
              const isPositive = (t.changePercent24h || 0) >= 0;
              const isForex5 = ['EUR/USD', 'GBP/USD', 'AUD/USD', 'USD/CAD'].includes(t.symbol);
              const isForex3 = ['USD/JPY', 'USD/INR'].includes(t.symbol);
              const precision = isForex5 ? 5 : (isForex3 ? 3 : (t.price < 5 ? 4 : 2));

              const exchange = t.category === 'stock' || t.category === 'index' 
                ? 'NASDAQ' 
                : (t.category === 'crypto' ? 'BINANCE' : (t.category === 'commodity' ? 'COMMODITY' : 'FOREX'));


              return (
                <div
                  key={t.symbol}
                  className={`group flex items-center justify-between px-4 py-3 select-none transition-colors duration-150 ${
                    isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'hover:bg-gray-50/80 dark:hover:bg-surface-darkHover'
                  }`}
                >
                  {/* Left: Symbol Info */}
                  <div
                    onClick={() => {
                      if (!isEditing) {
                        if (isDesktopSidebar && onViewChart) {
                          onViewChart(t.symbol);
                        } else {
                          onSelectSymbol(t);
                        }
                      }
                    }}
                    className={`flex flex-col flex-1 ${!isEditing ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[13px] sm:text-sm text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {t.display || t.symbol}
                      </span>
                      <span className="text-[10px] font-normal uppercase text-gray-400 dark:text-gray-500">
                        {exchange}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[180px] sm:max-w-xs mt-0.5 font-normal">
                      {t.name || t.symbol}
                    </span>
                  </div>

                  {/* Right: Price & Quick Actions */}
                  <div className="flex items-center gap-2.5">
                    
                    {/* Desktop Hover Quick Action Buttons (Zerodha Kite Signature) */}
                    {!isEditing && (
                      <div className="hidden md:group-hover:flex items-center gap-1 animate-in fade-in duration-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenOrderModal) onOpenOrderModal('BUY', t.symbol);
                          }}
                          className="w-7 h-7 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shadow-xs active:scale-90 transition-all flex items-center justify-center"
                          title="Buy (B)"
                        >
                          B
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenOrderModal) onOpenOrderModal('SELL', t.symbol);
                          }}
                          className="w-7 h-7 rounded bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-semibold shadow-xs active:scale-90 transition-all flex items-center justify-center"
                          title="Sell (S)"
                        >
                          S
                        </button>

                        {onViewChart && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewChart(t.symbol);
                            }}
                            className="w-7 h-7 rounded bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkBorder text-gray-700 dark:text-gray-300 shadow-xs active:scale-90 transition-all flex items-center justify-center"
                            title="View Chart"
                          >
                            <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSymbol(t);
                          }}
                          className="w-7 h-7 rounded bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkBorder text-gray-700 dark:text-gray-300 shadow-xs active:scale-90 transition-all flex items-center justify-center"
                          title="Market Depth"
                        >
                          <Layers className="w-3.5 h-3.5 text-cyan-500" />
                        </button>
                      </div>
                    )}

                    {/* Live Price & Static Green/Red Change Text (Hidden on Desktop hover when buttons show, or always visible) */}
                    <div 
                      onClick={() => !isEditing && onSelectSymbol(t)}
                      className={`${!isEditing ? 'cursor-pointer' : ''} ${!isEditing ? 'md:group-hover:hidden' : ''} text-right`}
                    >
                      <div className="text-[13px] sm:text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                        ${Number(t.price || 0).toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })}
                      </div>
                      <div className={`text-[11px] font-normal tabular-nums flex items-center justify-end gap-0.5 mt-0.5 ${
                        isPositive ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {isPositive ? '+' : ''}{Number(t.changePercent24h || 0).toFixed(2)}%
                      </div>
                    </div>

                    {/* Manage Controls: Move Up / Down & Delete (When Editing) */}
                    {isEditing ? (
                      <div className="flex items-center gap-1 pl-2 border-l border-gray-200 dark:border-surface-darkBorder">
                        <button
                          onClick={(e) => handleMoveUp(index, e)}
                          disabled={index === 0}
                          className={`p-1.5 rounded-lg border border-gray-200 dark:border-surface-darkBorder ${
                            index === 0 ? 'opacity-30 cursor-not-allowed text-gray-400' : 'hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-700 dark:text-gray-200'
                          }`}
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => handleMoveDown(index, e)}
                          disabled={index === activeWl.symbols.length - 1}
                          className={`p-1.5 rounded-lg border border-gray-200 dark:border-surface-darkBorder ${
                            index === activeWl.symbols.length - 1 ? 'opacity-30 cursor-not-allowed text-gray-400' : 'hover:bg-gray-100 dark:hover:bg-surface-darkHover text-gray-700 dark:text-gray-200'
                          }`}
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => handleRemoveSymbol(t.symbol, e)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 transition-colors ml-1"
                          title="Remove from Watchlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <ChevronRight 
                        onClick={() => onSelectSymbol(t)}
                        className="w-4 h-4 text-gray-300 dark:text-gray-600 cursor-pointer md:hidden" 
                      />
                    )}

                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* Watchlist Footer Note */}
      <div className="p-3 bg-gray-50 dark:bg-surface-darkCard/50 border-t border-gray-100 dark:border-surface-darkBorder text-center text-[11px] text-gray-400 font-normal flex items-center justify-between px-4">
        <span>{activeWl.name} &bull; {activeWl.symbols?.length || 0} Instruments</span>
        <span>Tap item to open 5-Depth & Buy/Sell &bull; Click &ldquo;Edit&rdquo; to reorder</span>
      </div>

    </div>
  );
}

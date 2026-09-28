import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ChevronLeft,
  RotateCcw,
  Sparkles,
  BarChart2,
  Layers,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
  Hand
} from 'lucide-react';
import { NumberTicker } from './magicui/NumberTicker';

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

const FALLBACK_BASE_PRICES = {
  'SPY': 560.50,
  'QQQ': 485.20,
  '^GSPC': 5650.00,
  '^IXIC': 17750.00,
  'AAPL': 225.50,
  'TSLA': 248.30,
  'NVDA': 118.80,
  'MSFT': 428.10,
  'AMZN': 186.40,
  'GOOGL': 162.70,
  'META': 512.90,
  'AMD': 154.20,
  'BTCUSDT': 63400.00,
  'ETHUSDT': 2620.00,
  'SOLUSDT': 145.50,
  'BNBUSDT': 585.00,
  'XRPUSDT': 0.5890,
  'DOGEUSDT': 0.1085,
  'ADAUSDT': 0.3540,
  'AVAXUSDT': 27.80,
  'XAU/USD': 2620.00,
  'XAG/USD': 31.50,
  'GLD': 242.00,
  'SLV': 28.80,
  'EUR/USD': 1.1160,
  'GBP/USD': 1.3320,
  'USD/JPY': 143.85,
  'USD/INR': 83.55,
  'AUD/USD': 0.6810,
  'USD/CAD': 1.3570
};

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

  // Swipe & Slide Animation State
  const [slideAnim, setSlideAnim] = useState(''); // CSS animation class
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchOffset, setTouchOffset] = useState(0);
  const tabRefs = useRef({});

  // Real-time tick flash highlight state ('up' | 'down')
  const [tickFlashes, setTickFlashes] = useState({});
  const prevPricesRef = useRef({});

  // Persist watchlists to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('zerotrade_user_watchlists', JSON.stringify(watchlists));
    } catch (e) {
      console.error("Error saving watchlists:", e);
    }
  }, [watchlists]);

  // Track real-time price tick changes for up/down flash
  useEffect(() => {
    const updates = {};
    tickers.forEach(t => {
      const prev = prevPricesRef.current[t.symbol];
      if (prev !== undefined && t.price !== undefined && t.price !== prev) {
        if (t.price > prev) {
          updates[t.symbol] = 'up';
        } else if (t.price < prev) {
          updates[t.symbol] = 'down';
        }
      }
      prevPricesRef.current[t.symbol] = t.price;
    });

    if (Object.keys(updates).length > 0) {
      setTickFlashes(prev => ({ ...prev, ...updates }));
      const timer = setTimeout(() => {
        setTickFlashes(prev => {
          const copy = { ...prev };
          Object.keys(updates).forEach(k => delete copy[k]);
          return copy;
        });
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [tickers]);

  // Current active watchlist index & object
  const activeWlIndex = useMemo(() => {
    const idx = watchlists.findIndex(w => w.id === activeWlId);
    return idx >= 0 ? idx : 0;
  }, [watchlists, activeWlId]);

  const activeWl = watchlists[activeWlIndex] || watchlists[0] || { id: 'wl-1', name: 'Watchlist 1', symbols: [] };

  // Switch watchlist with smooth slide animation and auto-scroll tab into view
  const switchWatchlist = (targetId, direction = 'fade') => {
    let animClass = 'animate-in fade-in duration-150';
    if (direction === 'next') {
      animClass = 'animate-in fade-in slide-in-from-right-8 duration-200';
    } else if (direction === 'prev') {
      animClass = 'animate-in fade-in slide-in-from-left-8 duration-200';
    }
    setSlideAnim(animClass);
    setActiveWlId(targetId);
    setSearchQuery('');
    
    // Auto-scroll the active tab into the center of the tab strip
    setTimeout(() => {
      if (tabRefs.current[targetId]) {
        tabRefs.current[targetId].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 50);
  };

  const goToNextWatchlist = () => {
    if (watchlists.length <= 1) return;
    const nextIdx = (activeWlIndex + 1) % watchlists.length;
    switchWatchlist(watchlists[nextIdx].id, 'next');
  };

  const goToPrevWatchlist = () => {
    if (watchlists.length <= 1) return;
    const prevIdx = (activeWlIndex - 1 + watchlists.length) % watchlists.length;
    switchWatchlist(watchlists[prevIdx].id, 'prev');
  };

  // --- Touch Gestures for Smooth Horizontal Swipe ---
  const handleTouchStart = (e) => {
    if (isEditing || searchQuery) return;
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setTouchOffset(0);
  };

  const handleTouchMove = (e) => {
    if (touchStartX === null || touchStartY === null || isEditing || searchQuery) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Check if horizontal swipe intent dominates vertical scroll
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      setTouchOffset(Math.max(-70, Math.min(70, deltaX * 0.35)));
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null || touchStartY === null || isEditing || searchQuery) {
      setTouchStartX(null);
      setTouchStartY(null);
      setTouchOffset(0);
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Minimum swipe threshold 40px, ensure horizontal movement
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      if (deltaX < 0) {
        // User swiped LEFT -> Switch to NEXT Watchlist
        goToNextWatchlist();
      } else {
        // User swiped RIGHT -> Switch to PREVIOUS Watchlist
        goToPrevWatchlist();
      }
    }

    setTouchStartX(null);
    setTouchStartY(null);
    setTouchOffset(0);
  };

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
        price: FALLBACK_BASE_PRICES[sym] || 100.0,
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
    switchWatchlist(newWl.id, 'next');
    setNewWlName('');
    setIsCreatingWl(false);
  };

  const handleRenameWatchlist = (wlId) => {
    if (!editingWlName.trim()) {
      setEditingWlId(null);
      return;
    }
    setWatchlists(prev => prev.map(w => w.id === wlId ? { ...w, name: editingWlName.trim() } : w));
    setEditingWlId(null);
    setEditingWlName('');
  };

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
        switchWatchlist(remaining[0].id, 'prev');
      }
    }
  };

  const handleAddSymbol = (sym) => {
    if (activeWl.symbols.includes(sym)) return;
    setWatchlists(prev => prev.map(w => {
      if (w.id === activeWlId) {
        return { ...w, symbols: [...w.symbols, sym] };
      }
      return w;
    }));
  };

  const handleRemoveSymbol = (sym, e) => {
    e?.stopPropagation();
    setWatchlists(prev => prev.map(w => {
      if (w.id === activeWlId) {
        return { ...w, symbols: w.symbols.filter(s => s !== sym) };
      }
      return w;
    }));
  };

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

  const handleRestoreDefaults = () => {
    if (window.confirm("Reset all watchlists to default presets?")) {
      setWatchlists(DEFAULT_WATCHLISTS);
      switchWatchlist('wl-1');
      setIsEditing(false);
    }
  };

  return (
    <div 
      className={`bg-white dark:bg-surface-darkPanel flex flex-col h-full overflow-hidden w-full select-none ${
        isDesktopSidebar ? 'rounded-none border-0' : 'rounded-2xl border border-gray-200 dark:border-surface-darkBorder shadow-sm max-w-4xl mx-auto'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      
      {/* ========================================================================= */}
      {/* 1. SEARCH BAR & HEADER CONTROLS                                           */}
      {/* ========================================================================= */}
      <div className="p-3.5 sm:p-4 border-b border-gray-100 dark:border-surface-darkBorder flex flex-col gap-2.5">
        
        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search & Add eg. GOLD, SILVER, SPY, AAPL, BTC, NVDA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-[13px] font-normal rounded-xl bg-gray-50 dark:bg-surface-darkCard border border-gray-200/80 dark:border-surface-darkBorder text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Watchlist Tabs Strip & Controls */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          
          {/* Watchlists Tab Pill List */}
          <div className="flex items-center gap-1.5 min-w-max">
            {watchlists.map((wl, idx) => {
              const isActive = wl.id === activeWlId;
              const isRenaming = editingWlId === wl.id;

              if (isRenaming) {
                return (
                  <div key={wl.id} className="flex items-center gap-1 bg-white dark:bg-surface-darkCard border border-blue-500 rounded-xl p-0.5 shadow-sm">
                    <input
                      type="text"
                      autoFocus
                      value={editingWlName}
                      onChange={(e) => setEditingWlName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameWatchlist(wl.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none w-24"
                    />
                    <button
                      onClick={() => handleRenameWatchlist(wl.id)}
                      className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={wl.id}
                  ref={(el) => (tabRefs.current[wl.id] = el)}
                  onClick={() => switchWatchlist(wl.id, idx > activeWlIndex ? 'next' : idx < activeWlIndex ? 'prev' : 'fade')}
                  className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl transition-all font-medium active:scale-95 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkHover'
                  }`}
                >
                  <span>{wl.name}</span>
                  <span className={`text-[10px] tabular-nums ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                    ({wl.symbols?.length || 0})
                  </span>

                  {/* Actions when in Edit mode */}
                  {isEditing && (
                    <div className="flex items-center gap-1 ml-1">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingWlId(wl.id);
                          setEditingWlName(wl.name);
                        }}
                        className="p-0.5 hover:bg-black/20 rounded text-white"
                        title="Rename"
                      >
                        <Edit3 className="w-3 h-3" />
                      </span>
                      {watchlists.length > 1 && (
                        <span
                          onClick={(e) => handleDeleteWatchlist(wl.id, e)}
                          className="p-0.5 hover:bg-rose-500 rounded text-white"
                          title="Delete"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}

            {/* Add New Watchlist Button */}
            {!isCreatingWl ? (
              <button
                onClick={() => setIsCreatingWl(true)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-dashed border-gray-300 dark:border-surface-darkBorder text-gray-500 hover:text-blue-600 hover:border-blue-500 transition-all flex items-center gap-1 active:scale-95"
                title="Create New Watchlist"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New List</span>
              </button>
            ) : (
              <form onSubmit={handleCreateWatchlist} className="flex items-center gap-1 bg-white dark:bg-surface-darkCard border border-blue-500 rounded-xl p-0.5 shadow-sm">
                <input
                  type="text"
                  autoFocus
                  placeholder="List Name"
                  value={newWlName}
                  onChange={(e) => setNewWlName(e.target.value)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none w-24"
                />
                <button
                  type="submit"
                  className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingWl(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>

          {/* Right Action: Edit Toggle & Reset */}
          <div className="flex items-center gap-1 min-w-max">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-2.5 py-1 text-xs rounded-xl transition-all flex items-center gap-1 active:scale-95 ${
                isEditing
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-darkHover'
              }`}
            >
              {isEditing ? <Check className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
              <span className="text-[11px] font-medium">{isEditing ? 'Done' : 'Manage'}</span>
            </button>

            {isEditing && (
              <button
                onClick={handleRestoreDefaults}
                className="p-1.5 text-xs rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Reset to default watchlists"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Swipe Navigation Hint Header Bar */}
        <div className="md:hidden flex items-center justify-between text-[11px] text-gray-400 px-1 pt-0.5">
          <button 
            onClick={goToPrevWatchlist}
            className="flex items-center gap-0.5 text-gray-400 hover:text-blue-500 active:scale-90 transition-transform"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>
          
          <div className="flex items-center gap-1.5">
            {watchlists.map((w, idx) => (
              <span 
                key={w.id}
                onClick={() => switchWatchlist(w.id, idx > activeWlIndex ? 'next' : 'prev')}
                className={`transition-all rounded-full cursor-pointer ${
                  idx === activeWlIndex
                    ? 'w-4 h-1.5 bg-blue-600'
                    : 'w-1.5 h-1.5 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          <button 
            onClick={goToNextWatchlist}
            className="flex items-center gap-0.5 text-gray-400 hover:text-blue-500 active:scale-90 transition-transform"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. WATCHLIST ITEMS LIST (WITH SWIPE & SLIDE ANIMATIONS)                    */}
      {/* ========================================================================= */}
      {searchQuery && searchResults.length > 0 ? (
        /* Global Search Results (Add Instruments to Watchlist) */
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-surface-darkBorder p-1">
          <div className="p-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-surface-darkCard/40">
            Market Search Results ({searchResults.length})
          </div>
          {searchResults.map(t => {
            const isAlreadyInWl = activeWl.symbols.includes(t.symbol);
            const isPositive = (t.changePercent24h || 0) >= 0;
            const precision = (t.category === 'forex' || t.price < 5) ? 4 : 2;

            return (
              <div 
                key={t.symbol}
                className="flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-surface-darkHover transition-colors select-none"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{t.display || t.symbol}</span>
                    <span className="text-[10px] uppercase font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-surface-darkCard text-gray-500">
                      {t.category || 'Stock'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 font-normal truncate max-w-[200px]">
                    {t.name || t.symbol}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      ${Number(t.price || 0).toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })}
                    </div>
                    <div className={`text-[11px] font-medium tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isPositive ? '+' : ''}{Number(t.changePercent24h || 0).toFixed(2)}%
                    </div>
                  </div>

                  {isAlreadyInWl ? (
                    <span className="px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Added</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddSymbol(t.symbol)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Normal Watchlist Items (Slide animated & Touch interactive) */
        <div 
          style={{ transform: touchOffset ? `translateX(${touchOffset}px)` : undefined }}
          className={`flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-surface-darkBorder transition-transform ${slideAnim}`}
        >
          {currentItems.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3 text-gray-400">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-surface-darkCard flex items-center justify-center text-gray-400">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">This Watchlist is Empty</div>
                <div className="text-xs text-gray-400 font-normal mt-1">Search above to add stocks, crypto, commodities, or forex.</div>
              </div>
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

              const flashStatus = tickFlashes[t.symbol]; // 'up' | 'down' | undefined

              return (
                <div
                  key={t.symbol}
                  className={`group flex items-center justify-between px-3.5 sm:px-4 py-3 select-none transition-colors duration-150 ${
                    isSelected ? 'bg-blue-50/50 dark:bg-blue-950/30' : 'hover:bg-gray-50/80 dark:hover:bg-surface-darkHover'
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
                    className={`flex flex-col flex-1 min-w-0 pr-2 ${!isEditing ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[13px] sm:text-sm text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {t.display || t.symbol}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-gray-100 dark:bg-surface-darkCard text-gray-500 border border-gray-200/60 dark:border-surface-darkBorder">
                        {exchange}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[170px] sm:max-w-xs mt-0.5 font-normal">
                      {t.name || t.symbol}
                    </span>
                  </div>

                  {/* Right: Live Price & Quick Actions */}
                  <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                    
                    {/* Desktop Hover Quick Action Buttons (Zerodha Kite Signature) */}
                    {!isEditing && (
                      <div className="hidden md:group-hover:flex items-center gap-1 animate-in fade-in duration-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenOrderModal) onOpenOrderModal('BUY', t.symbol);
                          }}
                          className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs active:scale-90 transition-all flex items-center justify-center"
                          title="Buy (B)"
                        >
                          B
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenOrderModal) onOpenOrderModal('SELL', t.symbol);
                          }}
                          className="w-7 h-7 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold shadow-xs active:scale-90 transition-all flex items-center justify-center"
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
                            className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkBorder text-gray-700 dark:text-gray-300 shadow-xs active:scale-90 transition-all flex items-center justify-center"
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
                          className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-surface-darkCard hover:bg-gray-200 dark:hover:bg-surface-darkBorder text-gray-700 dark:text-gray-300 shadow-xs active:scale-90 transition-all flex items-center justify-center"
                          title="Market Depth"
                        >
                          <Layers className="w-3.5 h-3.5 text-cyan-500" />
                        </button>
                      </div>
                    )}

                    {/* Live Price with Real-time Tick Glow Effect */}
                    <div 
                      onClick={() => !isEditing && onSelectSymbol(t)}
                      className={`${!isEditing ? 'cursor-pointer' : ''} ${!isEditing ? 'md:group-hover:hidden' : ''} text-right`}
                    >
                      <div className={`text-[13px] sm:text-sm font-semibold tabular-nums transition-colors duration-300 ${
                        flashStatus === 'up' 
                          ? 'text-emerald-500 font-bold drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                          : flashStatus === 'down'
                            ? 'text-rose-500 font-bold drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                            : 'text-gray-900 dark:text-white'
                      }`}>
                        <NumberTicker value={Number(t.price || 0)} decimalPlaces={precision} prefix="$" />
                      </div>
                      <div className={`text-[11px] font-semibold tabular-nums flex items-center justify-end gap-0.5 mt-0.5 ${
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

      {/* ========================================================================= */}
      {/* 3. SIGNATURE NUMBERED FOOTER BAR (ZERODHA KITE 1-7 WATCHLIST STYLE)       */}
      {/* ========================================================================= */}
      <div className="p-2.5 bg-gray-50/90 dark:bg-surface-darkCard/50 border-t border-gray-100 dark:border-surface-darkBorder flex items-center justify-between px-3.5">
        
        {/* Left: Numbered quick-switch pills 1, 2, 3, 4, 5... */}
        <div className="flex items-center gap-1.5">
          {watchlists.map((wl, idx) => {
            const isActive = wl.id === activeWlId;
            return (
              <button
                key={wl.id}
                onClick={() => switchWatchlist(wl.id, idx > activeWlIndex ? 'next' : 'prev')}
                className={`w-6 h-6 rounded-lg text-xs font-semibold tabular-nums flex items-center justify-center transition-all active:scale-90 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-surface-darkPanel text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-surface-darkBorder'
                }`}
                title={wl.name}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Right: Instruments counter and swipe hint */}
        <div className="text-[11px] text-gray-400 font-medium flex items-center gap-2">
          <span className="hidden sm:inline">{activeWl.name} &bull;</span>
          <span>{activeWl.symbols?.length || 0} items</span>
          <span className="hidden md:inline">&bull; Swipe ‹ › to switch</span>
        </div>

      </div>

    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navbar';
import Watchlist from './components/Watchlist';
import CandleChart from './components/CandleChart';
import PortfolioView from './components/PortfolioView';
import OrdersLog from './components/OrdersLog';
import OptionChain from './components/OptionChain';
import QuoteSheet from './components/QuoteSheet';
import OrderModal from './components/OrderModal';
import AccountView from './components/AccountView';
import LeaderboardModal from './components/LeaderboardModal';
import AuthModal from './components/AuthModal';
import BillingModal from './components/BillingModal';
import InstallAppModal from './components/InstallAppModal';
import InstallAppBanner from './components/InstallAppBanner';
import Toast from './components/Toast';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['watchlist', 'chart', 'options', 'orders', 'portfolio', 'account'];
      if (validTabs.includes(hash)) return hash;
      const paramTab = new URLSearchParams(window.location.search).get('tab');
      if (validTabs.includes(paramTab)) return paramTab;
    } catch (e) {
      // ignore
    }
    return 'watchlist';
  });

  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [tickers, setTickers] = useState([]);
  const [lastTick, setLastTick] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const [portfolio, setPortfolio] = useState(null);
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('zerotrade_theme') || 'dark');
  const [lastOrderUpdate, setLastOrderUpdate] = useState(Date.now());

  // Interactive Bottom Sheets & Modals
  const [selectedQuoteTicker, setSelectedQuoteTicker] = useState(null);
  const [orderModalConfig, setOrderModalConfig] = useState({
    isOpen: false,
    side: 'BUY',
    symbol: 'SPY',
    contractInfo: null
  });

  const [billingConfig, setBillingConfig] = useState({
    isOpen: false,
    initialPlanId: 'reset_10k'
  });

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [toast, setToast] = useState(null);

  const wsRef = useRef(null);

  // Synchronized refs for popstate listener to prevent stale state closures
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const modalsRef = useRef({
    quote: selectedQuoteTicker,
    order: orderModalConfig.isOpen,
    billing: billingConfig.isOpen,
    auth: isAuthOpen,
    leaderboard: isLeaderboardOpen,
    install: isInstallModalOpen
  });
  modalsRef.current = {
    quote: selectedQuoteTicker,
    order: orderModalConfig.isOpen,
    billing: billingConfig.isOpen,
    auth: isAuthOpen,
    leaderboard: isLeaderboardOpen,
    install: isInstallModalOpen
  };

  // =========================================================================
  // 1. PWA 'beforeinstallprompt' & Service Worker Event Setup
  // =========================================================================
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // =========================================================================
  // 2. Mobile Back-Button Navigation & History State Handling
  // =========================================================================
  const handleTabChange = useCallback((newTab) => {
    if (newTab === activeTabRef.current) return;

    if (newTab === 'watchlist') {
      window.history.replaceState({ tab: 'watchlist', depth: 0 }, '', window.location.pathname);
      setActiveTab('watchlist');
    } else {
      if (activeTabRef.current === 'watchlist') {
        window.history.pushState({ tab: newTab, depth: 1 }, '', '#' + newTab);
      } else {
        window.history.replaceState({ tab: newTab, depth: 1 }, '', '#' + newTab);
      }
      setActiveTab(newTab);
    }
  }, []);

  useEffect(() => {
    // Set initial baseline state in history
    if (!window.history.state) {
      if (activeTab === 'watchlist') {
        window.history.replaceState({ tab: 'watchlist', depth: 0 }, '', window.location.pathname);
      } else {
        window.history.replaceState({ tab: activeTab, depth: 1 }, '', '#' + activeTab);
      }
    }

    const handlePopState = (event) => {
      const m = modalsRef.current;

      // Priority 1: Close open bottom sheets or modals first
      if (m.order) {
        setOrderModalConfig(prev => ({ ...prev, isOpen: false }));
        return;
      }
      if (m.quote) {
        setSelectedQuoteTicker(null);
        return;
      }
      if (m.billing) {
        setBillingConfig(prev => ({ ...prev, isOpen: false }));
        return;
      }
      if (m.auth) {
        setIsAuthOpen(false);
        return;
      }
      if (m.leaderboard) {
        setIsLeaderboardOpen(false);
        return;
      }
      if (m.install) {
        setIsInstallModalOpen(false);
        return;
      }

      // Priority 2: If user is on any sub-tab (Orders, Portfolio, Options, Chart, Account)
      // and clicks Back, return to Watchlist (home landing tab).
      if (activeTabRef.current !== 'watchlist') {
        setActiveTab('watchlist');
        window.history.replaceState({ tab: 'watchlist', depth: 0 }, '', window.location.pathname);
        return;
      }

      // Priority 3: User is already on Watchlist and presses Back again ->
      // Natural browser back action executes, closing or exiting the site.
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

  // Modal Push State Helper
  const pushModalHistory = (modalName) => {
    window.history.pushState({ tab: activeTabRef.current, modal: modalName, depth: 2 }, '', '#' + modalName);
  };

  // Theme synchronization
  useEffect(() => {
    localStorage.setItem('zerotrade_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const showToast = (toastObj) => {
    setToast(toastObj);
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Check current authenticated user
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('zerotrade_token');
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('zerotrade_token');
        setUser(null);
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    }
  }, []);

  // Fetch portfolio state
  const loadPortfolio = useCallback(async () => {
    const token = localStorage.getItem('zerotrade_token');
    try {
      const res = await fetch('/api/portfolio', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      }
    } catch (e) {
      console.error("Failed to load portfolio:", e);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    loadPortfolio();
  }, [checkAuth, loadPortfolio]);

  // Periodic portfolio poll
  useEffect(() => {
    const interval = setInterval(loadPortfolio, 4000);
    return () => clearInterval(interval);
  }, [loadPortfolio]);

  // Real-time WebSocket connection
  useEffect(() => {
    let reconnectTimeout = null;

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/stream`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SNAPSHOT') {
            setTickers(msg.tickers || []);
          } else if (msg.type === 'TICK' && msg.ticker) {
            const t = msg.ticker;
            setTickers(prev => {
              const index = prev.findIndex(p => p.symbol === t.symbol);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = { ...updated[index], ...t };
                return updated;
              }
              return [...prev, t];
            });

            setLastTick(t);
          }
        } catch (e) {
          // ignore
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Close position
  const handleClosePosition = async (pos) => {
    try {
      const token = localStorage.getItem('zerotrade_token');
      const isShort = pos.side === 'SHORT' || pos.quantity < 0;
      const side = isShort ? 'BUY' : 'SELL';
      const qty = Math.abs(pos.quantity);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          symbol: pos.symbol,
          side: side,
          order_type: 'MARKET',
          quantity: qty,
          price: pos.currentPrice || pos.avgEntryPrice
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to close position');

      showToast({
        type: 'success',
        title: isShort ? 'Short Covered' : 'Position Closed',
        message: `${isShort ? 'Covered' : 'Sold'} ${qty} ${pos.symbol} @ $${data.fillPrice}. Realized P&L: $${data.realizedPnl}`
      });

      loadPortfolio();
      setLastOrderUpdate(Date.now());
    } catch (e) {
      showToast({ type: 'error', title: 'Close Failed', message: e.message });
    }
  };

  // Cancel limit order
  const handleCancelOrder = async (orderId) => {
    try {
      const token = localStorage.getItem('zerotrade_token');
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to cancel order');

      showToast({
        type: 'info',
        title: 'Order Cancelled',
        message: `Limit order #${orderId} was cancelled and funds refunded.`
      });

      loadPortfolio();
      setLastOrderUpdate(Date.now());
    } catch (e) {
      showToast({ type: 'error', title: 'Cancel Failed', message: e.message });
      throw e;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zerotrade_token');
    setUser(null);
    loadPortfolio();
    showToast({
      type: 'info',
      title: 'Signed Out',
      message: 'You are now browsing in public practice mode.'
    });
  };

  const activeTicker = tickers.find(t => t.symbol === selectedSymbol) || {
    symbol: selectedSymbol,
    price: 100.0,
    changePercent24h: 0.0,
    category: 'stock'
  };

  // Quick action: Open Order Modal from anywhere
  const openOrderModal = (side, sym = selectedSymbol, contractInfo = null) => {
    setSelectedSymbol(sym);
    pushModalHistory('order');
    setOrderModalConfig({
      isOpen: true,
      side: side,
      symbol: sym,
      contractInfo: contractInfo
    });
  };

  const openQuoteSheet = (ticker) => {
    pushModalHistory('quote');
    setSelectedQuoteTicker(ticker);
  };

  const openBillingModal = (planId) => {
    pushModalHistory('billing');
    setBillingConfig({ isOpen: true, initialPlanId: planId || 'reset_10k' });
  };

  const openLeaderboard = () => {
    pushModalHistory('leaderboard');
    setIsLeaderboardOpen(true);
  };

  const openAuth = () => {
    pushModalHistory('auth');
    setIsAuthOpen(true);
  };

  const openInstallModal = () => {
    pushModalHistory('install');
    setIsInstallModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-darkBg text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200 pb-16 md:pb-0">
      
      {/* 1. Top Navigation Bar (Indian Broker Style with Ticker Tape) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        portfolio={portfolio}
        user={user}
        tickers={tickers}
        onOpenBillingModal={openBillingModal}
        onOpenLeaderboard={openLeaderboard}
        onOpenAuth={openAuth}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
        wsConnected={wsConnected}
      />

      {/* Floating Mobile PWA Install Banner */}
      <InstallAppBanner onOpenInstallModal={openInstallModal} />

      {/* ========================================================================= */}
      {/* 2. DESKTOP WORKSPACE (Zerodha Kite 2-Pane Split Terminal Layout)          */}
      {/* ========================================================================= */}
      <div className="hidden md:flex flex-1 overflow-hidden w-full h-[calc(100vh-56px)]">
        
        {/* Left Column: Persistent Docked Watchlist */}
        <div className="w-[360px] lg:w-[400px] shrink-0 border-r border-gray-200 dark:border-surface-darkBorder h-full bg-white dark:bg-surface-darkPanel flex flex-col overflow-hidden">
          <Watchlist
            tickers={tickers}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={openQuoteSheet}
            onViewChart={(sym) => {
              setSelectedSymbol(sym);
              if (activeTab === 'watchlist') handleTabChange('chart');
            }}
            onOpenOrderModal={(side, sym) => openOrderModal(side, sym)}
            isDesktopSidebar={true}
          />
        </div>

        {/* Right Column: Main Active Workspace Panel */}
        <div className="flex-1 h-full overflow-y-auto p-4 lg:p-6 bg-gray-50 dark:bg-surface-darkBg flex flex-col">
          
          {/* TAB: CHART (DEFAULT / HOME) */}
          {(activeTab === 'chart' || activeTab === 'watchlist') && (
            <div className="w-full max-w-6xl mx-auto flex flex-col gap-4">
              <CandleChart
                symbol={selectedSymbol}
                activeTicker={activeTicker}
                theme={theme}
                lastTick={lastTick}
                onOpenOptionChain={() => handleTabChange('options')}
                onOpenOrderModal={(side) => openOrderModal(side, selectedSymbol)}
              />
            </div>
          )}

          {/* TAB: F&O OPTION CHAIN */}
          {activeTab === 'options' && (
            <div className="w-full max-w-6xl mx-auto">
              <OptionChain
                onSelectOptionToTrade={(opt) => {
                  openOrderModal(opt.side || 'BUY', opt.underlying, {
                    type: opt.type,
                    strike: opt.strike,
                    expiry: opt.expiry,
                    price: opt.price
                  });
                }}
              />
            </div>
          )}

          {/* TAB: ORDERS */}
          {activeTab === 'orders' && (
            <div className="w-full max-w-5xl mx-auto">
              <OrdersLog
                onCancelOrder={handleCancelOrder}
                onReorder={(ord) => {
                  openOrderModal(ord.side || 'BUY', ord.symbol);
                }}
                onOrderModified={() => {
                  loadPortfolio();
                  setLastOrderUpdate(Date.now());
                }}
                onShowToast={showToast}
                lastOrderUpdate={lastOrderUpdate}
              />
            </div>
          )}

          {/* TAB: PORTFOLIO */}
          {activeTab === 'portfolio' && (
            <div className="w-full max-w-5xl mx-auto">
              <PortfolioView
                portfolio={portfolio}
                tickers={tickers}
                onClosePosition={handleClosePosition}
                onOpenBillingModal={openBillingModal}
                onSelectSymbol={(sym) => {
                  setSelectedSymbol(sym);
                  handleTabChange('chart');
                }}
                onOpenOptionChain={(sym) => {
                  setSelectedSymbol(sym);
                  handleTabChange('options');
                }}
                onOpenOrderModal={(side, sym) => openOrderModal(side, sym)}
              />
            </div>
          )}

          {/* TAB: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="w-full max-w-4xl mx-auto">
              <AccountView
                user={user}
                portfolio={portfolio}
                onOpenBillingModal={openBillingModal}
                onOpenLeaderboard={openLeaderboard}
                onOpenAuth={openAuth}
                onLogout={handleLogout}
                theme={theme}
                toggleTheme={toggleTheme}
                onOpenInstallModal={openInstallModal}
              />
            </div>
          )}

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. MOBILE WORKSPACE (100% PRESERVED & SMOOTH MOBILE UX)                    */}
      {/* ========================================================================= */}
      <main className="md:hidden flex-1 p-3 w-full flex flex-col">
        
        {/* TAB 1: WATCHLIST (HOME) */}
        {activeTab === 'watchlist' && (
          <Watchlist
            tickers={tickers}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={openQuoteSheet}
            onViewChart={(sym) => {
              setSelectedSymbol(sym);
              handleTabChange('chart');
            }}
            onOpenOrderModal={(side, sym) => openOrderModal(side, sym)}
            isDesktopSidebar={false}
          />
        )}

        {/* TAB 2: FULL CHART & DIRECT TRADE */}
        {activeTab === 'chart' && (
          <CandleChart
            symbol={selectedSymbol}
            activeTicker={activeTicker}
            theme={theme}
            lastTick={lastTick}
            onOpenOptionChain={() => handleTabChange('options')}
            onOpenOrderModal={(side) => openOrderModal(side, selectedSymbol)}
          />
        )}

        {/* TAB 3: OPTION CHAIN (F&O S&P / NASDAQ / STOCKS) */}
        {activeTab === 'options' && (
          <OptionChain
            onSelectOptionToTrade={(opt) => {
              openOrderModal(opt.side || 'BUY', opt.underlying, {
                type: opt.type,
                strike: opt.strike,
                expiry: opt.expiry,
                price: opt.price
              });
            }}
          />
        )}

        {/* TAB 4: ORDERS (OPEN & EXECUTED) */}
        {activeTab === 'orders' && (
          <OrdersLog
            onCancelOrder={handleCancelOrder}
            onReorder={(ord) => {
              openOrderModal(ord.side || 'BUY', ord.symbol);
            }}
            onOrderModified={() => {
              loadPortfolio();
              setLastOrderUpdate(Date.now());
            }}
            onShowToast={showToast}
            lastOrderUpdate={lastOrderUpdate}
          />
        )}

        {/* TAB 5: PORTFOLIO (POSITIONS & HOLDINGS) */}
        {activeTab === 'portfolio' && (
          <PortfolioView
            portfolio={portfolio}
            tickers={tickers}
            onClosePosition={handleClosePosition}
            onOpenBillingModal={openBillingModal}
            onSelectSymbol={(sym) => {
              setSelectedSymbol(sym);
              handleTabChange('chart');
            }}
            onOpenOptionChain={(sym) => {
              setSelectedSymbol(sym);
              handleTabChange('options');
            }}
            onOpenOrderModal={(side, sym) => openOrderModal(side, sym)}
          />
        )}

        {/* TAB 6: ACCOUNT & FUNDS */}
        {activeTab === 'account' && (
          <AccountView
            user={user}
            portfolio={portfolio}
            onOpenBillingModal={openBillingModal}
            onOpenLeaderboard={openLeaderboard}
            onOpenAuth={openAuth}
            onLogout={handleLogout}
            theme={theme}
            toggleTheme={toggleTheme}
            onOpenInstallModal={openInstallModal}
          />
        )}

      </main>

      {/* Footer Branding */}
      <footer className="hidden md:block border-t border-gray-200 dark:border-surface-darkBorder py-3 px-4 text-center text-xs text-gray-500 dark:text-gray-400 select-none">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>ZeroVega &bull; ZeroBoss Ecosystem</span>
          <span>US Stocks &bull; Crypto (Binance) &bull; Forex (Twelve Data) &bull; Options (CBOE)</span>
          <span className="text-blue-500 font-semibold">100% Simulated Paper Trading Platform</span>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* INTERACTIVE BOTTOM SHEETS & MODALS (Zerodha / Groww Signature)            */}
      {/* ========================================================================= */}

      {/* 1. Indian Broker Quote Bottom Sheet (5-Depth, Buy/Sell, Chart buttons) */}
      <QuoteSheet
        isOpen={!!selectedQuoteTicker}
        onClose={() => setSelectedQuoteTicker(null)}
        ticker={selectedQuoteTicker}
        onOpenOrderModal={(side) => openOrderModal(side, selectedQuoteTicker?.symbol)}
        onViewChart={(sym) => {
          setSelectedSymbol(sym);
          handleTabChange('chart');
        }}
        onOpenOptionChain={(sym) => {
          setSelectedSymbol(sym);
          handleTabChange('options');
        }}
      />

      {/* 2. Indian Broker Order Placement Modal / Bottom Sheet */}
      <OrderModal
        isOpen={orderModalConfig.isOpen}
        onClose={() => setOrderModalConfig(prev => ({ ...prev, isOpen: false }))}
        initialSide={orderModalConfig.side}
        symbol={orderModalConfig.symbol}
        contractInfo={orderModalConfig.contractInfo}
        activeTicker={tickers.find(t => t.symbol === orderModalConfig.symbol) || activeTicker}
        portfolio={portfolio}
        onOrderPlaced={() => {
          loadPortfolio();
          setLastOrderUpdate(Date.now());
        }}
        onShowToast={showToast}
      />

      {/* 3. General Modals */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />

      <BillingModal
        isOpen={billingConfig.isOpen}
        initialPlanId={billingConfig.initialPlanId}
        onClose={() => setBillingConfig(prev => ({ ...prev, isOpen: false }))}
        onOpenAuth={openAuth}
        user={user}
        onPaymentSuccess={(data) => {
          loadPortfolio();
          setLastOrderUpdate(Date.now());
          showToast({
            type: 'success',
            title: 'Plan Activated!',
            message: data.message || 'Payment confirmed and capital updated!'
          });
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => {
          setUser(u);
          loadPortfolio();
          showToast({
            type: 'success',
            title: 'Welcome Trader!',
            message: `Signed in as ${u.displayName || u.email}. Virtual cash: $${u.virtualCash.toLocaleString('en-US')}`
          });
        }}
      />

      {/* 4. PWA App Install Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredInstallPrompt}
        onInstalled={() => {
          setDeferredInstallPrompt(null);
          showToast({
            type: 'success',
            title: 'App Installed!',
            message: 'ZeroVega is now installed on your home screen.'
          });
        }}
      />

      {/* Floating Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

    </div>
  );
}

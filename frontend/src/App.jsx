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
import Toast from './components/Toast';

export default function App() {
  const [activeTab, setActiveTab] = useState('watchlist'); // 'watchlist' | 'chart' | 'options' | 'orders' | 'portfolio' | 'account'
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
  const [toast, setToast] = useState(null);

  const wsRef = useRef(null);

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
    setOrderModalConfig({
      isOpen: true,
      side: side,
      symbol: sym,
      contractInfo: contractInfo
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-darkBg text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200 pb-16 md:pb-0">
      
      {/* 1. Top Navigation Bar (Indian Broker Style with Ticker Tape) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        portfolio={portfolio}
        user={user}
        tickers={tickers}
        onOpenBillingModal={(planId) => setBillingConfig({ isOpen: true, initialPlanId: planId || 'reset_10k' })}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
        wsConnected={wsConnected}
      />

      {/* ========================================================================= */}
      {/* 2. DESKTOP WORKSPACE (Zerodha Kite 2-Pane Split Terminal Layout)          */}
      {/* ========================================================================= */}
      <div className="hidden md:flex flex-1 overflow-hidden w-full h-[calc(100vh-56px)]">
        
        {/* Left Column: Persistent Docked Watchlist */}
        <div className="w-[360px] lg:w-[400px] shrink-0 border-r border-gray-200 dark:border-surface-darkBorder h-full bg-white dark:bg-surface-darkPanel flex flex-col overflow-hidden">
          <Watchlist
            tickers={tickers}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(ticker) => setSelectedQuoteTicker(ticker)}
            onViewChart={(sym) => {
              setSelectedSymbol(sym);
              if (activeTab === 'watchlist') setActiveTab('chart');
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
                onOpenOptionChain={() => setActiveTab('options')}
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
                onOpenBillingModal={(planId) => setBillingConfig({ isOpen: true, initialPlanId: planId || 'reset_10k' })}
                onSelectSymbol={(sym) => {
                  setSelectedSymbol(sym);
                  setActiveTab('chart');
                }}
                onOpenOptionChain={(sym) => {
                  setSelectedSymbol(sym);
                  setActiveTab('options');
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
                onOpenBillingModal={(planId) => setBillingConfig({ isOpen: true, initialPlanId: planId || 'reset_10k' })}
                onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
                onOpenAuth={() => setIsAuthOpen(true)}
                onLogout={handleLogout}
                theme={theme}
                toggleTheme={toggleTheme}
              />
            </div>
          )}

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. MOBILE WORKSPACE (100% PRESERVED & UNCHANGED FOR MOBILE PERFECTION)    */}
      {/* ========================================================================= */}
      <main className="md:hidden flex-1 p-3 w-full flex flex-col">
        
        {/* TAB 1: WATCHLIST (HOME) */}
        {activeTab === 'watchlist' && (
          <Watchlist
            tickers={tickers}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(ticker) => setSelectedQuoteTicker(ticker)}
            onViewChart={(sym) => {
              setSelectedSymbol(sym);
              setActiveTab('chart');
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
            onOpenOptionChain={() => setActiveTab('options')}
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
            onOpenBillingModal={(planId) => setBillingConfig({ isOpen: true, initialPlanId: planId || 'reset_10k' })}
            onSelectSymbol={(sym) => {
              setSelectedSymbol(sym);
              setActiveTab('chart');
            }}
            onOpenOptionChain={(sym) => {
              setSelectedSymbol(sym);
              setActiveTab('options');
            }}
            onOpenOrderModal={(side, sym) => openOrderModal(side, sym)}
          />
        )}

        {/* TAB 6: ACCOUNT & FUNDS */}
        {activeTab === 'account' && (
          <AccountView
            user={user}
            portfolio={portfolio}
            onOpenBillingModal={(planId) => setBillingConfig({ isOpen: true, initialPlanId: planId || 'reset_10k' })}
            onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
            onOpenAuth={() => setIsAuthOpen(true)}
            onLogout={handleLogout}
            theme={theme}
            toggleTheme={toggleTheme}
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
          setActiveTab('chart');
        }}
        onOpenOptionChain={(sym) => {
          setSelectedSymbol(sym);
          setActiveTab('options');
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
        onOpenAuth={() => setIsAuthOpen(true)}
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

      {/* Floating Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

    </div>
  );
}

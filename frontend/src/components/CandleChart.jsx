import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
import { 
  BarChart3, 
  RefreshCw, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  MousePointer2, 
  TrendingUp, 
  Minus, 
  ArrowRight, 
  Trash2, 
  Undo2, 
  Palette, 
  X, 
  Check, 
  Info
} from 'lucide-react';

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '1D', value: '1D' },
];

const INTERVAL_SECONDS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1D': 86400,
};

const DRAWING_COLORS = [
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Gold', hex: '#F59E0B' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Rose', hex: '#EF4444' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'White', hex: '#F8FAFC' }
];

export default function CandleChart({ 
  symbol, 
  activeTicker, 
  theme = 'dark',
  lastTick = null,
  onOpenOptionChain = null,
  onOpenOrderModal = null
}) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastCandleRef = useRef(null);
  const lastVolumeRef = useRef(null);
  const priceLinesMapRef = useRef({});

  const [interval, setInterval] = useState('5m');
  const [legend, setLegend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  // Drawing Tools States
  const [activeTool, setActiveTool] = useState('pointer'); // 'pointer' | 'trendline' | 'ray' | 'hline'
  const [selectedColor, setSelectedColor] = useState('#06B6D4');
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Stored drawings: trendlines (angled lines/rays) and horizontal lines (price lines)
  const [trendLines, setTrendLines] = useState(() => {
    try {
      const saved = localStorage.getItem(`zerovega_trendlines_${symbol}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [horizontalLines, setHorizontalLines] = useState(() => {
    try {
      const saved = localStorage.getItem(`zerovega_hlines_${symbol}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [currentDrawing, setCurrentDrawing] = useState(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 800, height: 480 });
  const [renderCounter, setRenderCounter] = useState(0);

  const isDark = theme === 'dark';

  const isForex5 = ['EUR/USD', 'GBP/USD', 'AUD/USD', 'USD/CAD'].includes(symbol);
  const isForex3 = ['USD/JPY', 'USD/INR'].includes(symbol);
  const precision = isForex5 ? 5 : (isForex3 ? 3 : (activeTicker?.price && activeTicker.price < 5 ? 4 : 2));
  const minMove = isForex5 ? 0.00001 : (isForex3 ? 0.001 : (precision === 4 ? 0.0001 : 0.01));

  // Persist drawings per symbol
  useEffect(() => {
    try {
      localStorage.setItem(`zerovega_trendlines_${symbol}`, JSON.stringify(trendLines));
    } catch (e) {}
  }, [trendLines, symbol]);

  useEffect(() => {
    try {
      localStorage.setItem(`zerovega_hlines_${symbol}`, JSON.stringify(horizontalLines));
    } catch (e) {}
  }, [horizontalLines, symbol]);

  // Load symbol-specific drawings on symbol change
  useEffect(() => {
    try {
      const savedT = localStorage.getItem(`zerovega_trendlines_${symbol}`);
      setTrendLines(savedT ? JSON.parse(savedT) : []);
      const savedH = localStorage.getItem(`zerovega_hlines_${symbol}`);
      setHorizontalLines(savedH ? JSON.parse(savedH) : []);
      setCurrentDrawing(null);
    } catch (e) {}
  }, [symbol]);

  // Synchronize Native Horizontal Price Lines with Lightweight Charts Series
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Clear existing price lines
    Object.values(priceLinesMapRef.current).forEach(pLine => {
      try {
        candleSeriesRef.current.removePriceLine(pLine);
      } catch (e) {}
    });
    priceLinesMapRef.current = {};

    // Re-create price lines
    horizontalLines.forEach(hline => {
      try {
        const pLine = candleSeriesRef.current.createPriceLine({
          price: hline.price,
          color: hline.color || '#06B6D4',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: hline.title || 'H-Line'
        });
        priceLinesMapRef.current[hline.id] = pLine;
      } catch (e) {}
    });
  }, [horizontalLines, symbol]);

  // Fetch and apply historical candle data
  const loadCandles = useCallback(async (targetInterval = interval) => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&interval=${targetInterval}&limit=180`);
      if (res.ok) {
        const data = await res.json();
        const rawCandles = data.candles || [];

        if (candleSeriesRef.current && volumeSeriesRef.current && chartInstanceRef.current) {
          const candleData = rawCandles.map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
          }));

          const volumeData = rawCandles.map(c => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open 
              ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.25)')
              : (isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.25)')
          }));

          candleSeriesRef.current.setData(candleData);
          volumeSeriesRef.current.setData(volumeData);

          if (candleData.length > 0) {
            const lastC = candleData[candleData.length - 1];
            const lastV = volumeData[volumeData.length - 1];
            lastCandleRef.current = { ...lastC };
            lastVolumeRef.current = lastV ? { ...lastV } : null;

            setLegend({
              open: lastC.open,
              high: lastC.high,
              low: lastC.low,
              close: lastC.close,
              color: lastC.close >= lastC.open ? '#10B981' : '#EF4444'
            });
            chartInstanceRef.current.timeScale().fitContent();
          } else {
            lastCandleRef.current = null;
            lastVolumeRef.current = null;
          }
          setRenderCounter(c => c + 1);
        }
      }
    } catch (e) {
      console.error("Error loading candles:", e);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, isDark]);

  // Update series price format precision when symbol changes
  useEffect(() => {
    if (candleSeriesRef.current) {
      candleSeriesRef.current.applyOptions({
        priceFormat: {
          type: 'price',
          precision: precision,
          minMove: minMove,
        },
      });
    }
  }, [precision, minMove]);

  // Initialize or re-theme chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const bgColor = isDark ? '#101623' : '#FFFFFF';
    const gridColor = isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(226, 232, 240, 0.6)';
    const textColor = isDark ? '#94A3B8' : '#64748B';

    // Clear previous elements if any
    chartContainerRef.current.innerHTML = '';

    const initialWidth = chartContainerRef.current.clientWidth || 800;
    const initialHeight = chartContainerRef.current.clientHeight || 480;
    setChartDimensions({ width: initialWidth, height: initialHeight });

    const chart = createChart(chartContainerRef.current, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor: textColor,
        fontFamily: "'Inter', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: isDark ? '#1E293B' : '#E2E8F0',
        scaleMargins: {
          top: 0.08,
          bottom: 0.16,
        },
        minimumWidth: 85,
        entireTextOnly: false,
        autoScale: true,
      },
      timeScale: {
        borderColor: isDark ? '#1E293B' : '#E2E8F0',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
      lastValueVisible: true,
      priceLineVisible: true,
      priceFormat: {
        type: 'price',
        precision: precision,
        minMove: minMove,
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      lastValueVisible: false,
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.88,
        bottom: 0,
      },
    });

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Crosshair move subscriber
    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        const data = param.seriesData.get(candleSeries);
        if (data) {
          setLegend({
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            color: data.close >= data.open ? '#10B981' : '#EF4444',
          });
        }
      }
    });

    // Time scale pan/zoom listener to synchronize SVG trendline coordinates
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      setRenderCounter(c => c + 1);
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      setRenderCounter(c => c + 1);
    });

    // ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
        setChartDimensions({ width, height });
        setRenderCounter(c => c + 1);
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    // Initial candle fetch
    loadCandles();

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [isDark]);

  // Load candles when symbol or interval changes
  useEffect(() => {
    loadCandles(interval);
  }, [symbol, interval, loadCandles]);

  // Volume toggle
  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({
        visible: showVolume
      });
    }
  }, [showVolume]);

  // Escape key listener to cancel in-progress drawing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCurrentDrawing(null);
        setActiveTool('pointer');
        setShowColorPicker(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live WebSocket Tick Update
  useEffect(() => {
    if (!lastTick || lastTick.symbol !== symbol || !candleSeriesRef.current) return;

    const currentPrice = Number(lastTick.price);
    if (!currentPrice || isNaN(currentPrice)) return;

    const bucketSec = INTERVAL_SECONDS[interval] || 300;
    const now = Math.floor(Date.now() / 1000);
    const currentBucketTime = Math.floor(now / bucketSec) * bucketSec;

    if (lastCandleRef.current) {
      if (currentBucketTime <= lastCandleRef.current.time) {
        const updated = {
          time: lastCandleRef.current.time,
          open: lastCandleRef.current.open,
          high: Math.max(lastCandleRef.current.high, currentPrice),
          low: Math.min(lastCandleRef.current.low, currentPrice),
          close: currentPrice,
        };
        lastCandleRef.current = updated;
        candleSeriesRef.current.update(updated);

        if (volumeSeriesRef.current && lastVolumeRef.current) {
          const updatedVol = {
            ...lastVolumeRef.current,
            color: updated.close >= updated.open 
              ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.25)')
              : (isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.25)')
          };
          lastVolumeRef.current = updatedVol;
          volumeSeriesRef.current.update(updatedVol);
        }

        setLegend({
          open: updated.open,
          high: updated.high,
          low: updated.low,
          close: updated.close,
          color: updated.close >= updated.open ? '#10B981' : '#EF4444',
        });
      } else {
        const newCandle = {
          time: currentBucketTime,
          open: currentPrice,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice,
        };
        lastCandleRef.current = newCandle;
        candleSeriesRef.current.update(newCandle);

        if (volumeSeriesRef.current) {
          const newVol = {
            time: currentBucketTime,
            value: 10,
            color: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.25)',
          };
          lastVolumeRef.current = newVol;
          volumeSeriesRef.current.update(newVol);
        }

        setLegend({
          open: newCandle.open,
          high: newCandle.high,
          low: newCandle.low,
          close: newCandle.close,
          color: '#10B981',
        });
      }
    } else {
      const newCandle = {
        time: currentBucketTime,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
      };
      lastCandleRef.current = newCandle;
      candleSeriesRef.current.update(newCandle);
    }
  }, [lastTick, symbol, interval, isDark]);

  // =========================================================================
  // DRAWING TOOL HANDLERS
  // =========================================================================

  const handleCanvasClick = (e) => {
    if (activeTool === 'pointer') return;
    if (!chartContainerRef.current || !chartInstanceRef.current || !candleSeriesRef.current) return;

    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Discard clicks outside plot area (e.g. on price axis or time axis)
    if (x < 0 || x > rect.width - 80 || y < 0 || y > rect.height - 30) return;

    const clickedPrice = candleSeriesRef.current.coordinateToPrice(y);
    const clickedTime = chartInstanceRef.current.timeScale().coordinateToTime(x);

    if (clickedPrice === null) return;

    // 1. Horizontal Line Tool: Click once to drop a native Price Line
    if (activeTool === 'hline') {
      const roundedPrice = Number(clickedPrice.toFixed(precision));
      const newLine = {
        id: `hline_${Date.now()}`,
        price: roundedPrice,
        color: selectedColor,
        title: `H-Line $${roundedPrice.toFixed(precision)}`
      };
      setHorizontalLines(prev => [...prev, newLine]);
      setActiveTool('pointer');
      return;
    }

    // 2. Trendline & Ray Tools: 2-Point Click Placement
    if (activeTool === 'trendline' || activeTool === 'ray') {
      const resolvedTime = clickedTime || (lastCandleRef.current ? lastCandleRef.current.time : Math.floor(Date.now() / 1000));

      if (!currentDrawing) {
        // Point 1 (Start)
        setCurrentDrawing({
          type: activeTool,
          t1: resolvedTime,
          p1: clickedPrice,
          x1: x,
          y1: y,
          currentX: x,
          currentY: y,
          color: selectedColor
        });
      } else {
        // Point 2 (End): Complete Drawing
        const newLine = {
          id: `tline_${Date.now()}`,
          type: currentDrawing.type,
          t1: currentDrawing.t1,
          p1: currentDrawing.p1,
          t2: resolvedTime,
          p2: clickedPrice,
          color: selectedColor
        };
        setTrendLines(prev => [...prev, newLine]);
        setCurrentDrawing(null);
        setActiveTool('pointer');
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!currentDrawing || !chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentDrawing(prev => prev ? ({ ...prev, currentX: x, currentY: y }) : null);
  };

  const handleUndo = () => {
    if (currentDrawing) {
      setCurrentDrawing(null);
      return;
    }
    if (trendLines.length > 0) {
      setTrendLines(prev => prev.slice(0, -1));
      return;
    }
    if (horizontalLines.length > 0) {
      setHorizontalLines(prev => prev.slice(0, -1));
    }
  };

  const handleClearAllDrawings = () => {
    if (window.confirm("Clear all trendlines and horizontal lines on this chart?")) {
      setTrendLines([]);
      setHorizontalLines([]);
      setCurrentDrawing(null);
      localStorage.removeItem(`zerovega_trendlines_${symbol}`);
      localStorage.removeItem(`zerovega_hlines_${symbol}`);
    }
  };

  // Convert Time & Price into Pixel Coordinates on current Chart Scale
  const calculateLineCoords = (line) => {
    if (!chartInstanceRef.current || !candleSeriesRef.current) return null;
    try {
      const timeScale = chartInstanceRef.current.timeScale();
      const x1 = timeScale.timeToCoordinate(line.t1);
      const y1 = candleSeriesRef.current.priceToCoordinate(line.p1);
      const x2 = timeScale.timeToCoordinate(line.t2);
      const y2 = candleSeriesRef.current.priceToCoordinate(line.p2);

      if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

      if (line.type === 'ray') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const targetX = chartDimensions.width + 1000;
        const targetY = dx !== 0 ? y1 + (dy / dx) * (targetX - x1) : y2;
        return { x1, y1, x2: targetX, y2: targetY, origX2: x2, origY2: y2 };
      }

      return { x1, y1, x2, y2, origX2: x2, origY2: y2 };
    } catch (e) {
      return null;
    }
  };

  const price = activeTicker?.price || 100.0;
  const isPositive = (activeTicker?.changePercent24h || 0) >= 0;

  return (
    <div className="bg-white dark:bg-surface-darkPanel rounded-2xl border border-gray-200 dark:border-surface-darkBorder flex flex-col overflow-hidden shadow-sm max-w-5xl mx-auto w-full">
      
      {/* Top Header: Symbol Info, Timeframe Badge & Controls */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-surface-darkBorder flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-surface-darkCard/30">
        
        {/* Left: Symbol, Selected Timeframe Pill, Exchange tag, LTP */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg tracking-tight">
              {activeTicker?.display || symbol}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-600 text-white shadow-xs uppercase">
              {interval}
            </span>
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-gray-200/80 dark:bg-surface-darkBorder text-gray-700 dark:text-gray-300 uppercase">
              {activeTicker?.category || 'Market'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-medium text-gray-900 dark:text-white tabular-nums">
              ${price.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })}
            </span>
            <span className={`text-xs font-normal tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              ({isPositive ? '+' : ''}{activeTicker?.changePercent24h ? activeTicker.changePercent24h.toFixed(2) : '0.00'}%)
            </span>
          </div>

          {/* Dynamic OHLC Legend */}
          {legend && (
            <div className="hidden xl:flex items-center gap-2 text-xs text-gray-400 tabular-nums">
              <span>O: <strong className="font-medium text-gray-700 dark:text-gray-300">{typeof legend.open === 'number' ? legend.open.toFixed(precision) : legend.open}</strong></span>
              <span>H: <strong className="font-medium text-gray-700 dark:text-gray-300">{typeof legend.high === 'number' ? legend.high.toFixed(precision) : legend.high}</strong></span>
              <span>L: <strong className="font-medium text-gray-700 dark:text-gray-300">{typeof legend.low === 'number' ? legend.low.toFixed(precision) : legend.low}</strong></span>
              <span>C: <strong className="font-medium" style={{ color: legend.color }}>{typeof legend.close === 'number' ? legend.close.toFixed(precision) : legend.close}</strong></span>
            </div>
          )}
        </div>

        {/* Right: Timeframe Selectors & Actions */}
        <div className="flex items-center gap-2">
          {/* Timeframe Selector with High-Contrast Active State */}
          <div className="flex items-center bg-gray-200/90 dark:bg-surface-darkBorder p-1 rounded-xl border border-gray-300/80 dark:border-surface-darkBorder shadow-2xs">
            {TIMEFRAMES.map(tf => {
              const isSelected = interval === tf.value;
              return (
                <button
                  key={tf.value}
                  type="button"
                  onClick={() => setInterval(tf.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300/60 dark:hover:bg-surface-darkHover'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>

          {/* Volume Visibility Toggle Button */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            title={showVolume ? "Hide Volume" : "Show Volume"}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
              showVolume
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-500/40 font-semibold'
                : 'text-gray-400 border-gray-200 dark:border-surface-darkBorder'
            }`}
          >
            VOL
          </button>

          {/* Quick Option Chain Button */}
          {onOpenOptionChain && (activeTicker?.category === 'stock' || activeTicker?.category === 'index') && (
            <button
              onClick={() => onOpenOptionChain(symbol)}
              title={`View Option Chain for ${symbol}`}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 transition-all flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Options</span>
            </button>
          )}

          <button
            onClick={() => loadCandles(interval)}
            title="Reload Chart Data"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>

      </div>

      {/* Chart Canvas Area & Vertical Drawing Tools Toolbar */}
      <div className="relative w-full h-[420px] sm:h-[500px] lg:h-[540px] bg-[#FFFFFF] dark:bg-[#101623] select-none">
        
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 dark:bg-surface-darkPanel/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-medium shadow-lg">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span>Streaming candles...</span>
            </div>
          </div>
        )}

        {/* 1. DOCKED VERTICAL DRAWING TOOLBAR (Zerodha Kite & TradingView Style) */}
        <div className="absolute left-3 top-3 z-20 flex flex-col gap-1 p-1 bg-white/90 dark:bg-surface-darkPanel/90 backdrop-blur-md rounded-xl border border-gray-200 dark:border-surface-darkBorder shadow-lg">
          
          {/* Pointer / Cursor Tool */}
          <button
            onClick={() => {
              setActiveTool('pointer');
              setCurrentDrawing(null);
            }}
            title="Pointer / Normal Pan (Cursor)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'pointer'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-darkHover'
            }`}
          >
            <MousePointer2 className="w-4 h-4" />
          </button>

          {/* Trendline Tool */}
          <button
            onClick={() => {
              setActiveTool('trendline');
              setCurrentDrawing(null);
            }}
            title="Trend Line (Click 2 points)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'trendline'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-darkHover'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
          </button>

          {/* Horizontal Line Tool (Support / Resistance) */}
          <button
            onClick={() => {
              setActiveTool('hline');
              setCurrentDrawing(null);
            }}
            title="Horizontal Support / Resistance Level (Click price)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'hline'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-darkHover'
            }`}
          >
            <Minus className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Extended Ray Tool */}
          <button
            onClick={() => {
              setActiveTool('ray');
              setCurrentDrawing(null);
            }}
            title="Ray Line (Projected to future)"
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'ray'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-darkHover'
            }`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="h-px bg-gray-200 dark:bg-surface-darkBorder my-0.5" />

          {/* Color Selector Popover */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Line Color"
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-darkHover flex items-center justify-center"
            >
              <span className="w-3.5 h-3.5 rounded-full ring-1 ring-white/30" style={{ backgroundColor: selectedColor }} />
            </button>

            {showColorPicker && (
              <div className="absolute left-10 top-0 z-30 p-2 bg-white dark:bg-surface-darkPanel rounded-xl border border-gray-200 dark:border-surface-darkBorder shadow-2xl flex items-center gap-1.5 animate-in fade-in duration-150">
                {DRAWING_COLORS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => {
                      setSelectedColor(c.hex);
                      setShowColorPicker(false);
                    }}
                    title={c.name}
                    className="w-5 h-5 rounded-full transition-transform hover:scale-110 flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: c.hex }}
                  >
                    {selectedColor === c.hex && <Check className="w-3 h-3 text-black font-bold" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Undo Button */}
          {(trendLines.length > 0 || horizontalLines.length > 0 || currentDrawing) && (
            <button
              onClick={handleUndo}
              title="Undo Last Drawing (Ctrl+Z)"
              className="p-2 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-surface-darkHover transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}

          {/* Clear All Drawings Button */}
          {(trendLines.length > 0 || horizontalLines.length > 0) && (
            <button
              onClick={handleClearAllDrawings}
              title="Clear All Drawings &amp; Levels"
              className="p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

        </div>

        {/* 2. ACTIVE TOOL INSTRUCTION BANNER */}
        {activeTool !== 'pointer' && (
          <div className="absolute top-3 left-16 z-20 px-3 py-1.5 rounded-xl bg-blue-600/90 text-white text-xs font-medium backdrop-blur-md shadow-lg flex items-center gap-2 animate-in fade-in duration-200">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              {activeTool === 'hline' && "Click anywhere on the chart to drop a Support/Resistance line."}
              {activeTool === 'trendline' && (!currentDrawing ? "Trend Line: Click Point 1 (Start)" : "Click Point 2 (End) to finish")}
              {activeTool === 'ray' && (!currentDrawing ? "Ray: Click Point 1 (Anchor)" : "Click Point 2 (Direction)")}
            </span>
            <button
              onClick={() => {
                setActiveTool('pointer');
                setCurrentDrawing(null);
              }}
              className="p-0.5 hover:bg-white/20 rounded"
              title="Cancel (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3. SVG OVERLAY LAYER FOR TRENDLINES & RAYS */}
        <svg
          className={`absolute inset-0 w-full h-full ${
            activeTool !== 'pointer' ? 'cursor-crosshair pointer-events-auto z-10' : 'pointer-events-none z-10'
          }`}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
        >
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Saved Trend Lines & Rays */}
          {trendLines.map(line => {
            const coords = calculateLineCoords(line);
            if (!coords) return null;
            return (
              <g key={line.id} className="group">
                {/* Glow Filter Line */}
                <line
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  stroke={line.color || '#06B6D4'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  opacity="0.85"
                />
                {/* Anchor Points */}
                <circle cx={coords.x1} cy={coords.y1} r="4" fill={line.color || '#06B6D4'} stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx={coords.origX2} cy={coords.origY2} r="4" fill={line.color || '#06B6D4'} stroke="#FFFFFF" strokeWidth="1.5" />
              </g>
            );
          })}

          {/* Render Active In-Progress Rubber-Band Line */}
          {currentDrawing && (
            <g>
              <line
                x1={currentDrawing.x1}
                y1={currentDrawing.y1}
                x2={currentDrawing.currentX}
                y2={currentDrawing.currentY}
                stroke={selectedColor}
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
              <circle cx={currentDrawing.x1} cy={currentDrawing.y1} r="5" fill={selectedColor} stroke="#FFFFFF" strokeWidth="1.5" />
              <circle cx={currentDrawing.currentX} cy={currentDrawing.currentY} r="4" fill={selectedColor} />
            </g>
          )}
        </svg>

        {/* 4. LIGHTWEIGHT CHARTS CANVAS */}
        <div 
          ref={chartContainerRef} 
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />

      </div>

      {/* Indian Broker Sticky Bottom Quick Buy/Sell Bar */}
      {onOpenOrderModal && (
        <div className="p-3 bg-gray-50 dark:bg-surface-darkCard/80 border-t border-gray-200 dark:border-surface-darkBorder flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
            Quick 1-Tap Execution &bull; Zero Lag &bull; Draw Trendlines &amp; Levels
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => onOpenOrderModal('BUY')}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold uppercase tracking-wider shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              <span>BUY @ ${price.toFixed(precision)}</span>
            </button>

            <button
              onClick={() => onOpenOrderModal('SELL')}
              className="flex-1 sm:flex-initial py-2.5 px-6 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-semibold uppercase tracking-wider shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
              <span>SELL @ ${price.toFixed(precision)}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

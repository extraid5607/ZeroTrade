import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { BarChart3, RefreshCw, Layers, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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

  const [interval, setInterval] = useState('5m');
  const [legend, setLegend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  const isDark = theme === 'dark';

  const isForex5 = ['EUR/USD', 'GBP/USD', 'AUD/USD', 'USD/CAD'].includes(symbol);
  const isForex3 = ['USD/JPY', 'USD/INR'].includes(symbol);
  const precision = isForex5 ? 5 : (isForex3 ? 3 : (activeTicker?.price && activeTicker.price < 5 ? 4 : 2));
  const minMove = isForex5 ? 0.00001 : (isForex3 ? 0.001 : (precision === 4 ? 0.0001 : 0.01));

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
      lastValueVisible: true, // Native clean price scale tag on right axis
      priceLineVisible: true,  // Keeps horizontal dashed price line
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

    // Explicitly configure overlay scale margins so volume never overlaps candles
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.88, // strictly confined to the bottom 12% of the chart
        bottom: 0,
      },
    });

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

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

    // ResizeObserver for rock-solid responsive sizing across tab switching & window resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
        chart.timeScale().fitContent();
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

  // Live WebSocket Tick Update - bucketed to selected timeframe interval
  useEffect(() => {
    if (!lastTick || lastTick.symbol !== symbol || !candleSeriesRef.current) return;

    const currentPrice = Number(lastTick.price);
    if (!currentPrice || isNaN(currentPrice)) return;

    const bucketSec = INTERVAL_SECONDS[interval] || 300;
    const now = Math.floor(Date.now() / 1000);
    const currentBucketTime = Math.floor(now / bucketSec) * bucketSec;

    if (lastCandleRef.current) {
      if (currentBucketTime <= lastCandleRef.current.time) {
        // Mutate current active candle in-place
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
        // A new timeframe candle has started
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
            {/* Prominent Active Timeframe Tag */}
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

      {/* Chart Canvas Area with explicit guaranteed height */}
      <div className="relative w-full h-[420px] sm:h-[500px] lg:h-[540px] bg-[#FFFFFF] dark:bg-[#101623]">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-surface-darkPanel/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-medium shadow-lg">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span>Streaming candles...</span>
            </div>
          </div>
        )}
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
            Quick 1-Tap Execution &bull; Zero Lag
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

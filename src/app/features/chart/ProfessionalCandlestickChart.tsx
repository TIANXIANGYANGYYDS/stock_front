import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Focus,
  Layers3,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import type { RealtimeStockQuote, SectorStock, StockKlineBar } from '../../lib/api';
import { formatShanghaiTime, marketStatusLabel } from '../../lib/realtime-format';
import {
  buildIndicatorData,
  buildMovingAverageData,
  buildVolumeData,
  buildVolumeMovingAverageData,
  formatChartVolume,
  getAvailableChartIndicators,
  getAvailableMaKeys,
  normalizeChartBars,
  type AuxiliaryChartIndicator,
  type ChartBar,
} from './chart-data';
import {
  navigateLogicalRange,
  type ChartNavigationAction,
} from './chart-navigation';

interface ProfessionalCandlestickChartProps {
  stock: SectorStock | null;
  loading?: boolean;
  realtimeQuote?: RealtimeStockQuote | null;
  realtimeLoading?: boolean;
  realtimeDelayed?: boolean;
  realtimeMarketStatus?: string;
  onActiveDateChange?: (date: string | null) => void;
}

interface OhlcLegend {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changePercent: number | null;
}

type ManagedSeries = ISeriesApi<'Line'> | ISeriesApi<'Histogram'>;

const RISE_COLOR = '#f06461';
const FALL_COLOR = '#20b98b';
const MAIN_PANE_HEIGHT = 420;
const AUXILIARY_PANE_HEIGHT = 150;
const MAIN_PANE_STRETCH_FACTOR = MAIN_PANE_HEIGHT / AUXILIARY_PANE_HEIGHT;
const DEFAULT_WINDOW_SIZE = 60;
type ChartWindowSize = 10 | 20 | 30 | 60;
const MA_CONFIG = [
  { key: 'ma5', label: 'MA5', color: '#f2b84b' },
  { key: 'ma10', label: 'MA10', color: '#9b8af5' },
  { key: 'ma20', label: 'MA20', color: '#45b9e8' },
  { key: 'ma30', label: 'MA30', color: '#e97b91' },
  { key: 'ma60', label: 'MA60', color: '#38bd91' },
] as const;
const BOLL_CONFIG = [
  { key: 'upper', label: 'UPPER', color: '#e97b91' },
  { key: 'mid', label: 'MID', color: '#b8c4d6' },
  { key: 'lower', label: 'LOWER', color: '#38bd91' },
] as const;
const AUXILIARY_LABELS: Record<AuxiliaryChartIndicator, string> = {
  volume: '成交量',
  macd: 'MACD',
  kdj: 'KDJ',
  rsi: 'RSI',
  cci: 'CCI',
  wr: 'WR',
  atr: 'ATR',
};
const AUXILIARY_LINES = {
  macd: [
    { key: 'dif', label: 'DIF', color: '#45b9e8' },
    { key: 'dea', label: 'DEA', color: '#f2b84b' },
    { key: 'hist', label: 'HIST', color: '#e97b91' },
  ],
  kdj: [
    { key: 'k', label: 'K', color: '#45b9e8' },
    { key: 'd', label: 'D', color: '#f2b84b' },
    { key: 'j', label: 'J', color: '#9b8af5' },
  ],
  rsi: [
    { key: 'rsi6', label: 'RSI6', color: '#45b9e8' },
    { key: 'rsi12', label: 'RSI12', color: '#f2b84b' },
    { key: 'rsi24', label: 'RSI24', color: '#9b8af5' },
  ],
  cci: [{ key: 'cci14', label: 'CCI14', color: '#f2b84b' }],
  wr: [
    { key: 'wr6', label: 'WR6', color: '#45b9e8' },
    { key: 'wr10', label: 'WR10', color: '#f2b84b' },
    { key: 'wr14', label: 'WR14', color: '#9b8af5' },
  ],
  atr: [{ key: 'atr14', label: 'ATR14', color: '#d9a566' }],
} as const;
const VOLUME_MA_CONFIG = [
  { key: 'volMa5', label: 'VMA5', color: '#f2b84b' },
  { key: 'volMa10', label: 'VMA10', color: '#9b8af5' },
  { key: 'volMa20', label: 'VMA20', color: '#45b9e8' },
  { key: 'volMa60', label: 'VMA60', color: '#38bd91' },
] as const;

function toLegend(bar: ChartBar | undefined): OhlcLegend | null {
  if (!bar) return null;
  const changePercent =
    bar.changePercent ?? (bar.open ? ((bar.close - bar.open) / bar.open) * 100 : null);
  return {
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    changePercent,
  };
}

function formatPrice(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '--' : value.toFixed(2);
}

function formatIndicator(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '--'
    : value.toFixed(digits);
}

function sameIndicators(
  left: AuxiliaryChartIndicator[],
  right: AuxiliaryChartIndicator[],
): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function ProfessionalCandlestickChart({
  stock,
  loading = false,
  realtimeQuote = null,
  realtimeLoading = false,
  realtimeDelayed = false,
  realtimeMarketStatus = '',
  onActiveDateChange,
}: ProfessionalCandlestickChartProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const movingAverageSeriesRef = useRef<Array<ISeriesApi<'Line'>>>([]);
  const bollSeriesRef = useRef<Array<ISeriesApi<'Line'>>>([]);
  const auxiliarySeriesRef = useRef<Partial<Record<AuxiliaryChartIndicator, ManagedSeries[]>>>({});
  const onActiveDateChangeRef = useRef(onActiveDateChange);
  const bars = useMemo(() => normalizeChartBars(stock?.kline ?? []), [stock]);
  const availableMaKeys = useMemo(() => getAvailableMaKeys(bars), [bars]);
  const availableIndicators = useMemo(() => getAvailableChartIndicators(bars), [bars]);
  const bollAvailable = useMemo(
    () => BOLL_CONFIG.some(({ key }) => buildIndicatorData(bars, 'boll', key).length > 0),
    [bars],
  );
  const [activeBar, setActiveBar] = useState<ChartBar | null>(() => bars.at(-1) ?? null);
  const [windowSize, setWindowSize] = useState<ChartWindowSize | null>(DEFAULT_WINDOW_SIZE);
  const [showMovingAverages, setShowMovingAverages] = useState(true);
  const [showBoll, setShowBoll] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<AuxiliaryChartIndicator[]>([
    'volume', 'macd',
  ]);

  onActiveDateChangeRef.current = onActiveDateChange;

  useEffect(() => {
    const latest = bars.at(-1) ?? null;
    setActiveBar(latest);
    setWindowSize(DEFAULT_WINDOW_SIZE);
    onActiveDateChangeRef.current?.(null);
  }, [bars]);

  useEffect(() => {
    setShowMovingAverages(availableMaKeys.length > 0);
    setShowBoll(false);
    setActiveIndicators((current) => {
      const retained = current.filter((indicator) => availableIndicators.includes(indicator));
      const defaults = (['volume', 'macd'] as AuxiliaryChartIndicator[])
        .filter((indicator) => availableIndicators.includes(indicator));
      const next = retained.length > 0
        ? retained
        : defaults.length > 0
          ? defaults
          : availableIndicators.slice(0, 1);
      return sameIndicators(current, next) ? current : next;
    });
  }, [availableIndicators, availableMaKeys.length, stock?.code]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || bars.length === 0) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0b1420' },
        textColor: '#7f8da2',
        fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 12,
        panes: {
          separatorColor: 'rgba(65, 84, 108, 0.34)',
          separatorHoverColor: 'rgba(69, 185, 232, 0.48)',
          enableResize: true,
        },
      },
      grid: {
        vertLines: { color: 'rgba(59, 78, 102, 0.18)' },
        horzLines: { color: 'rgba(59, 78, 102, 0.22)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(151, 170, 194, 0.64)', width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: '#334359',
        },
        horzLine: {
          color: 'rgba(151, 170, 194, 0.64)', width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: '#334359',
        },
      },
      timeScale: {
        borderColor: 'rgba(60, 79, 103, 0.42)',
        timeVisible: false,
        secondsVisible: false,
        rightOffset: 1.5,
        barSpacing: 14,
        minBarSpacing: 6,
        fixLeftEdge: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(60, 79, 103, 0.42)',
        scaleMargins: { top: 0.08, bottom: 0.04 },
      },
      localization: { locale: 'zh-CN', dateFormat: 'yyyy-MM-dd' },
      handleScale: {
        mouseWheel: false,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    });
    chartApiRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: RISE_COLOR,
      downColor: FALL_COLOR,
      borderVisible: false,
      wickUpColor: 'rgba(240, 100, 97, 0.86)',
      wickDownColor: 'rgba(32, 185, 139, 0.86)',
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    candleSeries.setData(bars.map((bar) => ({
      time: bar.time as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    })));

    movingAverageSeriesRef.current = MA_CONFIG
      .filter(({ key }) => availableMaKeys.includes(key))
      .map(({ key, color }) => {
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          visible: showMovingAverages,
        });
        series.setData(buildMovingAverageData(bars, key).map((point) => ({
          time: point.time as Time,
          value: point.value,
        })));
        return series;
      });

    bollSeriesRef.current = BOLL_CONFIG.flatMap(({ key, color }) => {
      const data = buildIndicatorData(bars, 'boll', key);
      if (!data.length) return [];
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: key === 'mid' ? LineStyle.Solid : LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: showBoll,
      });
      series.setData(data.map((point) => ({ time: point.time as Time, value: point.value })));
      return [series];
    });

    const handleCrosshairMove = (param: Parameters<typeof chart.subscribeCrosshairMove>[0]) => {
      if (!param.time) {
        setActiveBar(bars.at(-1) ?? null);
        onActiveDateChangeRef.current?.(null);
        return;
      }
      const date = String(param.time);
      const bar = bars.find((item) => item.time === date);
      if (!bar) return;
      setActiveBar(bar);
      onActiveDateChangeRef.current?.(date);
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    const visibleBars = Math.min(windowSize ?? DEFAULT_WINDOW_SIZE, bars.length);
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, bars.length - visibleBars - 0.5),
      to: bars.length + 0.5,
    });

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chartApiRef.current = null;
      movingAverageSeriesRef.current = [];
      bollSeriesRef.current = [];
      auxiliarySeriesRef.current = {};
      chart.remove();
    };
  }, [bars]);

  useEffect(() => {
    const chart = chartApiRef.current;
    if (!chart || bars.length === 0) return;

    Object.values(auxiliarySeriesRef.current).flat().forEach((series) => {
      try {
        chart.removeSeries(series);
      } catch {
        // The parent chart may already have been replaced for a newly selected stock.
      }
    });
    auxiliarySeriesRef.current = {};

    const selected = activeIndicators.filter((indicator) => availableIndicators.includes(indicator));
    selected.forEach((indicator, index) => {
      const paneIndex = index + 1;
      const managed: ManagedSeries[] = [];
      const addLine = (
        group: Exclude<AuxiliaryChartIndicator, 'volume'>,
        key: string,
        color: string,
      ) => {
        const data = buildIndicatorData(bars, group, key);
        if (!data.length) return;
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        }, paneIndex);
        series.setData(data.map((point) => ({ time: point.time as Time, value: point.value })));
        managed.push(series);
      };

      if (indicator === 'volume') {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'custom', minMove: 1, formatter: formatChartVolume },
          priceLineVisible: false,
          lastValueVisible: false,
        }, paneIndex);
        volumeSeries.setData(buildVolumeData(bars).map((item) => ({
          ...item,
          time: item.time as Time,
        })));
        managed.push(volumeSeries);
        VOLUME_MA_CONFIG.forEach(({ key, color }) => {
          const data = buildVolumeMovingAverageData(bars, key);
          if (!data.length) return;
          const series = chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          }, paneIndex);
          series.setData(data.map((point) => ({ time: point.time as Time, value: point.value })));
          managed.push(series);
        });
      } else if (indicator === 'macd') {
        AUXILIARY_LINES.macd.slice(0, 2).forEach(({ key, color }) => {
          addLine('macd', key, color);
        });
        const histogramData = buildIndicatorData(bars, 'macd', 'hist');
        if (histogramData.length) {
          const histogram = chart.addSeries(HistogramSeries, {
            priceLineVisible: false,
            lastValueVisible: false,
          }, paneIndex);
          histogram.setData(histogramData.map((point) => ({
            time: point.time as Time,
            value: point.value,
            color: point.value >= 0 ? 'rgba(240, 100, 97, 0.52)' : 'rgba(32, 185, 139, 0.52)',
          })));
          managed.push(histogram);
        }
      } else {
        AUXILIARY_LINES[indicator].forEach(({ key, color }) => {
          addLine(indicator, key, color);
        });
      }

      auxiliarySeriesRef.current[indicator] = managed;
    });
    const panes = chart.panes();
    panes[0]?.setStretchFactor(MAIN_PANE_STRETCH_FACTOR);
    selected.forEach((_, index) => {
      panes[index + 1]?.setStretchFactor(1);
    });
  }, [activeIndicators, availableIndicators, bars]);

  useEffect(() => {
    movingAverageSeriesRef.current.forEach((series) => {
      series.applyOptions({ visible: showMovingAverages });
    });
  }, [showMovingAverages]);

  useEffect(() => {
    bollSeriesRef.current.forEach((series) => series.applyOptions({ visible: showBoll }));
  }, [showBoll]);

  useEffect(() => {
    const chart = chartApiRef.current;
    if (!chart || bars.length === 0 || windowSize === null) return;
    const visibleBars = Math.min(windowSize, bars.length);
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, bars.length - visibleBars - 0.5),
      to: bars.length + 0.5,
    });
  }, [bars.length, windowSize]);

  const fitChart = () => chartApiRef.current?.timeScale().fitContent();
  const navigateChart = (action: ChartNavigationAction) => {
    const timeScale = chartApiRef.current?.timeScale();
    if (!timeScale) return;
    const nextRange = navigateLogicalRange(
      timeScale.getVisibleLogicalRange(),
      action,
      bars.length,
    );
    if (!nextRange) return;
    setWindowSize(null);
    timeScale.setVisibleLogicalRange(nextRange);
  };
  const toggleFullscreen = async () => {
    const element = shellRef.current;
    if (!element) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await element.requestFullscreen();
  };
  const toggleAuxiliary = (indicator: AuxiliaryChartIndicator) => {
    setActiveIndicators((current) => current.includes(indicator)
      ? current.filter((item) => item !== indicator)
      : [...current, indicator]);
  };

  const legend = toLegend(activeBar ?? bars.at(-1));
  const isUp = (legend?.changePercent ?? stock?.changePercent ?? 0) >= 0;
  const latestBar = bars.at(-1) ?? null;
  const showingLatestBar = Boolean(latestBar && activeBar?.time === latestBar.time);
  const hasRealtimePrice = showingLatestBar
    && typeof realtimeQuote?.close === 'number'
    && Number.isFinite(realtimeQuote.close);
  const displayedPrice = hasRealtimePrice ? realtimeQuote.close : legend?.close ?? stock?.close;
  const realtimeState = !showingLatestBar
    ? '历史 K 线'
    : hasRealtimePrice
      ? `实时 ${realtimeQuote.interval} ${formatShanghaiTime(realtimeQuote.timestamp)}`
      : realtimeLoading
        ? '实时行情加载中'
        : realtimeDelayed
          ? '实时数据可能延迟'
          : '暂无实时行情';
  const activeValidIndicators = activeIndicators
    .filter((indicator) => availableIndicators.includes(indicator));
  const chartCanvasHeight = Math.max(
    430,
    MAIN_PANE_HEIGHT + activeValidIndicators.length * AUXILIARY_PANE_HEIGHT,
  );

  const auxiliaryLegendValues = (indicator: AuxiliaryChartIndicator) => {
    const bar = activeBar;
    if (!bar) return [];
    if (indicator === 'volume') {
      const entries = [
        { label: 'VOL', value: bar.volume, color: '#8392a8', formatted: formatChartVolume(bar.volume) },
        ...VOLUME_MA_CONFIG.map(({ key, label, color }) => ({
          label,
          value: bar.volumeMa?.[key],
          color,
          formatted: formatChartVolume(bar.volumeMa?.[key] ?? Number.NaN),
        })),
      ];
      return entries.filter(({ value }) => typeof value === 'number' && Number.isFinite(value));
    }
    const group = bar[indicator] as Record<string, number | null> | null | undefined;
    return AUXILIARY_LINES[indicator].flatMap(({ key, label, color }) => {
      const value = group?.[key];
      return typeof value === 'number' && Number.isFinite(value)
        ? [{ label, value, color, formatted: formatIndicator(value, indicator === 'macd' ? 4 : 2) }]
        : [];
    });
  };

  return (
    <section ref={shellRef} className="terminal-panel chart-workspace terminal-scroll" aria-label="个股蜡烛图工作区">
      <div className="chart-fixed-header">
        <div className="stock-quote-head">
        <div>
          <div className="stock-identity">
            <strong>{stock?.name || '等待选择股票'}</strong>
            <span>{stock?.code || '--'}</span>
            {(legend?.time || stock?.tradeDate) && (
              <span className="trade-date-chip">{legend?.time || stock?.tradeDate}</span>
            )}
          </div>
          <div className="stock-price-row">
            <span className={isUp ? 'market-rise' : 'market-fall'}>{formatPrice(displayedPrice)}</span>
            <small className={isUp ? 'market-rise' : 'market-fall'}>
              {legend?.changePercent === null || legend?.changePercent === undefined
                ? '--'
                : `日线涨跌 ${legend.changePercent > 0 ? '+' : ''}${legend.changePercent.toFixed(2)}%`}
            </small>
          </div>
          <div className={`stock-live-state${realtimeDelayed ? ' is-delayed' : ''}`}>
            {realtimeState}
            {showingLatestBar && realtimeMarketStatus
              ? ` · ${marketStatusLabel(realtimeMarketStatus)}`
              : ''}
          </div>
        </div>
        <div className="chart-periods" aria-label="图表窗口">
          {([10, 20, 30, 60] as const).map((size) => (
            <button key={size} className={windowSize === size ? 'is-active' : ''} onClick={() => setWindowSize(size)}>
              近{size}日
            </button>
          ))}
        </div>
        </div>

        <div className="chart-toolbar">
        <div className="ohlc-legend">
          <span>{legend?.time || '--'}</span>
          <span>开 <b>{formatPrice(legend?.open)}</b></span>
          <span>高 <b className="market-rise">{formatPrice(legend?.high)}</b></span>
          <span>低 <b className="market-fall">{formatPrice(legend?.low)}</b></span>
          <span>收 <b>{formatPrice(legend?.close)}</b></span>
        </div>
        <div className="chart-tools">
          {availableMaKeys.length > 0 && (
            <button aria-pressed={showMovingAverages} className={showMovingAverages ? 'is-active' : ''} onClick={() => setShowMovingAverages((value) => !value)}>MA</button>
          )}
          {bollAvailable && (
            <button aria-pressed={showBoll} className={showBoll ? 'is-active' : ''} onClick={() => setShowBoll((value) => !value)}>BOLL</button>
          )}
          <span className="chart-tool-divider"><Layers3 size={12} />副图</span>
          {availableIndicators.map((indicator) => (
            <button
              key={indicator}
              aria-pressed={activeValidIndicators.includes(indicator)}
              className={activeValidIndicators.includes(indicator) ? 'is-active' : ''}
              onClick={() => toggleAuxiliary(indicator)}
            >
              {AUXILIARY_LABELS[indicator]}
            </button>
          ))}
          <button onClick={fitChart} title="适配全部 K 线" aria-label="适配全部 K 线"><Focus size={14} /></button>
          <button onClick={() => setWindowSize(DEFAULT_WINDOW_SIZE)} title="重置窗口" aria-label="重置窗口"><RotateCcw size={14} /></button>
          <button onClick={() => void toggleFullscreen()} title="全屏图表" aria-label="全屏图表"><Expand size={14} /></button>
        </div>
        </div>

        <div className="indicator-legend-board" aria-label="当前指标图例">
        {showMovingAverages && (
          <div className="indicator-legend-row">
            <strong>MA</strong>
            {MA_CONFIG.filter(({ key }) => availableMaKeys.includes(key)).flatMap(({ key, label, color }) => {
              const value = activeBar?.ma?.[key];
              return typeof value === 'number' && Number.isFinite(value)
                ? [<span key={key}><i style={{ background: color }} />{label} <b>{formatIndicator(value)}</b></span>]
                : [];
            })}
          </div>
        )}
        {showBoll && (
          <div className="indicator-legend-row">
            <strong>BOLL</strong>
            {BOLL_CONFIG.flatMap(({ key, label, color }) => {
              const value = activeBar?.boll?.[key];
              return typeof value === 'number' && Number.isFinite(value)
                ? [<span key={key}><i style={{ background: color }} />{label} <b>{formatIndicator(value)}</b></span>]
                : [];
            })}
          </div>
        )}
        {activeValidIndicators.map((indicator) => {
          const values = auxiliaryLegendValues(indicator);
          if (!values.length) return null;
          return (
            <div className="indicator-legend-row" key={indicator}>
              <strong>{AUXILIARY_LABELS[indicator]}</strong>
              {values.map((entry) => (
                <span key={entry.label}><i style={{ background: entry.color }} />{entry.label} <b>{entry.formatted}</b></span>
              ))}
            </div>
          );
        })}
        </div>
      </div>

      <div className="chart-canvas-shell" style={{ height: chartCanvasHeight }}>
        {loading ? (
          <div className="terminal-empty"><span className="loading-pulse" />正在加载个股行情...</div>
        ) : bars.length === 0 ? (
          <div className="terminal-empty">请选择包含有效日 K 数据的股票</div>
        ) : (
          <div ref={chartContainerRef} className="chart-canvas" />
        )}
        {!loading && bars.length > 0 && (
          <div
            className="chart-navigation-controls"
            style={{ top: MAIN_PANE_HEIGHT - 56 }}
            role="group"
            aria-label="主图导航"
          >
            <button type="button" onClick={() => navigateChart('zoom-out')} title="缩小K线" aria-label="缩小K线">
              <Minus size={14} strokeWidth={2.2} />
            </button>
            <button type="button" onClick={() => navigateChart('zoom-in')} title="放大K线" aria-label="放大K线">
              <Plus size={14} strokeWidth={2.2} />
            </button>
            <button type="button" onClick={() => navigateChart('move-left')} title="查看更早K线" aria-label="查看更早K线">
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
            <button type="button" onClick={() => navigateChart('move-right')} title="查看更新K线" aria-label="查看更新K线">
              <ChevronRight size={15} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>
      <a className="chart-attribution" href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
        Charts by TradingView Lightweight Charts
      </a>
    </section>
  );
}

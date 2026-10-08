import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppearance } from '../../hooks/useAppearance';
import { chartAppearance } from './chart-appearance';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Minimize,
  Focus,
  Layers3,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useWorkspaceState } from '../../hooks/useWorkspaceState';
import type {
  IntradayInterval,
  SectorStock,
  StockIntradayResponse,
  StockRealtimeResponse,
} from '../../lib/api';
import {
  formatShanghaiTime,
  selectIntradayBars,
  selectRealtimeStockQuote,
  type QuoteTone,
} from '../../lib/realtime-format';
import {
  buildIndicatorData,
  buildCurrentDayChartBars,
  buildMovingAverageData,
  buildVolumeData,
  buildVolumeMovingAverageData,
  formatChartVolume,
  getAvailableChartIndicators,
  getAvailableMaKeys,
  type AuxiliaryChartIndicator,
  type ChartBar,
} from './chart-data';
import {
  navigateLogicalRange,
  type ChartNavigationAction,
} from './chart-navigation';
import { IntradayCandlestickChart } from './IntradayCandlestickChart';
import { useChartExecutions } from './useChartExecutions';
import { ChartExecutions } from './ChartExecutions';
import { createSeriesUpdater } from './series-updater';
import { useTradingDaySnapshots } from '../../hooks/useQuoteSnapshots';
import { selectQuoteSnapshots, type ChartMode } from '../../lib/quote-snapshots';
import { AuctionPanel } from './AuctionPanel';
import { QuoteSnapshotChart } from './QuoteSnapshotChart';

interface ProfessionalCandlestickChartProps {
  stock: SectorStock | null;
  stockCode?: string;
  stockName?: string;
  loading?: boolean;
  realtimeData?: StockRealtimeResponse | null;
  realtimeLoading?: boolean;
  realtimeDelayed?: boolean;
  realtimeError?: string | null;
  intradayData?: StockIntradayResponse | null;
  intradayLoading?: boolean;
  intradayDelayed?: boolean;
  intradayError?: string | null;
  chartMode?: ChartMode;
  quoteTradeDate?: string;
  onChartModeChange?: (mode: ChartMode) => void;
  intradayInterval?: IntradayInterval;
  onIntradayIntervalChange?: (interval: IntradayInterval) => void;
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
const INTRADAY_INTERVALS: Array<{ value: IntradayInterval; label: string }> = [
  { value: '1m', label: '1分' },
  { value: '5m', label: '5分' },
  { value: '15m', label: '15分' },
  { value: '30m', label: '30分' },
  { value: '60m', label: '60分' },
  { value: '120m', label: '120分' },
];
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

function toneFromDirection(direction: number | null | undefined): QuoteTone {
  if (typeof direction !== 'number' || !Number.isFinite(direction) || direction === 0) {
    return 'flat';
  }
  return direction > 0 ? 'rise' : 'fall';
}

function toneClass(tone: QuoteTone): string {
  return `market-${tone}`;
}

export function ProfessionalCandlestickChart({
  stock,
  stockCode = '',
  stockName = '',
  loading = false,
  realtimeData = null,
  realtimeLoading = false,
  realtimeDelayed = false,
  realtimeError = null,
  intradayData = null,
  intradayLoading = false,
  intradayDelayed = false,
  intradayError = null,
  chartMode = 'daily',
  quoteTradeDate,
  onChartModeChange,
  intradayInterval = '1m',
  onIntradayIntervalChange,
  onActiveDateChange,
}: ProfessionalCandlestickChartProps) {
  const { appearance } = useAppearance();
  const shellRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const executionMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const volumeExecutionMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const movingAverageSeriesRef = useRef<Array<ISeriesApi<'Line'>>>([]);
  const bollSeriesRef = useRef<Array<ISeriesApi<'Line'>>>([]);
  const auxiliarySeriesRef = useRef<Partial<Record<AuxiliaryChartIndicator, ManagedSeries[]>>>({});
  const onActiveDateChangeRef = useRef(onActiveDateChange);
  const barsRef = useRef<ChartBar[]>([]);
  const chartDataRef = useRef<ChartBar[]>([]);
  const hoveredDateRef = useRef<string | null>(null);
  const updateMainDataRef = useRef<(data: ChartBar[]) => void>(() => undefined);
  const updateAuxiliaryDataRef = useRef<Array<(data: ChartBar[]) => void>>([]);
  const selectedCode = stockCode || stock?.code || '';
  const dailyStock = stock?.code === selectedCode ? stock : null;
  const snapshotTradeDate = quoteTradeDate || intradayData?.tradeDate || realtimeData?.tradingDate || dailyStock?.tradeDate || '';
  const seconds = useTradingDaySnapshots({
    code: selectedCode, tradeDate: snapshotTradeDate,
    enabled: chartMode === 'seconds',
  });
  const secondItems = useMemo(() => selectQuoteSnapshots(seconds.data?.items ?? [], 'snapshots'), [seconds.data]);
  const intradayBars = useMemo(
    () => selectIntradayBars(
      intradayData?.items ?? [],
      selectedCode,
      intradayData?.tradeDate ?? '',
      intradayInterval,
    ),
    [intradayData, intradayInterval, selectedCode],
  );
  const currentDayIntradayBars = useMemo(
    () => selectIntradayBars(
      intradayData?.items ?? [],
      selectedCode,
      intradayData?.tradeDate ?? '',
      intradayData?.interval ?? intradayInterval,
    ),
    [intradayData, intradayInterval, selectedCode],
  );
  const selectedRealtime = useMemo(
    () => selectRealtimeStockQuote(
      realtimeData?.items ?? [],
      selectedCode,
    ),
    [realtimeData, selectedCode],
  );
  const bars = useMemo(
    () => buildCurrentDayChartBars(
      dailyStock?.kline ?? [],
      currentDayIntradayBars,
      selectedRealtime,
      realtimeData?.tradingDate ?? '',
    ),
    [currentDayIntradayBars, dailyStock, realtimeData?.tradingDate, selectedRealtime],
  );
  const availableMaKeys = useMemo(() => getAvailableMaKeys(bars), [bars]);
  const executions = useChartExecutions(selectedCode, bars, chartMode === 'daily');
  const executionClickRef = useRef(executions.openMarker);
  executionClickRef.current = executions.openMarker;
  const availableIndicators = useMemo(() => getAvailableChartIndicators(bars), [bars]);
  const bollAvailable = useMemo(
    () => BOLL_CONFIG.some(({ key }) => buildIndicatorData(bars, 'boll', key).length > 0),
    [bars],
  );
  const [activeBar, setActiveBar] = useState<ChartBar | null>(() => bars.at(-1) ?? null);
  const [showMovingAverages, setShowMovingAverages] = useWorkspaceState('chart.ma', true);
  const [showBoll, setShowBoll] = useWorkspaceState('chart.boll', false);
  const [activeIndicators, setActiveIndicators] = useWorkspaceState<AuxiliaryChartIndicator[]>('chart.indicators', [
    'volume', 'macd',
  ]);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const hasDailyBars = bars.length > 0;
  const indicatorKey = availableIndicators.join('|');
  barsRef.current = bars;

  onActiveDateChangeRef.current = onActiveDateChange;

  useEffect(() => {
    hoveredDateRef.current = null;
    onActiveDateChangeRef.current?.(null);
  }, [selectedCode, chartMode]);

  useEffect(() => {
    setActiveBar(bars.find((bar) => bar.time === hoveredDateRef.current) ?? bars.at(-1) ?? null);
  }, [bars, selectedCode, chartMode]);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    const header = shell?.querySelector<HTMLElement>('.chart-fixed-header');
    if (!shell || !header) return;
    // Keep focused execution controls below the sticky quote header, including wrapped mobile layouts.
    const update = () => { shell.style.scrollPaddingTop = `${header.offsetHeight + 8}px`; };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(header);
    window.addEventListener('resize', update);
    update();
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (chartMode !== 'daily' || !container || bars.length === 0) return;

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
    chart.applyOptions(chartAppearance(appearance));

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
    const executionMarkers = createSeriesMarkers(candleSeries, []);
    executionMarkersRef.current = executionMarkers;
    const handleExecutionClick = (param: MouseEventParams<Time>) => {
      if (param.hoveredObjectId !== undefined) executionClickRef.current(String(param.hoveredObjectId), null);
    };
    chart.subscribeClick(handleExecutionClick);
    movingAverageSeriesRef.current = MA_CONFIG
      .map(({ key, color }) => {
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          visible: showMovingAverages,
        });
        return series;
      });

    bollSeriesRef.current = BOLL_CONFIG.map(({ key, color }) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: key === 'mid' ? LineStyle.Solid : LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: showBoll,
      });
      return series;
    });

    const updateCandles = createSeriesUpdater(candleSeries);
    const updateMa = movingAverageSeriesRef.current.map(series => createSeriesUpdater(series));
    const updateBoll = bollSeriesRef.current.map(series => createSeriesUpdater(series));
    updateMainDataRef.current = (data) => {
      updateCandles(data.map((bar) => ({ time: bar.time as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close })));
      movingAverageSeriesRef.current.forEach((series, index) => {
        updateMa[index](buildMovingAverageData(data, MA_CONFIG[index].key).map((point) => ({ time: point.time as Time, value: point.value })));
      });
      bollSeriesRef.current.forEach((series, index) => {
        updateBoll[index](buildIndicatorData(data, 'boll', BOLL_CONFIG[index].key).map((point) => ({ time: point.time as Time, value: point.value })));
      });
    };

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      if (!param.time) {
        hoveredDateRef.current = null;
        setActiveBar(barsRef.current.at(-1) ?? null);
        onActiveDateChangeRef.current?.(null);
        return;
      }
      const date = String(param.time);
      const bar = barsRef.current.find((item) => item.time === date);
      if (!bar) return;
      hoveredDateRef.current = date;
      setActiveBar(bar);
      onActiveDateChangeRef.current?.(date);
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeClick(handleExecutionClick);
      executionMarkers.detach();
      executionMarkersRef.current = null;
      volumeExecutionMarkersRef.current?.detach();
      volumeExecutionMarkersRef.current = null;
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chartApiRef.current = null;
      movingAverageSeriesRef.current = [];
      bollSeriesRef.current = [];
      auxiliarySeriesRef.current = {};
      updateMainDataRef.current = () => undefined;
      updateAuxiliaryDataRef.current = [];
      chartDataRef.current = [];
      chart.remove();
    };
  }, [selectedCode, hasDailyBars, chartMode]);

  useEffect(() => {
    chartApiRef.current?.applyOptions(chartAppearance(appearance));
  }, [appearance]);

  useEffect(() => {
    const chart = chartApiRef.current;
    if (chartMode !== 'daily' || !chart || bars.length === 0) return;

    volumeExecutionMarkersRef.current?.detach();
    volumeExecutionMarkersRef.current = null;
    Object.values(auxiliarySeriesRef.current).flat().forEach((series) => {
      try {
        chart.removeSeries(series);
      } catch {
        // The parent chart may already have been replaced for a newly selected stock.
      }
    });
    auxiliarySeriesRef.current = {};
    updateAuxiliaryDataRef.current = [];

    const selected = activeIndicators.filter((indicator) => availableIndicators.includes(indicator));
    selected.forEach((indicator, index) => {
      const paneIndex = index + 1;
      const managed: ManagedSeries[] = [];
      const addLine = (
        group: Exclude<AuxiliaryChartIndicator, 'volume'>,
        key: string,
        color: string,
      ) => {
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        }, paneIndex);
        const update = createSeriesUpdater(series);
        updateAuxiliaryDataRef.current.push((data) => {
          update(buildIndicatorData(data, group, key).map((point) => ({ time: point.time as Time, value: point.value })));
        });
        managed.push(series);
      };

      if (indicator === 'volume') {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'custom', minMove: 1, formatter: formatChartVolume },
          priceLineVisible: false,
          lastValueVisible: false,
        }, paneIndex);
        volumeExecutionMarkersRef.current = createSeriesMarkers(volumeSeries, []);
        const updateVolume = createSeriesUpdater(volumeSeries);
        updateAuxiliaryDataRef.current.push((data) => {
          updateVolume(buildVolumeData(data).map((item) => ({ ...item, time: item.time as Time })));
        });
        managed.push(volumeSeries);
        VOLUME_MA_CONFIG.forEach(({ key, color }) => {
          const series = chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          }, paneIndex);
          const update = createSeriesUpdater(series);
          updateAuxiliaryDataRef.current.push((data) => {
            update(buildVolumeMovingAverageData(data, key).map((point) => ({ time: point.time as Time, value: point.value })));
          });
          managed.push(series);
        });
      } else if (indicator === 'macd') {
        AUXILIARY_LINES.macd.slice(0, 2).forEach(({ key, color }) => {
          addLine('macd', key, color);
        });
        {
          const histogram = chart.addSeries(HistogramSeries, {
            priceLineVisible: false,
            lastValueVisible: false,
          }, paneIndex);
          const update = createSeriesUpdater(histogram);
          updateAuxiliaryDataRef.current.push((data) => update(buildIndicatorData(data, 'macd', 'hist').map((point) => ({
            time: point.time as Time,
            value: point.value,
            color: point.value >= 0 ? 'rgba(240, 100, 97, 0.52)' : 'rgba(32, 185, 139, 0.52)',
          }))));
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
  }, [activeIndicators, indicatorKey, selectedCode, hasDailyBars, chartMode]);

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
    if (!chart || bars.length === 0) return;
    const previous = chartDataRef.current;
    const range = chart.timeScale().getVisibleLogicalRange();
    updateMainDataRef.current(bars);
    updateAuxiliaryDataRef.current.forEach((update) => update(bars));
    if (previous.length && range) {
      // Preserve the inspected dates, including when the oldest daily bar rolls out.
      const anchor = previous.findIndex((bar) => bars.some((next) => next.time === bar.time));
      const offset = anchor < 0 ? 0 : bars.findIndex((bar) => bar.time === previous[anchor].time) - anchor;
      const shift = range.to >= previous.length - 1 ? bars.length - previous.length : offset;
      chart.timeScale().setVisibleLogicalRange({ from: range.from + shift, to: range.to + shift });
    } else {
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - DEFAULT_WINDOW_SIZE - 0.5), to: bars.length + 0.5 });
    }
    chartDataRef.current = bars;
  }, [bars, chartMode, selectedCode, activeIndicators, indicatorKey]);

  useEffect(() => {
    executionMarkersRef.current?.setMarkers(executions.model.markers);
    volumeExecutionMarkersRef.current?.setMarkers(executions.model.volumeMarkers);
  }, [executions.model, selectedCode, hasDailyBars, chartMode, activeIndicators, indicatorKey]);

  const resetChart = () => {
    chartApiRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - DEFAULT_WINDOW_SIZE - 0.5), to: bars.length + 0.5 });
  };

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
    timeScale.setVisibleLogicalRange(nextRange);
  };
  const toggleFullscreen = async () => {
    const element = shellRef.current;
    if (!element) return;
    setFullscreenError(null);
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else if (element.requestFullscreen) await element.requestFullscreen();
      else setFullscreenError('当前浏览器不支持图表全屏');
    } catch {
      setFullscreenError('未能进入全屏，请重试');
    }
  };
  const toggleAuxiliary = (indicator: AuxiliaryChartIndicator) => {
    setActiveIndicators((current) => current.includes(indicator)
      ? current.filter((item) => item !== indicator)
      : [...current, indicator]);
  };
  const switchMode = (nextMode: ChartMode) => {
    if (nextMode === chartMode) return;
    setActiveBar(bars.at(-1) ?? null);
    onActiveDateChangeRef.current?.(null);
    onChartModeChange?.(nextMode);
  };

  const activeDailyBar = activeBar && bars.includes(activeBar) ? activeBar : bars.at(-1);
  const legend = toLegend(activeDailyBar);
  const latestBar = bars.at(-1) ?? null;
  const latestOfficialBar = dailyStock?.kline
    ?.filter((bar) => /^\d{4}-\d{2}-\d{2}$/.test(bar.date))
    .sort((left, right) => left.date.localeCompare(right.date))
    .at(-1) ?? null;
  const showingLatestBar = Boolean(latestBar && activeDailyBar?.time === latestBar.time);
  const latestIntradayBar = intradayBars.at(-1) ?? null;
  const isIntradayMode = chartMode === 'intraday';
  const isSecondsMode = chartMode === 'seconds';
  const isDailyMode = chartMode === 'daily';
  const latestSecond = secondItems.at(-1);
  const secondsState = seconds.initialLoading ? '秒级行情加载中'
    : seconds.error ? secondItems.length ? '数据可能延迟' : '秒级行情暂不可用'
      : !secondItems.length ? seconds.data?.items.length ? '当日暂无有效秒级报价' : '当日暂无秒级行情'
        : `${secondItems.length} 个采样点 · ${formatShanghaiTime(latestSecond!.observedAt)}`;
  const showingCurrentDailyPosition = !activeDailyBar || showingLatestBar;
  const realtimeTradingDate = realtimeData?.tradingDate ?? '';
  const realtimeDateIsUsable = Boolean(
    selectedRealtime
    && /^\d{4}-\d{2}-\d{2}$/.test(realtimeTradingDate)
    && (!latestOfficialBar || realtimeTradingDate >= latestOfficialBar.date),
  );
  const usableRealtime = realtimeDateIsUsable ? selectedRealtime : null;
  const realtimeDateIsNewer = Boolean(
    usableRealtime
    && realtimeTradingDate > (latestOfficialBar?.date ?? ''),
  );
  const hasTemporaryDailyBar = Boolean(
    realtimeDateIsNewer
    && latestBar?.time === realtimeTradingDate,
  );
  const realtimeDailyChangePercent = realtimeDateIsNewer
    && typeof usableRealtime?.price === 'number'
    && typeof latestOfficialBar?.close === 'number'
    && latestOfficialBar.close > 0
    ? ((usableRealtime.price - latestOfficialBar.close) / latestOfficialBar.close) * 100
    : null;
  const dailyDirection = activeDailyBar
    ? showingLatestBar
      ? realtimeDailyChangePercent ?? dailyStock?.changePercent ?? legend?.changePercent
      : legend?.changePercent
    : null;
  const priceTone = isSecondsMode
    ? toneFromDirection(latestSecond?.price && latestSecond.previousClose ? latestSecond.price - latestSecond.previousClose : null)
    : isIntradayMode
    ? usableRealtime
      ? 'flat'
      : latestIntradayBar
      ? toneFromDirection(
          (latestIntradayBar.close as number) - (latestIntradayBar.open as number),
        )
      : 'flat'
    : toneFromDirection(dailyDirection);
  const displayedPrice = isSecondsMode ? latestSecond?.price : isIntradayMode
    ? usableRealtime?.price ?? latestIntradayBar?.close
    : showingCurrentDailyPosition
      ? usableRealtime?.price ?? legend?.close ?? dailyStock?.close
      : legend?.close;
  const showingRealtimeDailyPrice = isDailyMode
    && showingCurrentDailyPosition
    && usableRealtime !== null;
  const displayedDailyChangePercent = showingRealtimeDailyPrice && realtimeDateIsNewer
    ? realtimeDailyChangePercent
    : legend?.changePercent;
  const displayedDailyDate = showingRealtimeDailyPrice && realtimeDateIsNewer
    ? realtimeTradingDate
    : legend?.time || dailyStock?.tradeDate;
  const realtimeIsDelayed = realtimeDelayed
    || Boolean(realtimeError)
    || realtimeData?.marketStatus === 'stale';
  const intradayIsDelayed = realtimeData?.marketStatus === 'stale'
    || (Boolean(intradayData) && (intradayDelayed || Boolean(intradayError)));
  const minuteState = intradayBars.length === 0
    ? intradayIsDelayed
      ? '数据可能延迟'
      : intradayLoading
        ? '分钟行情加载中'
        : !intradayData && intradayError
          ? '分钟行情暂不可用'
          : '暂无当日分钟行情'
    : intradayIsDelayed
      ? '数据可能延迟'
      : realtimeData?.marketStatus === 'closed'
        ? '已闭市 · 最后行情'
        : realtimeData?.marketStatus === 'open'
          ? '交易中'
          : '状态未知';
  const dailyState = loading
    ? dailyStock ? '日线更新中 · 保留上次行情' : '日线行情加载中'
    : dailyStock
      ? [
          showingLatestBar
            ? hasTemporaryDailyBar ? '日线 · 盘中临时日 K' : '日线 · 最新交易日'
            : '历史 K 线',
          showingLatestBar && realtimeLoading && !selectedRealtime ? '实时行情加载中' : '',
          showingLatestBar && realtimeData?.marketStatus === 'closed' ? '已闭市 · 最后行情' : '',
          showingLatestBar && realtimeIsDelayed ? '数据可能延迟' : '',
        ].filter(Boolean).join(' · ')
      : selectedRealtime
        ? [
            realtimeData?.marketStatus === 'closed' ? '已闭市 · 最后行情' : '实时行情',
            realtimeIsDelayed ? '数据可能延迟' : '',
          ].filter(Boolean).join(' · ')
        : realtimeLoading
          ? '实时行情加载中'
          : realtimeError
            ? '实时行情暂不可用'
            : '暂无日线行情';
  const activeValidIndicators = activeIndicators
    .filter((indicator) => availableIndicators.includes(indicator));
  const chartCanvasHeight = !isDailyMode
    ? MAIN_PANE_HEIGHT + AUXILIARY_PANE_HEIGHT
    : Math.max(430, MAIN_PANE_HEIGHT + activeValidIndicators.length * AUXILIARY_PANE_HEIGHT);

  const auxiliaryLegendValues = (indicator: AuxiliaryChartIndicator) => {
    const bar = activeDailyBar;
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
    const group = bar[indicator] as unknown as Record<string, number | null> | null | undefined;
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
            <strong>{stockName || stock?.name || selectedRealtime?.name || '等待选择股票'}</strong>
            <span>{stockCode || stock?.code || selectedRealtime?.code || '--'}</span>
            {(!isDailyMode ? snapshotTradeDate
              : displayedDailyDate) && (
              <span className="trade-date-chip">
                {!isDailyMode ? snapshotTradeDate
                  : displayedDailyDate}
              </span>
            )}
          </div>
          <div className="stock-price-row">
            <span className={toneClass(priceTone)}>{formatPrice(displayedPrice)}</span>
            {showingRealtimeDailyPrice && <small className="quote-source-tag">实时价</small>}
            {isDailyMode && (
              <small className={toneClass(priceTone)}>
                {displayedDailyChangePercent === null || displayedDailyChangePercent === undefined
                  ? '--'
                  : `${showingRealtimeDailyPrice && realtimeDateIsNewer ? '实时涨跌' : '日线涨跌'} ${displayedDailyChangePercent > 0 ? '+' : ''}${displayedDailyChangePercent.toFixed(2)}%`}
              </small>
            )}
          </div>
          <div className={`stock-live-state${(isSecondsMode ? seconds.delayed : isIntradayMode ? intradayIsDelayed : realtimeIsDelayed) ? ' is-delayed' : ''}`}>
            {isSecondsMode ? `秒级行情 · ${secondsState}` : isIntradayMode
              ? latestIntradayBar
                ? `分钟线 ${intradayInterval} ${formatShanghaiTime(latestIntradayBar.timestamp)} · ${minuteState}`
                : usableRealtime
                  ? `实时快照 ${formatShanghaiTime(usableRealtime.sourceTime || usableRealtime.receivedAt)} · ${minuteState}`
                  : minuteState
              : dailyState}
            {isIntradayMode && intradayBars.length === 1 && (
              <span className="intraday-single-hint"> · 当前仅有 1 根分钟 K 线</span>
            )}
          </div>
        </div>
        <div className="chart-periods" role="group" aria-label="主图周期">
          <button
            type="button"
            aria-pressed={chartMode === 'daily'}
            className={chartMode === 'daily' ? 'is-active' : ''}
            onClick={() => switchMode('daily')}
          >
            日线
          </button>
          <button
            type="button"
            aria-pressed={chartMode === 'intraday'}
            className={chartMode === 'intraday' ? 'is-active' : ''}
            onClick={() => switchMode('intraday')}
          >
            分钟线
          </button>
          <button
            type="button"
            aria-pressed={isSecondsMode}
            className={isSecondsMode ? 'is-active' : ''}
            onClick={() => switchMode('seconds')}
          >
            秒级
          </button>
        </div>
        </div>

        {isIntradayMode && (
          <div className="intraday-intervals" role="group" aria-label="分时周期">
            {INTRADAY_INTERVALS.map(({ value, label }) => (
              <button
                type="button"
                value={value}
                key={value}
                aria-pressed={intradayInterval === value}
                className={intradayInterval === value ? 'is-active' : ''}
                onClick={() => onIntradayIntervalChange?.(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isSecondsMode && <div className="snapshot-controls">
          <span>全天走势 · 09:30–15:00</span>
          <span>按实际采样展示 · 通常约 5 秒一笔</span>
        </div>}

        {isDailyMode && <div className="chart-toolbar">
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
          <button onClick={fitChart} disabled={!hasDailyBars} title="适配全部 K 线" aria-label="适配全部 K 线"><Focus size={14} /></button>
          <button onClick={resetChart} disabled={!hasDailyBars} title="回到最近 60 个交易日" aria-label="重置窗口"><RotateCcw size={14} /></button>
          <button onClick={() => void toggleFullscreen()} title={fullscreen ? '退出全屏' : '全屏图表'} aria-label={fullscreen ? '退出全屏' : '全屏图表'}>{fullscreen ? <Minimize size={14} /> : <Expand size={14} />}</button>
        </div>
        </div>}

        {isDailyMode && <div className="indicator-legend-board" aria-label="当前指标图例">
        {showMovingAverages && availableMaKeys.length > 0 && (
          <div className="indicator-legend-row">
            <strong>MA</strong>
            {MA_CONFIG.filter(({ key }) => availableMaKeys.includes(key)).flatMap(({ key, label, color }) => {
              const value = activeDailyBar?.ma?.[key];
              return typeof value === 'number' && Number.isFinite(value)
                ? [<span key={key}><i style={{ background: color }} />{label} <b>{formatIndicator(value)}</b></span>]
                : [];
            })}
          </div>
        )}
        {showBoll && bollAvailable && (
          <div className="indicator-legend-row">
            <strong>BOLL</strong>
            {BOLL_CONFIG.flatMap(({ key, label, color }) => {
              const value = activeDailyBar?.boll?.[key];
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
        </div>}
      </div>

      {fullscreenError && <div className="chart-action-error" role="alert">{fullscreenError}</div>}
      {isDailyMode && <ChartExecutions state={executions} portalContainer={fullscreen ? shellRef.current : undefined} />}
      <div className={`chart-canvas-shell${isIntradayMode ? ' has-auction' : ''}`} style={{ height: chartCanvasHeight }}>
        {isSecondsMode ? (
          <div className="seconds-chart-content">
            {seconds.data?.possiblyTruncated && <div className="snapshot-notice" role="status">部分秒级数据可能未完整返回</div>}
            {seconds.delayed && secondItems.length > 0 && <div className="snapshot-notice" role="status">刷新失败，保留上次秒级行情</div>}
            {secondItems.length > 0 ? <QuoteSnapshotChart items={secondItems} datasetKey={`${selectedCode}:${snapshotTradeDate}:seconds`} /> : (
              <div className="terminal-empty snapshot-empty" role="status">
                {seconds.initialLoading && <span className="loading-pulse" />}
                <span>{secondsState}</span>
                {!seconds.initialLoading && !seconds.error && <small>当前交易日尚无已采集的有效报价</small>}
                {seconds.error && <button type="button" onClick={seconds.refresh}>重试</button>}
              </div>
            )}
          </div>
        ) : isIntradayMode ? (
          <div className="intraday-with-auction">
            <AuctionPanel code={selectedCode} tradeDate={snapshotTradeDate} />
            <div className="intraday-minute-panel">
              {intradayBars.length > 0 ? (
                <IntradayCandlestickChart
                  bars={intradayBars}
                  stockCode={selectedCode}
                  tradingDate={intradayData?.tradeDate}
                />
              ) : (
                <div className="terminal-empty">
                  {intradayLoading && <span className="loading-pulse" />}
                  {minuteState}
                </div>
              )}
            </div>
          </div>
        ) : loading && bars.length === 0 ? (
          <div className="terminal-empty"><span className="loading-pulse" />正在加载个股行情...</div>
        ) : bars.length === 0 ? (
          <div className="terminal-empty">请选择包含有效日 K 数据的股票</div>
        ) : (
          <div ref={chartContainerRef} className="chart-canvas" />
        )}
        {isDailyMode && bars.length > 0 && (
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

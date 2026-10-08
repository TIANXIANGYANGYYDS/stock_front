import { useEffect, useRef } from 'react';
import { useAppearance } from '../../hooks/useAppearance';
import { chartAppearance } from './chart-appearance';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import type { StockIntradayBar } from '../../lib/api';
import { createSeriesUpdater } from './series-updater';

interface IntradayCandlestickChartProps {
  bars: StockIntradayBar[];
  stockCode: string;
  tradingDate?: string;
}

type SeriesUpdate<T extends 'Candlestick' | 'Histogram'> = (data: Parameters<ISeriesApi<T>['setData']>[0]) => void;

const RISE_COLOR = '#f06461';
const FALL_COLOR = '#20b98b';
const SHANGHAI_MINUTE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function toEpochSeconds(timestamp: string): Time {
  return Math.floor(new Date(timestamp).getTime() / 1_000) as Time;
}

function formatShanghaiMinute(time: Time): string {
  if (typeof time !== 'number') return '';
  const parts = Object.fromEntries(
    SHANGHAI_MINUTE_FORMATTER
      .formatToParts(new Date(time * 1_000))
      .filter((part) => part.type === 'hour' || part.type === 'minute')
      .map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return hour && parts.minute ? `${hour}:${parts.minute}` : '';
}

export function IntradayCandlestickChart({
  bars,
  stockCode,
  tradingDate,
}: IntradayCandlestickChartProps) {
  const { appearance } = useAppearance();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const fittedDatasetRef = useRef<string | null>(null);
  const previousBarsRef = useRef<StockIntradayBar[]>([]);
  const updateCandlesRef = useRef<SeriesUpdate<'Candlestick'> | null>(null);
  const updateVolumeRef = useRef<SeriesUpdate<'Histogram'> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
          color: 'rgba(151, 170, 194, 0.64)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#334359',
        },
        horzLine: {
          color: 'rgba(151, 170, 194, 0.64)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#334359',
        },
      },
      timeScale: {
        borderColor: 'rgba(60, 79, 103, 0.42)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 1.5,
        barSpacing: 8,
        minBarSpacing: 0.5,
        fixLeftEdge: true,
        tickMarkFormatter: formatShanghaiMinute,
      },
      rightPriceScale: {
        borderColor: 'rgba(60, 79, 103, 0.42)',
        scaleMargins: { top: 0.08, bottom: 0.04 },
      },
      localization: {
        locale: 'zh-CN',
        timeFormatter: formatShanghaiMinute,
      },
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
    chartRef.current = chart;
    chart.applyOptions(chartAppearance(appearance));
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: RISE_COLOR,
      downColor: FALL_COLOR,
      borderVisible: false,
      wickUpColor: 'rgba(240, 100, 97, 0.86)',
      wickDownColor: 'rgba(32, 185, 139, 0.86)',
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    }, 1);
    updateCandlesRef.current = createSeriesUpdater(candleSeriesRef.current);
    updateVolumeRef.current = createSeriesUpdater(volumeSeriesRef.current);
    chart.panes()[0]?.setStretchFactor(3);
    chart.panes()[1]?.setStretchFactor(1);

    return () => {
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      updateCandlesRef.current = null;
      updateVolumeRef.current = null;
      fittedDatasetRef.current = null;
      previousBarsRef.current = [];
      chart.remove();
    };
  }, []);

  useEffect(() => { chartRef.current?.applyOptions(chartAppearance(appearance)); }, [appearance]);

  useEffect(() => {
    const datasetKey = `${stockCode}:${tradingDate ?? ''}:${bars[0]?.interval ?? ''}`;
    if (fittedDatasetRef.current !== datasetKey) {
      if (candleSeriesRef.current) updateCandlesRef.current = createSeriesUpdater(candleSeriesRef.current);
      if (volumeSeriesRef.current) updateVolumeRef.current = createSeriesUpdater(volumeSeriesRef.current);
    }
    const range = chartRef.current?.timeScale().getVisibleLogicalRange();
    updateCandlesRef.current?.(bars.map((bar) => ({
      time: toEpochSeconds(bar.timestamp),
      open: bar.open as number,
      high: bar.high as number,
      low: bar.low as number,
      close: bar.close as number,
    })));
    updateVolumeRef.current?.(bars.flatMap((bar) => (
      typeof bar.volume === 'number' && Number.isFinite(bar.volume)
        ? [{
            time: toEpochSeconds(bar.timestamp),
            value: bar.volume,
            color: (bar.close as number) >= (bar.open as number)
              ? 'rgba(240, 100, 97, 0.52)'
              : 'rgba(32, 185, 139, 0.52)',
          }]
        : []
    )));

    if (bars.length > 0 && fittedDatasetRef.current !== datasetKey) {
      chartRef.current?.timeScale().fitContent();
      fittedDatasetRef.current = datasetKey;
    } else if (range && previousBarsRef.current.length) {
      const previous = previousBarsRef.current;
      const anchor = previous.findIndex(bar => bars.some(next => next.timestamp === bar.timestamp));
      const offset = anchor < 0 ? 0 : bars.findIndex(bar => bar.timestamp === previous[anchor].timestamp) - anchor;
      // Follow the live edge only when the user was already viewing the latest bars.
      const shift = range.to >= previous.length - 1 ? bars.length - previous.length : offset;
      chartRef.current?.timeScale().setVisibleLogicalRange({ from: range.from + shift, to: range.to + shift });
    }
    previousBarsRef.current = bars;
  }, [bars, stockCode, tradingDate]);

  return <div ref={containerRef} className="chart-canvas intraday-chart-canvas" />;
}

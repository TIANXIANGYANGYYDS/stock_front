import { useEffect, useRef } from 'react';
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

interface IntradayCandlestickChartProps {
  bars: StockIntradayBar[];
  stockCode: string;
  tradingDate?: string;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const fittedDatasetRef = useRef<string | null>(null);

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
        minBarSpacing: 4,
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
    chart.panes()[0]?.setStretchFactor(3);
    chart.panes()[1]?.setStretchFactor(1);

    return () => {
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      fittedDatasetRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    candleSeriesRef.current?.setData(bars.map((bar) => ({
      time: toEpochSeconds(bar.timestamp),
      open: bar.open as number,
      high: bar.high as number,
      low: bar.low as number,
      close: bar.close as number,
    })));
    volumeSeriesRef.current?.setData(bars.flatMap((bar) => (
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

    const datasetKey = `${stockCode}:${tradingDate ?? ''}:${bars[0]?.interval ?? ''}`;
    if (bars.length > 0 && fittedDatasetRef.current !== datasetKey) {
      chartRef.current?.timeScale().fitContent();
      fittedDatasetRef.current = datasetKey;
    }
  }, [bars, stockCode, tradingDate]);

  return <div ref={containerRef} className="chart-canvas intraday-chart-canvas" />;
}

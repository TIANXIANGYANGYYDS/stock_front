import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineSeries, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { useAppearance } from '../../hooks/useAppearance';
import { formatShanghaiTime } from '../../lib/realtime-format';
import { snapshotPhaseLabel, type QuoteSnapshot } from '../../lib/quote-snapshots';
import { chartAppearance } from './chart-appearance';
import { createSeriesUpdater } from './series-updater';
import { navigateLogicalRange, type ChartNavigationAction } from './chart-navigation';

const epoch = (row: QuoteSnapshot) => Math.floor(Date.parse(row.observedAt) / 1000) as Time;
const formatTime = (time: Time) => typeof time === 'number' ? formatShanghaiTime(new Date(time * 1000).toISOString()) : '';
const price = (value: number | null | undefined) => typeof value === 'number' && value > 0 ? value.toFixed(2) : '--';
const volume = (value: number | null) => value === null ? '--' : value.toLocaleString('zh-CN', { maximumFractionDigits: 0 });

export function QuoteSnapshotChart({ items, auction = false, datasetKey }: {
  items: QuoteSnapshot[]; auction?: boolean; datasetKey: string;
}) {
  const { appearance } = useAppearance();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Array<ISeriesApi<'Line'>>>([]);
  const updatersRef = useRef<Array<(data: Parameters<ISeriesApi<'Line'>['setData']>[0]) => void>>([]);
  const fittedRef = useRef(false);
  const previousCountRef = useRef(0);
  const [hoveredTime, setHoveredTime] = useState<Time | null>(null);
  const byTime = useMemo(() => new Map(items.map(row => [epoch(row), row])), [items]);
  const selected = (hoveredTime !== null ? byTime.get(hoveredTime) : null) ?? items.at(-1);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      ...chartAppearance(appearance), autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: true, minBarSpacing: 0.01, rightOffset: 2, fixLeftEdge: true, tickMarkFormatter: formatTime },
      localization: { locale: 'zh-CN', timeFormatter: formatTime },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
    chartRef.current = chart;
    seriesRef.current = (auction ? ['#f06461', '#20b98b'] : ['#4c82e8']).map(color => chart.addSeries(LineSeries, {
      color, lineWidth: 2, lastValueVisible: !auction, priceLineVisible: !auction,
      crosshairMarkerVisible: true, pointMarkersVisible: auction, pointMarkersRadius: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    }));
    updatersRef.current = seriesRef.current.map(series => createSeriesUpdater(series));
    chart.subscribeCrosshairMove(event => setHoveredTime(event.time ?? null));
    fittedRef.current = false;
    previousCountRef.current = 0;
    return () => { chart.remove(); chartRef.current = null; };
  }, [auction, datasetKey]);

  useEffect(() => { chartRef.current?.applyOptions(chartAppearance(appearance)); }, [appearance, auction, datasetKey]);
  useEffect(() => {
    const range = chartRef.current?.timeScale().getVisibleLogicalRange();
    const showingWholeDay = !auction && range && range.from <= 0.5 && range.to >= previousCountRef.current - 1;
    const value = (row: QuoteSnapshot, index: number) => auction ? (index === 0 ? row.bids : row.asks)[0]?.[0] : row.price;
    updatersRef.current.forEach((update, index) => update(items.map(row => {
      const next = value(row, index);
      return typeof next === 'number' && next > 0 ? { time: epoch(row), value: next } : { time: epoch(row) };
    })));
    seriesRef.current.forEach(series => series.applyOptions({ pointMarkersVisible: auction || items.length === 1 }));
    if (items.length && (!fittedRef.current || (showingWholeDay && items.length !== previousCountRef.current))) {
      chartRef.current?.timeScale().fitContent();
      fittedRef.current = true;
    }
    previousCountRef.current = items.length;
  }, [items, auction, datasetKey]);

  const navigateChart = (action: ChartNavigationAction) => {
    const timeScale = chartRef.current?.timeScale();
    if (!timeScale) return;
    const range = navigateLogicalRange(timeScale.getVisibleLogicalRange(), action, items.length);
    if (range) timeScale.setVisibleLogicalRange(range);
  };

  return (
    <div className={`snapshot-chart${auction ? ' is-auction' : ''}`}>
      <div className="snapshot-legend" aria-live="off">
        <span>{selected ? formatShanghaiTime(selected.observedAt) : '--'} · {snapshotPhaseLabel(selected?.phase ?? '')}</span>
        {auction ? <>
          <span className="market-rise">买一 {price(selected?.bids[0]?.[0])}</span>
          <span className="market-fall">卖一 {price(selected?.asks[0]?.[0])}</span>
        </> : <>
          <span>最新成交价 <b>{price(selected?.price)}</b></span>
          <span>累计成交量 {volume(selected?.volume ?? null)} 股</span>
        </>}
      </div>
      <div className="snapshot-plot">
        <div ref={containerRef} className="snapshot-chart-canvas" aria-label={auction ? '集合竞价原始买卖报价走势' : '秒级报价走势'} />
        {!auction && <div className="chart-navigation-controls snapshot-navigation-controls" role="group" aria-label="秒级图导航">
          <button type="button" onClick={() => navigateChart('zoom-out')} title="缩小秒级图" aria-label="缩小秒级图"><Minus size={14} strokeWidth={2.2} /></button>
          <button type="button" onClick={() => navigateChart('zoom-in')} title="放大秒级图" aria-label="放大秒级图"><Plus size={14} strokeWidth={2.2} /></button>
          <button type="button" onClick={() => navigateChart('move-left')} title="查看更早秒级行情" aria-label="查看更早秒级行情"><ChevronLeft size={15} strokeWidth={2.2} /></button>
          <button type="button" onClick={() => navigateChart('move-right')} title="查看更新秒级行情" aria-label="查看更新秒级行情"><ChevronRight size={15} strokeWidth={2.2} /></button>
        </div>}
      </div>
      <div className="snapshot-footnote">
        {selected && <span>行情时间 {formatShanghaiTime(selected.sourceTime)} · {selected.provider}</span>}
        <span>{auction ? '买卖一档原始报价，竞价含义待核验' : '按采集时间展示 · 秒级采样快照'}</span>
      </div>
    </div>
  );
}

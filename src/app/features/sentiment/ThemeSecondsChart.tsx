import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers3, ListFilter, MessageSquare, Radio } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SentimentStock, SentimentScope } from './sentiment-contract';
import { pct as percentage, stockStatus } from './sentiment-live-model';
import { alignSecondSeries, secondsClock, type SentimentSecondSeries } from './sentiment-seconds';
import { SESSION_HALF, sessionAxisLabel, sessionAxisTime } from './sentiment-day-series';
import { useThemeDaySeries } from './useThemeDaySeries';
import { SentimentStockComparison } from './SentimentStockComparison';
import { BehaviorBroadcast, SentimentEventRail } from './SentimentEventRail';
import { SentimentLaneChart } from './SentimentLaneChart';
import { SentimentChartReadout } from './SentimentChartReadout';
import { behaviorSelection, chartBehaviors, type BehaviorFilter } from './sentiment-event-view';

const color = (index: number) => `var(--sent-series-${index % 10})`;
type TrackedStock = { stock: SentimentStock & { name: string }; series: SentimentSecondSeries; color: string };

export const ThemeSecondsChart = memo(function ThemeSecondsChart({ themeName, stocks, members, asOf, archiveAsOf = asOf, publication, snapshotId, playing, onStock, sampleInterval = 5, scope = 'all_a' }: {
  scope?: SentimentScope; themeName: string; stocks: SentimentStock[]; members: SentimentStock[];
  asOf: string; archiveAsOf?: string; publication?: string; snapshotId?: string; playing: boolean; onStock: (code: string) => void; sampleInterval?: number;
}) {
  const [session, setSession] = useState<'day' | 'morning' | 'afternoon'>('day');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState(true);
  const [mode, setMode] = useState<'overlay' | 'lanes'>('overlay');
  const [eventFilter, setEventFilter] = useState<BehaviorFilter>('all');
  const [pinnedEventId, setPinnedEventId] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 480, height: 300 });
  const focusStock = useCallback((code: string) => { setSelectedCode(current => current === code ? null : code); setPinnedEventId(null); }, []);
  const resetFocus = useCallback(() => { setSelectedCode(null); setPinnedEventId(null); }, []);
  const plotRoot = useRef<HTMLDivElement>(null);
  const quoteDock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!plotRoot.current) return;
    const observer = new ResizeObserver(([entry]) => { const { width, height } = entry.contentRect; if (width > 0 && height > 0) setSize(current => current.width === width && current.height === height ? current : { width, height }); });
    observer.observe(plotRoot.current); return () => observer.disconnect();
  }, [stocks.length > 0]);
  const tradeDate = asOf.slice(0, 10);
  const history = useThemeDaySeries(stocks.slice(0, 7).map(stock => stock.code), tradeDate, archiveAsOf, scope, publication, snapshotId);
  const tracked = useMemo<TrackedStock[]>(() => {
    const codes = new Set(stocks.slice(0, 7).map(stock => stock.code));
    const identities = [...members].filter(stock => codes.has(stock.code)).sort((a, b) => a.code.localeCompare(b.code)).map(stock => stock.code);
    return stocks.slice(0, 7).map((stock, index) => {
      const limit = stock.price != null && stock.price > 0 && stock.change_ratio != null && stock.limit_up_price != null
        ? stock.limit_up_price / (stock.price / (1 + stock.change_ratio)) - 1 : null;
      return { stock: { ...stock, name: stock.name ?? stock.code }, series: { ...history.states[index].series, limit_ratio: limit }, color: color(identities.indexOf(stock.code)) };
    });
  }, [stocks, members, history.states]);
  const selected = tracked.find(item => item.stock.code === selectedCode);
  const focusCode = selected?.stock.code ?? null;
  const cutoff = Date.parse(archiveAsOf);
  const start = Date.parse(`${tradeDate}T${session === 'afternoon' ? '13:00:00' : '09:30:00'}+08:00`);
  const end = Date.parse(`${tradeDate}T${session === 'morning' ? '11:30:00' : '15:00:00'}+08:00`) + 999;
  const axisStart = session === 'afternoon' ? SESSION_HALF : 0;
  const axisEnd = session === 'morning' ? SESSION_HALF : SESSION_HALF * 2;
  const curves = history.curves;
  const rows = useMemo(() => alignSecondSeries(curves, start, Math.min(end, cutoff)).map((row): Record<string, number | null> & { time: number; x: number } => ({ ...row, x: sessionAxisTime(tradeDate, row.time) })), [curves, start, end, cutoff, tradeDate]);
  const rowsByX = useMemo(() => new Map(rows.map(row => [row.x, row])), [rows]);
  const values = useMemo(() => rows.flatMap(row => curves.map(item => row[item.code]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))), [rows, curves]);
  const lineData = useMemo(() => new Map(curves.map(item => [item.code, item.points.filter(point => point.time >= start && point.time <= Math.min(end, cutoff)).map(point => ({ x: sessionAxisTime(tradeDate, point.time), time: point.time, [item.code]: point.change_ratio === null ? null : point.change_ratio * 100 }))])), [curves, start, end, cutoff, tradeDate]);
  const limits = [...new Set(tracked.flatMap(item => item.series.limit_ratio === null ? [] : [Math.round(item.series.limit_ratio * 100)]))];
  const maximum = Math.max(10, ...values, ...limits);
  const bottom = Math.floor(Math.min(0, ...values)) - .5;
  const top = maximum + Math.max(.35, (maximum - bottom) * .06);
  const chartDomain = useMemo<[number, number]>(() => [bottom, top], [bottom, top]);
  const tickStep = maximum - bottom > 12 ? 4 : 2;
  const priceTicks = Array.from({ length: Math.floor((maximum - Math.ceil(bottom / tickStep) * tickStep) / tickStep) + 1 }, (_, i) => Math.ceil(bottom / tickStep) * tickStep + i * tickStep);
  const sparkDomain = useMemo<[number, number]>(() => {
    let low = 0, high = 1;
    for (const series of curves) for (const point of series.points) if (point.time <= cutoff && point.change_ratio != null) {
      low = Math.min(low, point.change_ratio * 100); high = Math.max(high, point.change_ratio * 100);
    }
    return [low - .5, high + .5];
  }, [curves, cutoff]);
  const dayEnd = Date.parse(`${tradeDate}T15:00:00.999+08:00`);
  const behaviors = useMemo(() => chartBehaviors(tracked, start, Math.min(end, cutoff), focusCode, eventFilter), [tracked, start, end, cutoff, focusCode, eventFilter]);
  const selection = behaviorSelection(behaviors, pinnedEventId);
  const active = showEvents ? selection.active : null;
  const emphasisCode = focusCode ?? (active && !selection.following ? active.event.code : null);
  const insetLeft = mode === 'lanes' ? size.width < 540 ? 78 : 112 : 8;
  const eventPosition = useCallback((time: number) => (sessionAxisTime(tradeDate, time) - axisStart) / (axisEnd - axisStart), [tradeDate, axisStart, axisEnd]);
  const ticks = [0, SESSION_HALF / 2, SESSION_HALF, SESSION_HALF * 1.5, SESSION_HALF * 2]
    .filter(time => time >= axisStart && time <= axisEnd && (size.width >= 450 || session !== 'day' || time % SESSION_HALF === 0));
  const ordered = [...tracked].sort((a, b) => Number(a.stock.code === emphasisCode) - Number(b.stock.code === emphasisCode));
  const advancing = tracked.filter(({ stock }) => stock.change_ratio != null && stock.change_ratio > 0).length;
  const declining = tracked.filter(({ stock }) => stock.change_ratio != null && stock.change_ratio < 0).length;

  return <div className="sent-seconds-panel" data-theme-chart={themeName} ref={history.containerRef}>
    <div className="sent-seconds-toolbar"><span className="sent-seconds-label"><Radio size={16} className={playing ? 'is-playing' : ''} />全天秒级走势<span>采样 {sampleInterval}s</span></span>
      <div className="sent-seconds-actions"><div className="sent-segment sent-chart-mode" aria-label="走势显示方式"><button type="button" aria-pressed={mode === 'overlay'} onClick={() => setMode('overlay')}><Layers3 size={13} />叠加对比</button><button type="button" aria-pressed={mode === 'lanes'} onClick={() => setMode('lanes')}><ListFilter size={13} />分轨对照</button></div><button type="button" className="sent-annotation-toggle" aria-label={`${themeName}事件标注`} aria-pressed={showEvents} title="显示或隐藏行为播报与时间轴" onClick={() => setShowEvents(value => !value)}><MessageSquare size={12} /><span>行为</span></button>
        <div className="sent-segment" aria-label={`${themeName}图表时间范围`}>{([['day', '全天'], ['morning', '上午'], ['afternoon', '下午']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={session === value} onClick={() => { setSession(value); setPinnedEventId(null); }}>{label}</button>)}</div>
      </div>
    </div>
    <div className="sent-comparison-layout"><div className="sent-curve-column">
    <div className="sent-curve-overview"><div>{selected ? <><span className="sent-curve-eyebrow"><i style={{ background: selected.color }} />当前聚焦 · {selected.stock.code}</span><strong>{selected.stock.name}<b className={(selected.stock.change_ratio ?? 0) < 0 ? 'is-fall' : 'is-rise'}>{percentage(selected.stock.change_ratio, 2, true)}</b></strong><span className="sent-curve-caption"><span>现价 {selected.stock.price?.toFixed(2) ?? '—'}</span><span>{stockStatus(selected.stock)}</span><span>距日内高点 {percentage(selected.stock.drawdown_from_high_ratio, 2, true)}</span></span></> : <><span className="sent-curve-eyebrow">涨幅对比 / %</span><strong>{tracked.length} 股全天对比</strong><span className="sent-curve-caption"><span className="is-rise">上涨 {advancing}</span><span className="is-fall">下跌 {declining}</span><span>仅当前 {tracked.length} 只</span></span></>}</div><div className="sent-curve-asof"><time><i className={playing ? 'is-playing' : ''} />{secondsClock(Date.parse(asOf))}</time><span>快照观察时间</span>{selected && <button type="button" onClick={resetFocus}>恢复全部曲线</button>}</div></div>
    {showEvents && <BehaviorBroadcast items={behaviors} active={active} index={selection.index} following={selection.following} newerCount={selection.newerCount} filter={eventFilter} loading={history.loading} failed={!!history.eventError}
      onFilter={filter => { setEventFilter(filter); setPinnedEventId(null); }} onSelect={setPinnedEventId} onFollow={() => setPinnedEventId(null)} onStock={onStock} />}
    <div className="sent-quote-dock" ref={quoteDock}><SentimentChartReadout stocks={tracked} asOf={Date.parse(asOf)} focused={emphasisCode} onFocus={focusStock} /></div>
    {mode === 'lanes' && <div className="sent-lane-key">同一时间 / 同一涨幅刻度 · 右侧为时段末点 <span>{percentage(bottom / 100, 1, true)} ～ {percentage(top / 100, 1, true)}</span></div>}
    {tracked.length ? <div className={`sent-seconds-plot${mode === 'lanes' ? ' is-lanes' : ''}`} ref={plotRoot} role="group" aria-label={`${themeName}前 ${tracked.length} 只股票全天秒级涨幅${mode === 'lanes' ? '分轨' : '叠加'}图`}>
      {!rows.length && <div className="sent-chart-wait">{history.loading || history.loaded < tracked.length && !history.error ? '正在加载开盘以来的秒级走势…' : history.error ? '秒级历史暂时不可用' : '此时段暂无已归档秒级行情'}<br /><small>{tradeDate} · {session === 'afternoon' ? '13:00' : '09:30'} 起</small></div>}
      {mode === 'lanes' ? <SentimentLaneChart stocks={tracked} width={size.width} height={size.height} insetLeft={insetLeft} from={start} to={Math.min(end, cutoff)} axisStart={axisStart} axisEnd={axisEnd} tradeDate={tradeDate} domain={chartDomain} ticks={ticks} focused={emphasisCode} active={active} rows={rows} quoteDock={quoteDock} asOf={Date.parse(asOf)} onFocus={focusStock} /> : <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={rows} margin={{ top: 12, right: 4, bottom: 4, left: 8 }} accessibilityLayer>
          <CartesianGrid stroke="var(--terminal-border)" strokeOpacity={.5} vertical={false} strokeDasharray="2 5" />
          <XAxis dataKey="x" type="number" domain={[axisStart, axisEnd]} ticks={ticks} allowDataOverflow tickLine={false} axisLine={{ stroke: 'var(--terminal-border)' }} interval={0} height={32} tickMargin={10}
            tick={({ x, y, payload, index }) => <text x={x} y={Number(y) + 4} textAnchor={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'} fill="var(--terminal-muted)" fontSize={size.width < 400 ? 10 : 12} fontFamily="var(--terminal-mono)">{Number(payload.value) === SESSION_HALF && session !== 'day' ? session === 'morning' ? '11:30' : '13:00' : sessionAxisLabel(Number(payload.value))}</text>} />
          <YAxis domain={[bottom, top]} ticks={priceTicks} allowDataOverflow orientation="right" width={56} tickMargin={9} tickLine={false} axisLine={false} tickFormatter={value => `${value > 0 ? '+' : ''}${value.toFixed(0)}`} tick={{ fill: 'var(--terminal-muted)', fontSize: 12, fontFamily: 'var(--terminal-mono)' }} />
          <ReferenceLine y={0} stroke="var(--terminal-muted)" strokeOpacity={.45} strokeDasharray="3 4" label={{ value: '昨收 0%', position: 'insideBottomRight', fill: 'var(--terminal-muted)', fontSize: 11 }} />
          {limits.map(limit => <ReferenceLine key={limit} y={limit} stroke="var(--terminal-muted)" strokeOpacity={.3} strokeDasharray="4 4" label={{ value: `${limit}% 参考`, position: 'insideTopRight', fill: 'var(--terminal-muted)', fontSize: 11 }} />)}
          <Tooltip isAnimationActive={false} cursor={{ stroke: 'var(--terminal-muted)', strokeWidth: 1, strokeDasharray: '3 3' }} wrapperStyle={{ pointerEvents: 'none' }}
            content={({ active: inspecting, label }) => { const row = rowsByX.get(Number(label)); return inspecting && row && quoteDock.current ? createPortal(<SentimentChartReadout stocks={tracked} asOf={Date.parse(asOf)} row={row} />, quoteDock.current) : null; }} />
          {ordered.map(item => <Line key={item.stock.code} name={item.stock.name ?? item.stock.code} dataKey={item.stock.code} type="linear" stroke={item.color}
            data={lineData.get(item.stock.code)}
            strokeWidth={emphasisCode === item.stock.code ? 2.3 : 1.4} strokeOpacity={emphasisCode && emphasisCode !== item.stock.code ? .2 : .9} strokeLinejoin="round" strokeLinecap="round"
            dot={item.series.points.length === 1 ? { r: 2 } : false} activeDot={{ r: 3, stroke: 'var(--terminal-panel)', strokeWidth: 1.5 }} connectNulls={false} isAnimationActive={false}
            onClick={() => focusStock(item.stock.code)} />)}
          {ordered.map(item => { const last = item.series.points.filter(point => point.time >= start && point.time <= Math.min(end, cutoff)).at(-1); return last?.change_ratio != null ? <ReferenceDot key={`end-${item.stock.code}`} x={sessionAxisTime(tradeDate, last.time)} y={last.change_ratio * 100} r={focusCode === item.stock.code ? 3.5 : 2}
            fill={item.color} stroke="var(--terminal-panel)" strokeWidth={1} opacity={emphasisCode && emphasisCode !== item.stock.code ? .15 : 1} /> : null; })}
          {active && <ReferenceLine className="sent-active-event-guide" x={sessionAxisTime(tradeDate, active.event.time)} stroke={active.color} strokeWidth={1} strokeOpacity={.6} strokeDasharray="3 4" />}
          {active && <ReferenceDot className="sent-active-event-dot" x={sessionAxisTime(tradeDate, active.event.time)} y={active.event.change_ratio * 100} r={5} fill="var(--terminal-panel)" stroke={active.color} strokeWidth={2} />}
        </LineChart>
      </ResponsiveContainer>}
    </div> : <div className="sent-seconds-empty">暂无符合筛选的股票</div>}
    {(history.loading && history.loaded < tracked.length || history.error || history.eventError || history.truncated) && <div className="sent-day-history-status" role="status"><span>{history.error ? '部分秒级走势读取失败' : history.eventError ? '事件标注读取失败' : history.truncated ? '部分秒级采样尚未完整返回' : `已获取 ${history.started} / ${tracked.length} 只走势 · 全天历史加载中 ${history.loaded} / ${tracked.length}`}</span>{(history.error || history.eventError || history.truncated) && <button type="button" onClick={history.retry}>重新读取</button>}</div>}
    {showEvents && <SentimentEventRail items={behaviors} activeId={active?.event.id} width={size.width} insetLeft={insetLeft} position={eventPosition} onSelect={setPinnedEventId} />}
    <div className="sent-seconds-hint"><span>午休压缩 · 缺失采样留空{archiveAsOf !== asOf && <span> · 查询至 {secondsClock(Math.min(cutoff, end))}</span>}</span><span>移动光标查看上方读数</span></div>
    </div>
    {!!tracked.length && <SentimentStockComparison items={tracked} focusCode={emphasisCode} tradeDate={tradeDate} through={Math.min(cutoff, dayEnd)} domain={sparkDomain} onFocus={focusStock} onStock={onStock} onReset={resetFocus} />}
    </div>
  </div>;
});

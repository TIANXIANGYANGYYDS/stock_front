import { memo, useMemo, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { ComparisonStock } from './SentimentStockComparison';
import { SentimentChartReadout } from './SentimentChartReadout';
import { closestQuoteRow, type ChartBehavior, type QuoteChartRow } from './sentiment-event-view';
import { sparklinePath } from './sentiment-movement';
import { SESSION_HALF, sessionAxisLabel, sessionAxisTime } from './sentiment-day-series';
import { pct } from './sentiment-live-model';

export const SentimentLaneChart = memo(function SentimentLaneChart({ stocks, width, height, insetLeft, from, to, axisStart, axisEnd, tradeDate, domain, ticks, focused, active, rows, quoteDock, asOf, onFocus }: {
  stocks: ComparisonStock[]; width: number; height: number; insetLeft: number; from: number; to: number; axisStart: number; axisEnd: number;
  tradeDate: string; domain: [number, number]; ticks: number[]; focused: string | null; active: ChartBehavior | null; rows: QuoteChartRow[];
  quoteDock: RefObject<HTMLDivElement>; asOf: number; onFocus: (code: string) => void;
}) {
  const [hoverRow, setHoverRow] = useState<QuoteChartRow>();
  const plotWidth = Math.max(40, width - insetLeft - 60), laneHeight = (height - 38) / Math.max(stocks.length, 1);
  const x = (time: number) => insetLeft + (sessionAxisTime(tradeDate, time) - axisStart) / (axisEnd - axisStart) * plotWidth;
  const laneY = (value: number) => laneHeight - 11 - (value - domain[0]) / (domain[1] - domain[0]) * (laneHeight - 14);
  const visuals = useMemo(() => stocks.map(item => { const points = item.series.points.filter(p => p.time >= from && p.time <= to); return {
    path: sparklinePath(points, time => (sessionAxisTime(tradeDate, time) - axisStart) / (axisEnd - axisStart), domain, plotWidth + 4, laneHeight - 8), last: points.at(-1),
  }; }),
  [stocks, from, to, tradeDate, axisStart, axisEnd, domain, plotWidth, laneHeight]);
  return <><svg className="sent-lane-chart" width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="七股分轨对照，所有股票使用同一涨幅刻度"
    onPointerMove={e => { const rect = e.currentTarget.getBoundingClientRect(), point = (e.clientX - rect.left) * width / rect.width; const row = point >= insetLeft && point <= width - 60 ? closestQuoteRow(rows, axisStart + (point - insetLeft) / plotWidth * (axisEnd - axisStart)) : undefined; setHoverRow(row); }} onPointerLeave={() => setHoverRow(undefined)}>
    {ticks.map(tick => <line key={tick} x1={insetLeft + (tick - axisStart) / (axisEnd - axisStart) * plotWidth} x2={insetLeft + (tick - axisStart) / (axisEnd - axisStart) * plotWidth} y1={0} y2={height - 38} stroke="var(--terminal-border)" strokeOpacity={.6} strokeDasharray="2 4" />)}
    {stocks.map((item, index) => { const y = index * laneHeight + 4, highlighted = focused === item.stock.code; return <g key={item.stock.code} className={`sent-lane-stock${highlighted ? ' is-selected' : ''}`} role="button" tabIndex={0} aria-label={`分轨聚焦${item.stock.name}`} aria-pressed={highlighted} onClick={() => onFocus(item.stock.code)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(item.stock.code); } }}>
      <rect x={0} y={y - 4} width={width} height={laneHeight} fill={highlighted ? item.color : 'transparent'} fillOpacity={highlighted ? .06 : 1} rx={5} />
      <line x1={0} x2={width} y1={y + laneHeight - 4} y2={y + laneHeight - 4} stroke="var(--terminal-border)" strokeOpacity={.6} />
      <text x={3} y={y + laneHeight / 2 - 10} fontSize={width < 540 ? 12 : 14} fontWeight={550} fill="var(--terminal-text)">{item.stock.name}</text>
      <text x={3} y={y + laneHeight / 2 + 7} fontSize={10} fontFamily="var(--terminal-mono)" fill="var(--terminal-muted)">{item.stock.code}</text>
      <path d={visuals[index].path} transform={`translate(${insetLeft - 2} ${y})`} fill="none" stroke={item.color} strokeWidth={highlighted ? 2 : 1.45} strokeOpacity={focused && !highlighted ? .4 : 1} strokeLinejoin="round" strokeLinecap="round" />
      <text x={width - 1} y={y + laneHeight / 2} textAnchor="end" fontSize={11} fontFamily="var(--terminal-mono)" fill={item.color}>{pct(visuals[index].last?.change_ratio, 2, true)}</text>
      {active?.event.code === item.stock.code && <circle className="sent-active-event-dot" cx={x(active.event.time)} cy={y + laneY(active.event.change_ratio * 100)} r={4} fill="var(--terminal-panel)" stroke={item.color} strokeWidth={2} />}
    </g>; })}
    {active && <line className="sent-active-event-guide" x1={x(active.event.time)} x2={x(active.event.time)} y1={0} y2={height - 38} stroke={active.color} strokeWidth={1} opacity={.6} strokeDasharray="3 4" pointerEvents="none" />}
    {hoverRow && <line x1={x(hoverRow.time)} x2={x(hoverRow.time)} y1={0} y2={height - 38} stroke="var(--terminal-muted)" strokeDasharray="2 3" pointerEvents="none" />}
    {ticks.map((tick, index) => <text key={tick} x={insetLeft + (tick - axisStart) / (axisEnd - axisStart) * plotWidth} y={height - 8} textAnchor={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'} fill="var(--terminal-muted)" fontSize={width < 540 ? 9 : 11} fontFamily="var(--terminal-mono)">{tick === SESSION_HALF && axisStart === SESSION_HALF ? '13:00' : tick === SESSION_HALF && axisEnd === SESSION_HALF ? '11:30' : sessionAxisLabel(tick)}</text>)}
  </svg>{hoverRow && quoteDock.current && createPortal(<SentimentChartReadout stocks={stocks} asOf={asOf} row={hoverRow} />, quoteDock.current)}</>;
});

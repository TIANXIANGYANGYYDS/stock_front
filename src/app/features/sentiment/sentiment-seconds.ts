/** Chart data is supplied by the data layer; the UI never infers limit events from a line.
 * `time` is epoch milliseconds; `change_ratio` is a decimal (0.1 means 10%).
 * A future REST/SSE adapter can map ISO +08:00 timestamps into this display contract.
 */
import { PRICE_EVENT_KINDS } from './sentiment-contract';
export interface SentimentSecondPoint { time: number; change_ratio: number | null; sourceTime?: number }
export interface SentimentSecondEvent {
  id: string;
  code: string;
  time: number;
  observedTime?: number; sourceTime?: number;
  kind: (typeof PRICE_EVENT_KINDS)[keyof typeof PRICE_EVENT_KINDS];
  evidence?: Record<string, unknown>; rule_version?: string | null; cooldown_seconds?: number | null;
  change_ratio: number;
}
export interface SentimentSecondSeries {
  code: string;
  limit_ratio: number | null;
  points: SentimentSecondPoint[];
  events: SentimentSecondEvent[];
}
export const secondsClock = (timestamp: number) => new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(11, 19);

/** Align observations by timestamp without forward filling missing observations. */
export function alignSecondSeries(series: SentimentSecondSeries[], from: number, to: number) {
  const rows = new Map<number, Record<string, number | null> & { time: number }>();
  for (const item of series) for (const point of item.points) {
    if (point.time < from || point.time > to) continue;
    if (!rows.has(point.time)) rows.set(point.time, { time: point.time });
    rows.get(point.time)![item.code] = point.change_ratio === null ? null : point.change_ratio * 100;
  }
  return [...rows.values()].sort((a, b) => a.time - b.time);
}

/** Prefer one recent event of each kind, then recent additional events, in a small panel. */
export function selectChartEvents(series: SentimentSecondSeries[], from: number, to: number, selectedCode: string | null, limit = 3) {
  const candidates = series.filter(item => !selectedCode || item.code === selectedCode).flatMap(item => item.events)
    .filter(event => event.time >= from && event.time <= to).sort((a, b) => b.time - a.time || a.id.localeCompare(b.id));
  const chosen: SentimentSecondEvent[] = [];
  for (const kind of Object.values(PRICE_EVENT_KINDS)) {
    const event = candidates.find(item => item.kind === kind);
    if (event && chosen.length < limit) chosen.push(event);
  }
  for (const event of candidates) if (chosen.length < limit && !chosen.includes(event)) chosen.push(event);
  return chosen.sort((a, b) => a.time - b.time);
}

export interface EventLabelPlacement { event: SentimentSecondEvent; left: number; top: number; width: number }
/** Keep flags close to the actual quote, trying both sides of the curve before moving away. */
export function layoutEventLabels(events: SentimentSecondEvent[], from: number, to: number, plotWidth: number, plotHeight: number, domain: [number, number]): EventLabelPlacement[] {
  const placed: EventLabelPlacement[] = [];
  const width = Math.min(150, plotWidth);
  const clampX = (x: number) => Math.max(0, Math.min(plotWidth - width, x));
  const clampY = (y: number) => Math.max(2, Math.min(plotHeight - 30, y));
  for (const event of events) {
    const x = (event.time - from) / Math.max(1, to - from) * plotWidth;
    const y = (domain[1] - event.change_ratio * 100) / (domain[1] - domain[0]) * plotHeight;
    const candidates = [-40, 14, -78, 52, -116, 90].flatMap(offset =>
      [x - width / 2, x + 10, x - width - 10].map(left => ({ left: clampX(left), top: clampY(y + offset) })));
    const fits = ({ left, top }: { left: number; top: number }) => placed.every(other =>
      left + width + 6 <= other.left || left >= other.left + other.width + 6 || top + 34 <= other.top || top >= other.top + 34);
    const candidate = candidates.find(fits) ?? candidates[candidates.length - 1];
    placed.push({ event, ...candidate, width });
  }
  return placed;
}

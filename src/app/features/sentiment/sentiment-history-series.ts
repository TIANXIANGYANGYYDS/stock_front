import type { TimeseriesPoint } from './sentiment-contract';

const MINUTE = 60_000;
const LUNCH_COMPRESSION = 89 * MINUTE;

export interface HistoryChartPoint {
  time: number;
  timestamp: number | null;
  up: number | null;
  broken: number | null;
}

export function historyTimeLabel(timestamp: number, interval: '1m' | '1d') {
  return interval === '1m'
    ? new Date(timestamp + 8 * 3600_000).toISOString().slice(11, 16)
    : new Date(timestamp).toISOString().slice(5, 10);
}

export function buildHistorySeries(items: TimeseriesPoint[], interval: '1m' | '1d', tradeDate: string, themeId?: string) {
  const morningEnd = Date.parse(`${tradeDate}T11:30:00+08:00`);
  const afternoonStart = Date.parse(`${tradeDate}T13:00:00+08:00`);
  // Keep one observation slot between 11:30 and 13:00 so each retains its own hover target.
  const axisTime = (timestamp: number) => interval === '1m' && timestamp >= afternoonStart
    ? timestamp - LUNCH_COMPRESSION : timestamp;
  const data: HistoryChartPoint[] = [];
  const points = items.map(point => ({ point, timestamp: Date.parse(point.timestamp) }))
    .filter(({ timestamp }) => Number.isFinite(timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  for (const { point, timestamp } of points) {
    // Lunch snapshots can contain null observations. They are outside the trading session,
    // not missing trading minutes, and must not split the morning and afternoon curves.
    if (interval === '1m' && timestamp >= morningEnd + MINUTE && timestamp < afternoonStart) continue;
    const time = axisTime(timestamp);
    const values = (themeId ? point.theme : point.market)?.values;
    const last = data.at(-1);
    if (interval === '1m' && last && time - last.time > 90_000) {
      data.push({ time: last.time + 1, timestamp: null, up: null, broken: null });
    }
    data.push({ time, timestamp, up: values?.limit_up ?? null, broken: values?.broken ?? null });
  }
  const lunchBoundary = morningEnd + MINUTE / 2;
  const timestamps = [...new Set(data.filter(point => point.timestamp !== null).map(point => point.time))];
  const ticks = interval === '1m'
    ? [axisTime(Date.parse(`${tradeDate}T09:30:00+08:00`)), axisTime(Date.parse(`${tradeDate}T10:30:00+08:00`)), lunchBoundary,
      axisTime(Date.parse(`${tradeDate}T14:00:00+08:00`)), axisTime(Date.parse(`${tradeDate}T15:00:00+08:00`))]
      .filter(time => time >= (data[0]?.time ?? Infinity) && time <= (data.at(-1)?.time ?? -Infinity))
    : timestamps.filter((_, index) => index === timestamps.length - 1 || index % Math.max(1, Math.ceil(timestamps.length / 5)) === 0);
  const label = (time: number) => interval === '1m' && time === lunchBoundary
    ? '11:30 / 13:00'
    : historyTimeLabel(interval === '1m' && time >= morningEnd + MINUTE ? time + LUNCH_COMPRESSION : time, interval);
  const spansLunch = interval === '1m' && (data[0]?.time ?? Infinity) < lunchBoundary && (data.at(-1)?.time ?? -Infinity) > lunchBoundary;
  return { data, ticks, label, lunchBoundary: spansLunch ? lunchBoundary : undefined };
}

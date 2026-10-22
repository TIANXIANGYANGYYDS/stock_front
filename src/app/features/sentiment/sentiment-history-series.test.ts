import { expect, it } from 'vitest';
import type { TimeseriesPoint } from './sentiment-contract';
import { buildHistorySeries, historyTimeLabel } from './sentiment-history-series';

const date = '2026-10-16';
const point = (time: string, up: number | null = 77, broken: number | null = 21) => ({
  timestamp: `${date}T${time}:00+08:00`, market: { values: { limit_up: up, broken } },
}) as TimeseriesPoint;

it('joins lunch across empty lunchtime snapshots while keeping both real boundary observations', () => {
  const series = buildHistorySeries([
    point('11:29', 78), point('11:30', 77), point('11:31', null, null),
    point('11:34', null, null), point('13:00', 85, 20), point('13:01', 84),
  ], '1m', date);
  expect(series.data.map(p => p.up)).toEqual([78, 77, 85, 84]);
  expect(series.data[2].time - series.data[1].time).toBe(60_000);
  expect(series.data.map(p => historyTimeLabel(p.timestamp!, '1m'))).toEqual(['11:29', '11:30', '13:00', '13:01']);
  expect(series.label(series.lunchBoundary!)).toBe('11:30 / 13:00');
  expect(series.label(series.data[2].time)).toBe('13:00');
  expect(series.ticks).toContain(series.lunchBoundary);
});

it('still breaks real missing trading minutes, including gaps spanning lunch', () => {
  const series = buildHistorySeries([point('10:00'), point('10:03'), point('11:29'), point('13:02')], '1m', date);
  expect(series.data.filter(p => p.timestamp === null)).toHaveLength(3);
  expect(series.data.at(-2)?.up).toBeNull();
});

it('preserves explicit nulls within the session and at both lunch endpoints independently per line', () => {
  const series = buildHistorySeries([
    point('11:29', null, 20), point('11:30', 77, null), point('12:00', null, null),
    point('13:00', null, 21), point('13:01', 84, 22),
  ], '1m', date);
  expect(series.data.map(p => [p.up, p.broken])).toEqual([[null, 20], [77, null], [null, 21], [84, 22]]);
});

it('applies the same time axis to theme statistics and keeps daily dates uncompressed', () => {
  const items = [point('11:30'), point('13:00')].map((p, i) => ({ ...p, theme: { values: { limit_up: i + 1, broken: 0 } } } as TimeseriesPoint));
  expect(buildHistorySeries(items, '1m', date, 'theme-id').data.map(p => p.up)).toEqual([1, 2]);
  const daily = buildHistorySeries([point('13:00'), { ...point('13:00'), timestamp: '2026-10-19T13:00:00+08:00' }], '1d', date);
  expect(daily.data.map(p => p.time)).toEqual(daily.data.map(p => p.timestamp));
  expect(daily.data).toHaveLength(2);
  expect(daily.label(daily.data[0].time)).toBe('10-16');
  expect(daily.lunchBoundary).toBeUndefined();
});

it('accepts UTC timestamps and leaves preopen, postclose and empty responses intact', () => {
  const utc = [point('09:15'), point('11:30'), point('13:00'), point('15:04')].map(p => ({ ...p, timestamp: new Date(p.timestamp).toISOString() })).reverse();
  const series = buildHistorySeries(utc, '1m', date);
  expect(series.data.filter(p => p.timestamp !== null).map(p => historyTimeLabel(p.timestamp!, '1m'))).toEqual(['09:15', '11:30', '13:00', '15:04']);
  expect(series.label(series.data.at(-1)!.time)).toBe('15:04');
  expect(buildHistorySeries([], '1m', date)).toMatchObject({ data: [], ticks: [], lunchBoundary: undefined });
});

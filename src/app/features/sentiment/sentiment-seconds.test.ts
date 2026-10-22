import { describe, expect, it } from 'vitest';
import { createDemoSnapshot } from './sentiment-demo';
import { alignSecondSeries, layoutEventLabels, selectChartEvents, type SentimentSecondSeries } from './sentiment-seconds';

describe('theme second-level overlays', () => {
  it('aligns samples by their real time without turning absent quotes into a price', () => {
    const series: SentimentSecondSeries[] = [
      { code: 'one', limit_ratio: .1, events: [], points: [{ time: 1000, change_ratio: .08 }, { time: 2000, change_ratio: null }, { time: 3000, change_ratio: .1 }] },
      { code: 'two', limit_ratio: .1, events: [], points: [{ time: 2000, change_ratio: .09 }, { time: 3000, change_ratio: .095 }] },
    ];
    expect(alignSecondSeries(series, 1000, 3000)).toEqual([
      { time: 1000, one: 8 }, { time: 2000, one: null, two: 9 }, { time: 3000, one: 10, two: 9.5 },
    ]);
    expect(alignSecondSeries(series, 2000, 2000)).toHaveLength(1);
  });

  it('appends one sample per second without changing previously displayed history or exposing future events', () => {
    const before = createDemoSnapshot(0, 0);
    const next = createDemoSnapshot(0, 1);
    const afterOpen = createDemoSnapshot(1, 5);
    const a = before.seconds.find(item => item.code === '002031')!;
    const b = next.seconds.find(item => item.code === a.code)!;
    const c = afterOpen.seconds.find(item => item.code === a.code)!;
    expect(b.points.slice(0, -1)).toEqual(a.points);
    expect(b.points.at(-1)!.time - a.points.at(-1)!.time).toBe(1000);
    expect(a.events.every(event => event.time <= Date.parse(before.meta.as_of))).toBe(true);
    expect(c.events.at(-1)!.kind).toBe('开板');
    expect(c.points.at(-1)!.change_ratio).toBe(afterOpen.stocks.find(stock => stock.code === a.code)!.change_ratio);
    expect(c.points.at(-1)!.change_ratio).toBeLessThan(c.limit_ratio);
  });

  it('preserves opened series and returns both open and reseal annotations for the focused stock', () => {
    const snapshot = createDemoSnapshot(3, 15);
    const end = Date.parse(snapshot.meta.as_of);
    const markers = selectChartEvents(snapshot.seconds, end - 60000, end, '002031');
    expect(markers.map(event => event.kind)).toEqual(['开板', '回封']);
    expect(markers.every(event => event.code === '002031')).toBe(true);
    const series = snapshot.seconds.find(item => item.code === '002031')!;
    expect(series.points.at(-1)!.change_ratio).toBe(series.limit_ratio);
  });

  it('keeps simultaneous event flags close to their quotes, inside the plot and without overlaps', () => {
    const events = ['封板', '开板', '回封'].map((kind, index) => ({ id: String(index), code: String(index), time: 999, kind: kind as '封板' | '开板' | '回封', change_ratio: .1 }));
    const labels = layoutEventLabels(events, 0, 1000, 220, 240, [7, 10.6]);
    expect(labels.every(label => label.left >= 0 && label.left + label.width <= 220 && label.top >= 0 && label.top + 28 <= 240)).toBe(true);
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      expect(a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + 28 <= b.top || b.top + 28 <= a.top).toBe(true);
    }
  });
});

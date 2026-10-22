import { describe, expect, it } from 'vitest';
import { behaviorSelection, chartBehaviors, closestQuoteRow, groupBehaviorMarkers, type ChartBehavior } from './sentiment-event-view';
import type { ComparisonStock } from './SentimentStockComparison';

const event = (id: string, time: number, kind: ChartBehavior['event']['kind'] = '开板'): ChartBehavior => ({ name: '测试股票', color: '#f00', event: { id, time, code: '000001', kind, change_ratio: .09 } });
describe('linked behavior timeline', () => {
  it('keeps a pinned observation visible when new events arrive, and follows only when requested', () => {
    const initial = [event('all_a:opaque:one', 1), event('arbitrary/two', 2)];
    const next = [...initial, event('not-a-number', 3)];
    expect(behaviorSelection(initial, null).active?.event.id).toBe('arbitrary/two');
    expect(behaviorSelection(next, 'arbitrary/two')).toMatchObject({ following: false, index: 1, newerCount: 1, active: initial[1] });
    expect(behaviorSelection(next, null).active?.event.id).toBe('not-a-number');
    expect(behaviorSelection([], 'missing').active).toBeNull();
    expect(behaviorSelection(initial, 'removed').following).toBe(true);
  });
  it('groups crowded markers without losing events or merging the whole session through chained neighbors', () => {
    const items = [event('a', 0), event('b', 10), event('c', 22), event('d', 33), event('e', 950)];
    const groups = groupBehaviorMarkers(items, time => time / 1000, 1000);
    expect(groups.map(group => group.items.length)).toEqual([3, 1, 1]);
    expect(groups.flatMap(group => group.items)).toEqual(items);
    expect(groups[0].position).toBe(.011);
    expect(groupBehaviorMarkers(items, time => time / 1000, 100).length).toBeLessThan(groups.length);
  });
  it('deduplicates opaque IDs and respects stock, event type, and visible time limits', () => {
    const source = { stock: { code: '000001', name: '测试股票' }, color: '#f00', series: { events: [event('a', 10).event, event('a', 10).event, event('b', 20, '回封').event, event('c', 100).event] } } as ComparisonStock;
    expect(chartBehaviors([source], 0, 50, null, 'all').map(item => item.event.id)).toEqual(['a', 'b']);
    expect(chartBehaviors([source], 0, 50, '000001', '回封').map(item => item.event.id)).toEqual(['b']);
    expect(chartBehaviors([source], 0, 50, '000002', 'all')).toEqual([]);
  });
  it('never displays an unrelated quote in a missing interval or future blank space', () => {
    const rows = [{ time: 1000, x: 1000, '000001': 9 }, { time: 2000, x: 2000, '000001': null }, { time: 60000, x: 60000, '000001': 10 }];
    expect(closestQuoteRow(rows, 1700)).toBe(rows[1]);
    expect(closestQuoteRow(rows, 35000)).toBeUndefined();
    expect(closestQuoteRow(rows, 100000)).toBeUndefined();
    expect(closestQuoteRow([], 0)).toBeUndefined();
  });
});

import { expect, it } from 'vitest';
import { buildExecutionMarkers, formatRecordedExecutionPrice } from './execution-markers';
import { rangeItem } from '../quant/execution-range-test-fixtures';

it('uses the Shanghai trade date and bar-relative positions, preserving all same-day executions', () => {
  const items = [rangeItem(), rangeItem({ event_id: 'buy-2', execution_price: 999.123456789 }),
    rangeItem({ event_id: 'sell', action: 'sell', execution_at: '2026-08-19T23:59:59-08:00' })];
  const model = buildExecutionMarkers(items, ['2026-08-20']);
  expect(model.markers.map(item => [item.time, item.position, item.text])).toEqual([
    ['2026-08-20', 'belowBar', '买入 ×2'], ['2026-08-20', 'aboveBar', '卖出 · ¥4.002001'],
  ]);
  expect(model.volumeMarkers.map(item => [item.time, item.position, item.shape, item.text])).toEqual([
    ['2026-08-20', 'aboveBar', 'arrowDown', '买入 ×2'], ['2026-08-20', 'aboveBar', 'arrowDown', '卖出'],
  ]);
  expect(model.volumeMarkers.every(item => !('price' in item))).toBe(true);
  expect(model.markers.every(item => !('price' in item))).toBe(true);
  expect(model.groups.flatMap(group => group.items)).toHaveLength(3);
  expect(model.filled[1].execution_price).toBe(999.123456789);
});

it('retains unlocated records and never moves them to a neighbouring K-line or treats pending signals as fills', () => {
  const model = buildExecutionMarkers([rangeItem(), rangeItem({ event_id: 'unknown-date', trade_date: null }),
    rangeItem({ event_id: 'not-filled', status: 'pending_execution' })], ['2026-08-21']);
  expect(model.markers).toEqual([]); expect(model.volumeMarkers).toEqual([]); expect(model.unlocated).toHaveLength(2); expect(model.filled).toHaveLength(2);
});

it('preserves recorded price precision, zero and unavailable values', () => {
  expect(formatRecordedExecutionPrice(4.002001)).toBe('4.002001');
  expect(formatRecordedExecutionPrice(0)).toBe('0');
  expect(formatRecordedExecutionPrice(null)).toBe('—'); expect(formatRecordedExecutionPrice(undefined)).toBe('—');
});

import { describe, expect, it } from 'vitest';
import { nextQuantSort, sortQuantItems } from './quant-sort';
import { parseQuantDateTime } from './quant-format';

describe('quant sorting', () => {
  const rows = [
    { code: '000002', at: '2026-09-04T09:39:00+08:00', amount: null },
    { code: '000001', at: '2026-09-04T10:48:00+08:00', amount: 3 },
    { code: '000003', at: '2026-09-04T10:00:00+08:00', amount: 1 },
  ];

  it('sorts timestamps newest first without mutating the response', () => {
    const sorted = sortQuantItems(rows, { key: 'at', direction: 'desc' }, {
      at: (item) => parseQuantDateTime(item.at),
    });
    expect(sorted.map((item) => item.code)).toEqual(['000001', '000003', '000002']);
    expect(rows[0].code).toBe('000002');
  });

  it('always keeps missing values at the end', () => {
    const sorted = sortQuantItems(rows, { key: 'amount', direction: 'desc' }, {
      amount: (item) => item.amount,
    });
    expect(sorted.map((item) => item.amount)).toEqual([3, 1, null]);
  });

  it('uses the column default first and toggles an active column', () => {
    const current = { key: 'at' as const, direction: 'desc' as const };
    expect(nextQuantSort(current, 'at', 'desc')).toEqual({ key: 'at', direction: 'asc' });
    expect(nextQuantSort(current, 'amount', 'desc')).toEqual({ key: 'amount', direction: 'desc' });
  });

  it('orders actual instants across offsets and date boundaries, keeping ties stable and invalid times last', () => {
    const mixed = [
      { id: 'earlier', at: '2026-09-04T09:39:00+08:00' },
      { id: 'later', at: '2026-09-04T02:00:00Z' },
      { id: 'same-later', at: '2026-09-04 10:00:00' },
      { id: 'previous-day', at: '2026-09-03T23:59:59+08:00' },
      { id: 'invalid', at: 'not-a-date' },
      { id: 'missing', at: null },
    ];
    const selectors = { at: (item: typeof mixed[number]) => parseQuantDateTime(item.at) };
    expect(sortQuantItems(mixed, { key: 'at', direction: 'desc' }, selectors).map((item) => item.id))
      .toEqual(['later', 'same-later', 'earlier', 'previous-day', 'invalid', 'missing']);
    expect(sortQuantItems(mixed, { key: 'at', direction: 'asc' }, selectors).map((item) => item.id))
      .toEqual(['previous-day', 'earlier', 'later', 'same-later', 'invalid', 'missing']);
  });
});

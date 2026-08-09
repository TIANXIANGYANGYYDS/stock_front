import { describe, expect, it } from 'vitest';
import { mapKlineBar } from './api';

describe('mapKlineBar', () => {
  it('preserves price, amount, volume, and change fields from the backend', () => {
    expect(
      mapKlineBar({
        trade_date: '2026-08-08',
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        amount: 123456,
        volume: 7890,
        change_amount: 1,
        pct_chg: 10,
      }),
    ).toEqual({
      date: '2026-08-08',
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      amount: 123456,
      volume: 7890,
      changeAmount: 1,
      changePercent: 10,
    });
  });
});

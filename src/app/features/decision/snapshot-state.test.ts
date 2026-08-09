import { describe, expect, it } from 'vitest';
import type { SectorStock } from '../../lib/api';
import { selectSnapshotBar } from './snapshot-state';

const stock: SectorStock = {
  code: '600000', name: '浦发银行', tradeDate: '2026-08-08',
  open: 11, high: 12, low: 10, close: 11.5,
  changeAmount: 0.5, changePercent: 4.5, amplitudePercent: 18,
  amount: 200, volume: 20, turnoverPercent: 2,
  ma: null, volumeMa: null, macd: null, boll: null, kdj: null,
  rsi: null, cci: null, wr: null, atr: null, chip: null,
  kline: [
    { date: '2026-08-07', open: 10, high: 11, low: 9, close: 10.5 },
    { date: '2026-08-08', open: 11, high: 12, low: 10, close: 11.5 },
  ],
};

describe('selectSnapshotBar', () => {
  it('returns the exact historical bar selected by the chart', () => {
    expect(selectSnapshotBar(stock, '2026-08-07')?.close).toBe(10.5);
  });

  it('uses the latest loaded bar only when the chart has no active historical date', () => {
    expect(selectSnapshotBar(stock, null)?.date).toBe('2026-08-08');
    expect(selectSnapshotBar(stock, '2026-08-06')).toBeNull();
  });
});

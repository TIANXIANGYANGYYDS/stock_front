import { describe, expect, it } from 'vitest';
import {
  buildIndicatorData,
  buildMovingAverageData,
  buildVolumeMovingAverageData,
  buildVolumeData,
  formatChartVolume,
  getAvailableChartIndicators,
  getAvailableMaKeys,
  normalizeChartBars,
} from './chart-data';

describe('normalizeChartBars', () => {
  it('filters invalid OHLC values, sorts dates, and keeps the last duplicate', () => {
    const result = normalizeChartBars([
      { date: '2026-01-03', open: 11, high: 13, low: 10, close: 12, amount: 8 },
      { date: '2026-01-02', open: 10, high: 12, low: 9, close: 11, amount: 5 },
      { date: '2026-01-02', open: 10, high: 13, low: 9, close: 12, amount: 6 },
      { date: '2026-01-04', open: 10, high: 9, low: 8, close: 11, amount: 4 },
      { date: '', open: 0, high: 0, low: 0, close: 0, amount: 0 },
    ]);

    expect(result.map((bar) => [bar.time, bar.close, bar.amount])).toEqual([
      ['2026-01-02', 12, 6],
      ['2026-01-03', 12, 8],
    ]);
  });
});

describe('buildMovingAverageData', () => {
  it('uses only Stock_Project MA values and skips dates where the backend value is missing', () => {
    const bars = normalizeChartBars([
      {
        date: '2026-01-01', open: 10, high: 11, low: 9, close: 10.5,
        ma: { ma5: 8.8, ma10: null, ma20: null, ma30: null, ma60: null },
      },
      {
        date: '2026-01-02', open: 11, high: 12, low: 10, close: 11.5,
        ma: { ma5: null, ma10: null, ma20: null, ma30: null, ma60: null },
      },
      {
        date: '2026-01-03', open: 12, high: 13, low: 11, close: 12.5,
        ma: { ma5: 9.6, ma10: null, ma20: null, ma30: null, ma60: null },
      },
    ]);

    expect(buildMovingAverageData(bars, 'ma5')).toEqual([
      { time: '2026-01-01', value: 8.8 },
      { time: '2026-01-03', value: 9.6 },
    ]);
  });
});

describe('buildIndicatorData', () => {
  it('reads only backend indicator points and skips null values', () => {
    const bars = normalizeChartBars([
      {
        date: '2026-01-01', open: 10, high: 11, low: 9, close: 10.5,
        kdj: { k: 61.5, d: 55.2, j: null },
      },
      {
        date: '2026-01-02', open: 11, high: 12, low: 10, close: 11.5,
        kdj: { k: null, d: 58.4, j: 70.2 },
      },
    ]);

    expect(buildIndicatorData(bars, 'kdj', 'k')).toEqual([
      { time: '2026-01-01', value: 61.5 },
    ]);
    expect(buildIndicatorData(bars, 'kdj', 'j')).toEqual([
      { time: '2026-01-02', value: 70.2 },
    ]);
  });
});

describe('buildVolumeData', () => {
  it('uses A-share red-rise and green-fall colors', () => {
    const bars = normalizeChartBars([
      { date: '2026-01-01', open: 10, high: 12, low: 9, close: 11, amount: 100 },
      { date: '2026-01-02', open: 11, high: 12, low: 9, close: 10, amount: 80 },
    ]);

    expect(buildVolumeData(bars)).toEqual([
      { time: '2026-01-01', value: 100, color: 'rgba(239, 83, 80, 0.52)' },
      { time: '2026-01-02', value: 80, color: 'rgba(24, 185, 139, 0.52)' },
    ]);
  });

  it('uses backend volume before amount so volume moving averages stay on the same scale', () => {
    const bars = normalizeChartBars([
      {
        date: '2026-01-01', open: 10, high: 12, low: 9, close: 11,
        amount: 100_000_000, volume: 8_000,
        volumeMa: { volMa5: 7_500, volMa10: null, volMa20: null, volMa60: null },
      },
    ]);

    expect(buildVolumeData(bars)[0]?.value).toBe(8_000);
    expect(buildVolumeMovingAverageData(bars, 'volMa5')).toEqual([
      { time: '2026-01-01', value: 7_500 },
    ]);
  });
});

describe('formatChartVolume', () => {
  it('formats turnover amounts using Chinese market units', () => {
    expect(formatChartVolume(600_000_000)).toBe('6.00亿');
    expect(formatChartVolume(40_000_000)).toBe('4000万');
    expect(formatChartVolume(8_500)).toBe('8500');
  });
});

describe('indicator availability', () => {
  it('exposes only groups and MA lines containing finite backend values', () => {
    const bars = normalizeChartBars([
      {
        date: '2026-01-02', open: 10, high: 12, low: 9, close: 11, amount: 100,
        ma: { ma5: 10.2, ma10: null, ma20: null, ma30: 9.8, ma60: null },
        macd: { dif: 0.3, dea: null, hist: null },
        kdj: { k: null, d: null, j: null },
        atr: { atr14: 0.55 },
      },
    ]);

    expect(getAvailableMaKeys(bars)).toEqual(['ma5', 'ma30']);
    expect(getAvailableChartIndicators(bars)).toEqual(['volume', 'macd', 'atr']);
  });

  it('does not advertise volume when both backend amount and volume are empty', () => {
    const bars = normalizeChartBars([
      { date: '2026-01-02', open: 10, high: 12, low: 9, close: 11, amount: null, volume: null },
    ]);

    expect(getAvailableChartIndicators(bars)).toEqual([]);
  });
});

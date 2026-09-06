import { describe, expect, it } from 'vitest';
import {
  buildCurrentDayChartBars,
  buildIndicatorData,
  buildMovingAverageData,
  buildVolumeMovingAverageData,
  buildVolumeData,
  formatChartVolume,
  getAvailableChartIndicators,
  getAvailableMaKeys,
  normalizeChartBars,
} from './chart-data';
import type { StockIntradayBar, StockRealtimeQuote } from '../../lib/api';

const realtimeQuote: StockRealtimeQuote = {
  code: '300308', name: '中际旭创', market: 'SZ', price: 918.38,
  sourceTime: '2026-08-12T10:00:00+08:00',
  receivedAt: '2026-08-12T10:00:01+08:00',
  volume: 300, amount: 274_000, provider: 'TENCENT',
};

function minuteBar(
  timestamp: string,
  overrides: Partial<StockIntradayBar> = {},
): StockIntradayBar {
  return {
    code: '300308', name: '中际旭创', market: 'SZ', tradeDate: '2026-08-12',
    interval: '1m', timestamp, open: 905, high: 912, low: 903, close: 910,
    volume: 100, amount: 90_000, provider: 'TENCENT', ...overrides,
  };
}

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

describe('buildCurrentDayChartBars', () => {
  const dailyBars = [{
    date: '2026-08-11', open: 880, high: 910, low: 875, close: 900,
    volume: 1_000, amount: 900_000,
  }];

  it('uses the realtime close and converts current-day share volume to historical lots', () => {
    const currentQuote: StockRealtimeQuote = {
      ...realtimeQuote,
      price: 925,
      volume: 35_000,
      amount: 32_000_000,
    };
    const result = buildCurrentDayChartBars(
      dailyBars,
      [
        minuteBar('2026-08-12T09:31:00+08:00', {
          open: 910, high: 920, low: 909, close: 916, volume: 200, amount: 184_000,
        }),
        minuteBar('2026-08-12T09:30:00+08:00'),
      ],
      currentQuote,
      '2026-08-12',
    );

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      time: '2026-08-12',
      open: 905,
      high: 925,
      low: 903,
      close: 925,
      volume: 350,
      amount: 32_000_000,
    });
    expect(result[1]?.changeAmount).toBeCloseTo(25, 8);
    expect(result[1]?.changePercent).toBeCloseTo(2.7777777777777777, 8);
  });

  it('falls back to minute totals while keeping volume in lots when realtime totals are absent', () => {
    const result = buildCurrentDayChartBars(
      dailyBars,
      [
        minuteBar('2026-08-12T09:30:00+08:00', {
          volume: 10_000,
          amount: 9_100_000,
        }),
        minuteBar('2026-08-12T09:31:00+08:00', {
          volume: 20_000,
          amount: 18_300_000,
        }),
      ],
      { ...realtimeQuote, price: null, volume: null, amount: null },
      '2026-08-12',
    );

    expect(result.at(-1)).toMatchObject({
      close: 910,
      volume: 300,
      amount: 27_400_000,
    });
  });

  it('extends moving averages and MACD through the temporary current-day bar', () => {
    const stableBars = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, '0')}`,
      open: 10,
      high: 10,
      low: 10,
      close: 10,
      volume: 100,
      amount: 100_000,
      ma: { ma5: 10, ma10: 10, ma20: 10, ma30: 10, ma60: null },
      volumeMa: { volMa5: 100, volMa10: 100, volMa20: 100, volMa60: null },
      macd: { dif: 0, dea: 0, hist: 0 },
    }));
    const currentQuote: StockRealtimeQuote = {
      ...realtimeQuote,
      price: 12,
      volume: 20_000,
      amount: 240_000,
    };
    const currentMinute = minuteBar('2026-08-12T09:30:00+08:00', {
      open: 11,
      high: 12,
      low: 11,
      close: 11.5,
      volume: 10_000,
      amount: 115_000,
    });

    const result = buildCurrentDayChartBars(
      stableBars,
      [currentMinute],
      currentQuote,
      '2026-08-12',
    );

    expect(result.at(-1)?.ma).toEqual({
      ma5: 10.4,
      ma10: 10.2,
      ma20: 10.1,
      ma30: 10.066666666666666,
      ma60: null,
    });
    expect(result.at(-1)?.volumeMa).toEqual({
      volMa5: 120,
      volMa10: 110,
      volMa20: 105,
      volMa60: null,
    });
    expect(result.at(-1)?.macd?.dif).toBeCloseTo(0.1595441595441596, 12);
    expect(result.at(-1)?.macd?.dea).toBeCloseTo(0.03190883190883192, 12);
    expect(result.at(-1)?.macd?.hist).toBeCloseTo(0.25527065527065535, 12);
  });

  it('does not fabricate a daily candle from only one realtime price', () => {
    expect(buildCurrentDayChartBars(
      dailyBars,
      [],
      realtimeQuote,
      '2026-08-12',
    )).toEqual(normalizeChartBars(dailyBars));
  });

  it('keeps the official daily candle when it already contains the realtime date', () => {
    const officialToday = {
      date: '2026-08-12', open: 906, high: 925, low: 902, close: 919,
      volume: 500, amount: 460_000,
    };
    const result = buildCurrentDayChartBars(
      [...dailyBars, officialToday],
      [minuteBar('2026-08-12T09:30:00+08:00')],
      realtimeQuote,
      '2026-08-12',
    );

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      time: '2026-08-12', open: 906, high: 925, low: 902, close: 919,
    });
  });

  it('does not append minute data from a date older than the latest official candle', () => {
    const result = buildCurrentDayChartBars(
      [{
        date: '2026-08-12', open: 906, high: 925, low: 902, close: 919,
      }],
      [minuteBar('2026-08-11T09:30:00+08:00', { tradeDate: '2026-08-11' })],
      realtimeQuote,
      '2026-08-11',
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.time).toBe('2026-08-12');
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

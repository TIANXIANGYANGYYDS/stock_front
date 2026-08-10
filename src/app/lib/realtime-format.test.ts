import { describe, expect, it } from 'vitest';
import type { MarketIndexQuote, RealtimeStockQuote, StockListItem } from './api';
import {
  formatShanghaiTime,
  marketStatusLabel,
  mergeRealtimeStockItems,
  orderMarketIndices,
  quoteTone,
  selectIntradayQuotes,
} from './realtime-format';

function indexQuote(symbol: string, name: string): MarketIndexQuote {
  return {
    symbol,
    name,
    market: symbol.endsWith('.SZ') ? 'SZ' : 'SH',
    price: 3000,
    previousClose: 2990,
    change: 10,
    changePercent: 0.33,
    open: 2991,
    high: 3001,
    low: 2988,
    volume: 100,
    amount: 200,
    sourceTime: '2026-08-10T09:30:04+08:00',
    receivedAt: '2026-08-10T09:30:05+08:00',
    status: 'live',
    provider: 'tencent',
  };
}

function stockQuote(code: string, close: number | null, amount: number | null): RealtimeStockQuote {
  return {
    code,
    name: code,
    market: 'SH',
    tradeDate: '2026-08-10',
    interval: '1m',
    timestamp: '2026-08-10T09:31:00+08:00',
    open: 10,
    high: 11,
    low: 9,
    close,
    volume: 100,
    amount,
    provider: 'TENCENT',
  };
}

function intradayQuote(
  timestamp: string,
  overrides: Partial<RealtimeStockQuote> = {},
): RealtimeStockQuote {
  return {
    code: '600519',
    name: '贵州茅台',
    market: 'SH',
    tradeDate: '2026-08-10',
    interval: '1m',
    timestamp,
    open: 10,
    high: 11,
    low: 9,
    close: 10.5,
    volume: 100,
    amount: 1000,
    provider: 'TENCENT',
    ...overrides,
  };
}

describe('realtime quote presentation rules', () => {
  it('formats ISO timestamps in Asia/Shanghai and rejects invalid input', () => {
    expect(formatShanghaiTime('2026-08-10T01:30:05Z')).toBe('09:30:05');
    expect(formatShanghaiTime('2026-08-10T09:30:05+08:00')).toBe('09:30:05');
    expect(formatShanghaiTime('not-a-date')).toBe('--:--:--');
    expect(formatShanghaiTime('')).toBe('--:--:--');
  });

  it('orders the five canonical indices and preserves missing slots', () => {
    const ordered = orderMarketIndices([
      indexQuote('000300.SH', '沪深300'),
      indexQuote('399006.SZ', '创业板指'),
      indexQuote('000001.SH', '上证指数'),
    ]);

    expect(ordered.map((item) => [item.symbol, item.quote?.name ?? null])).toEqual([
      ['000001.SH', '上证指数'],
      ['399001.SZ', null],
      ['399006.SZ', '创业板指'],
      ['000688.SH', null],
      ['000300.SH', '沪深300'],
    ]);
    expect(ordered[1].name).toBe('深证成指');
  });

  it('uses A-share rise, fall, and flat tones without guessing missing values', () => {
    expect(quoteTone(1, -2)).toBe('rise');
    expect(quoteTone(-1, 2)).toBe('fall');
    expect(quoteTone(0, 3)).toBe('flat');
    expect(quoteTone(null, 0.2)).toBe('rise');
    expect(quoteTone(null, -0.2)).toBe('fall');
    expect(quoteTone(null, null)).toBe('flat');
  });

  it('labels open, closed, and unknown backend market states', () => {
    expect(marketStatusLabel('open')).toBe('交易中');
    expect(marketStatusLabel('closed')).toBe('已闭市');
    expect(marketStatusLabel('provider_paused')).toBe('状态未知');
  });
});

describe('batch realtime stock merging', () => {
  it('overwrites close and finite amount while preserving daily percentage', () => {
    const daily: StockListItem[] = [{
      code: '600519',
      name: '贵州茅台',
      tradeDate: '2026-08-10',
      close: 1300,
      changePercent: 1.2,
      amount: 10,
    }];

    expect(mergeRealtimeStockItems(daily, [stockQuote('600519', 1348.86, 1348860)]))
      .toEqual([{
        ...daily[0],
        close: 1348.86,
        amount: 1348860,
      }]);
  });

  it('keeps daily values when realtime fields or the entire quote are missing', () => {
    const daily: StockListItem[] = [
      {
        code: '600519', name: '贵州茅台', tradeDate: '2026-08-10',
        close: 1300, changePercent: 1.2, amount: 10,
      },
      {
        code: '000001', name: '平安银行', tradeDate: '2026-08-10',
        close: 12, changePercent: -0.4, amount: 20,
      },
    ];

    expect(mergeRealtimeStockItems(daily, [stockQuote('600519', null, null)]))
      .toEqual(daily);
  });
});

describe('one-day intraday quote selection', () => {
  it('keeps valid target-date quotes, uses the later duplicate, and sorts by timestamp', () => {
    const duplicateEarlier = intradayQuote('2026-08-10T09:31:00+08:00', { close: 10.1 });
    const duplicateLater = intradayQuote('2026-08-10T09:31:00+08:00', { close: 10.2 });
    const laterQuote = intradayQuote('2026-08-10T09:35:00+08:00', { close: 10.3 });
    const items = [
      laterQuote,
      intradayQuote('2026-08-10T09:32:00+08:00', { code: '000001' }),
      intradayQuote('2026-08-10T09:33:00+08:00', { open: null }),
      intradayQuote('2026-08-10T09:34:00+08:00', { high: Number.POSITIVE_INFINITY }),
      intradayQuote('2026-08-10T09:36:00+08:00', { low: null }),
      intradayQuote('2026-08-10T09:37:00+08:00', { close: null }),
      intradayQuote('not-a-timestamp'),
      intradayQuote('2026-08-09T14:59:00+08:00'),
      duplicateEarlier,
      duplicateLater,
    ];

    expect(selectIntradayQuotes(items, '600519', '2026-08-10')).toEqual([
      duplicateLater,
      laterQuote,
    ]);
    expect(items).toEqual([
      laterQuote,
      intradayQuote('2026-08-10T09:32:00+08:00', { code: '000001' }),
      intradayQuote('2026-08-10T09:33:00+08:00', { open: null }),
      intradayQuote('2026-08-10T09:34:00+08:00', { high: Number.POSITIVE_INFINITY }),
      intradayQuote('2026-08-10T09:36:00+08:00', { low: null }),
      intradayQuote('2026-08-10T09:37:00+08:00', { close: null }),
      intradayQuote('not-a-timestamp'),
      intradayQuote('2026-08-09T14:59:00+08:00'),
      duplicateEarlier,
      duplicateLater,
    ]);
  });

  it('automatically uses the latest valid target-code Shanghai date', () => {
    const priorDay = intradayQuote('2026-08-10T15:59:00Z');
    const latestDay = intradayQuote('2026-08-10T16:01:00Z');

    expect(selectIntradayQuotes([priorDay, latestDay], '600519')).toEqual([latestDay]);
  });

  it('falls back to the latest Shanghai date when the explicit date is invalid', () => {
    const priorDay = intradayQuote('2026-08-10T15:59:00Z');
    const latestDay = intradayQuote('2026-08-10T16:01:00Z');

    expect(selectIntradayQuotes([priorDay, latestDay], '600519', 'not-a-date')).toEqual([
      latestDay,
    ]);
    expect(selectIntradayQuotes([priorDay, latestDay], '600519', '2026-02-29')).toEqual([
      latestDay,
    ]);
  });

  it('returns its single valid quote when no trading date is supplied', () => {
    const quote = intradayQuote('2026-08-10T09:31:00+08:00');

    expect(selectIntradayQuotes([quote], '600519')).toEqual([quote]);
  });
});

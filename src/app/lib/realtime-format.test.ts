import { describe, expect, it } from 'vitest';
import type {
  MarketIndexQuote,
  StockIntradayBar,
  StockListItem,
  StockRealtimeQuote,
} from './api';
import {
  formatShanghaiTime,
  marketStatusLabel,
  mergeRealtimeStockItems,
  orderMarketIndices,
  quoteTone,
  selectIntradayBars,
  selectRealtimeStockQuote,
} from './realtime-format';

function indexQuote(symbol: string, name: string): MarketIndexQuote {
  return { symbol, name, market: symbol.endsWith('.SZ') ? 'SZ' : 'SH', price: 3000, previousClose: 2990, change: 10, changePercent: 0.33, open: 2991, high: 3001, low: 2988, volume: 100, amount: 200, sourceTime: '2026-08-10T09:30:04+08:00', receivedAt: '2026-08-10T09:30:05+08:00', status: 'live', provider: 'tencent' };
}

function stockQuote(code: string, price: number | null, amount: number | null): StockRealtimeQuote {
  return { code, name: code, market: 'SH', price, sourceTime: '', receivedAt: '', volume: 100, amount, provider: 'TENCENT' };
}

function intradayBar(timestamp: string, overrides: Partial<StockIntradayBar> = {}): StockIntradayBar {
  return { code: '600519', interval: '1m', timestamp, open: 10, high: 11, low: 9, close: 10.5, volume: 100, amount: 1000, provider: 'TENCENT', ...overrides };
}

describe('realtime quote presentation rules', () => {
  it('formats ISO timestamps in Asia/Shanghai and rejects invalid input', () => {
    expect(formatShanghaiTime('2026-08-10T01:30:05Z')).toBe('09:30:05');
    expect(formatShanghaiTime('not-a-date')).toBe('--:--:--');
  });

  it('orders canonical indices and preserves missing slots', () => {
    expect(orderMarketIndices([indexQuote('000300.SH', '沪深300')]).map((item) => item.quote?.name ?? null))
      .toEqual([null, null, null, null, '沪深300']);
  });

  it('uses rise, fall, and flat tones without guessing missing values', () => {
    expect(quoteTone(1, -2)).toBe('rise');
    expect(quoteTone(-1, 2)).toBe('fall');
    expect(quoteTone(null, null)).toBe('flat');
  });

  it('labels open, closed, and unknown backend market states', () => {
    expect(marketStatusLabel('open')).toBe('交易中');
    expect(marketStatusLabel('closed')).toBe('已闭市');
    expect(marketStatusLabel('stale')).toBe('行情延迟');
    expect(marketStatusLabel('provider_paused')).toBe('状态未知');
  });
});

describe('batch realtime stock merging', () => {
  it('uses a finite snapshot price and amount while preserving daily percentage', () => {
    const daily: StockListItem[] = [{ code: '600519', name: '贵州茅台', tradeDate: '2026-08-11', close: 1300, changePercent: 1.2, amount: 10 }];
    expect(mergeRealtimeStockItems(daily, [stockQuote('600519', 1346.48, 1348860)])[0]).toMatchObject({ close: 1346.48, changePercent: 1.2, amount: 1348860 });
  });

  it('keeps daily values when snapshot fields or the entire quote are missing', () => {
    const daily: StockListItem[] = [{ code: '600519', name: '贵州茅台', tradeDate: '2026-08-10', close: 1300, changePercent: 1.2, amount: 10 }];
    expect(mergeRealtimeStockItems(daily, [stockQuote('600519', null, null)])).toEqual(daily);
  });
});

describe('latest stock snapshot selection', () => {
  it('selects the latest finite snapshot for one code using source or received time', () => {
    const earlier = { ...stockQuote('300308', 880, null), sourceTime: '2026-08-11T12:00:00+08:00' };
    const latest = { ...stockQuote('300308', 887.98, null), receivedAt: '2026-08-11T12:13:43+08:00' };
    expect(selectRealtimeStockQuote([latest, { ...earlier, price: Infinity }, earlier], '300308')).toBe(latest);
  });
});

describe('one-day intraday bar selection', () => {
  it('filters invalid items, keeps the last duplicate, and sorts bars by timestamp', () => {
    const earlierFiveMinuteBar = intradayBar('2026-08-11T09:30:00+08:00', { interval: '5m', close: 10.1 });
    const duplicateLater = intradayBar('2026-08-11T09:30:00+08:00', { interval: '5m', close: 10.2 });
    const laterFiveMinuteBar = intradayBar('2026-08-11T09:35:00+08:00', { interval: '5m', close: 10.3 });
    const items = [laterFiveMinuteBar, intradayBar('2026-08-11T09:31:00+08:00', { code: '000001' }), intradayBar('not-a-timestamp'), intradayBar('2026-08-11T09:32:00+08:00', { open: null }), earlierFiveMinuteBar, duplicateLater];
    expect(selectIntradayBars(items, '600519', '2026-08-11', '5m')).toEqual([duplicateLater, laterFiveMinuteBar]);
  });

  it('filters mismatched trade dates and intervals using response metadata', () => {
    const bar = intradayBar('2026-08-11T09:35:00+08:00', { interval: '5m' });
    expect(selectIntradayBars([bar], '600519', '2026-08-10', '5m')).toEqual([]);
    expect(selectIntradayBars([bar], '600519', '2026-08-11', '1m')).toEqual([]);
  });
});

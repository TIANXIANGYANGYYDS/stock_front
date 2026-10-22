import { describe, expect, it } from 'vitest';
import { createDemoSnapshot } from './sentiment-demo';
import { compareStocks, ladderHeight, marketStats, selectStocks, type SentimentStock } from './sentiment-model';

const fixture = createDemoSnapshot().stocks[0];
const stock = (code: string, values: Partial<SentimentStock>): SentimentStock => ({ ...fixture, code, ...values });

describe('sentiment ladder semantics', () => {
  it('prioritizes consecutive boards, then earliest sealing, then change; keeps missing times last', () => {
    const result = [
      stock('missing', { intraday_streak: 3, first_seal_at: null, change_ratio: .102 }),
      stock('later', { intraday_streak: 3, first_seal_at: '2026-10-14T10:00:00+08:00', change_ratio: .101 }),
      stock('early-low', { intraday_streak: 3, first_seal_at: '2026-10-14T09:30:00+08:00', change_ratio: .099 }),
      stock('high-board', { intraday_streak: 4, first_seal_at: null }),
      stock('early-high', { intraday_streak: 3, first_seal_at: '2026-10-14T09:30:00+08:00', change_ratio: .1 }),
    ].sort(compareStocks);
    expect(result.map(item => item.code)).toEqual(['high-board', 'early-high', 'early-low', 'later', 'missing']);
  });

  it('never treats a multi-day total as the consecutive-board height', () => {
    const item = stock('example', { intraday_streak: 3, window_days: 11, limit_up_days: 8 });
    expect(ladderHeight(item)).toBe(3);
    expect(selectStocks([item], { query: '', status: 'sealed', height: 8 })).toEqual([]);
    expect(ladderHeight({ ...item, intraday_streak: null })).toBeNull();
  });

  it('deduplicates multi-theme market counts and preserves an empty denominator', () => {
    const item = stock('shared', { theme_ids: ['one', 'two'] });
    expect(marketStats([item, { ...item }]).sealed).toBe(1);
    expect(marketStats([]).seal_ratio).toBeNull();
    expect(marketStats([]).open_ratio).toBeNull();
    expect(marketStats([stock('higher', { intraday_streak: 10 })]).ladder[0]).toEqual({ height: 10, count: 1 });
  });

  it('excludes untouched and unknown quotes from the all-touched view', () => {
    const result = selectStocks([
      stock('untouched', { limit_status: 'untouched' }), stock('unknown', { limit_status: 'unknown' }),
      stock('sealed', { limit_status: 'sealed' }), stock('opened', { limit_status: 'opened' }),
    ], { query: '', status: 'all', height: null });
    expect(result.map(item => item.code).sort()).toEqual(['opened', 'sealed']);
  });

  it('keeps opening/resealing changes consistent across counts, lists and daily history', () => {
    const before = createDemoSnapshot(0);
    const opened = createDemoSnapshot(1);
    const resealed = createDemoSnapshot(3);
    const openingStock = opened.stocks.find(item => item.code === '002031')!;
    expect(marketStats(before.stocks).sealed).toBe(48);
    expect(marketStats(opened.stocks).sealed).toBe(47);
    expect(openingStock.intraday_streak).toBeNull();
    expect(openingStock.confirmed_streak_before_today).toBe(3);
    expect(openingStock.board_history.at(-1)).toBe(false);
    expect(selectStocks(opened.stocks, { query: '002031', status: 'sealed', height: null })).toEqual([]);
    expect(selectStocks(opened.stocks, { query: '002031', status: 'opened', height: 4 })).toHaveLength(1);
    expect(marketStats(resealed.stocks).sealed).toBe(49);
    expect(resealed.stocks.find(item => item.code === '002031')!.intraday_streak).toBe(4);
    expect(resealed.stocks.find(item => item.code === '002031')!.board_history.at(-1)).toBe(true);
    expect(before.stocks.find(item => item.code === '002031')!.board_history.at(-1)).toBe(true);
  });
});

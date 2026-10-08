import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUCTION_WINDOW, SNAPSHOT_WINDOWS, getQuoteSnapshots, getSecondSnapshots,
  createTradingDaySnapshotLoader, mapQuoteSnapshot, selectQuoteSnapshots,
} from './quote-snapshots';

const raw = (overrides: Record<string, unknown> = {}) => ({
  code: '002580', observed_at: '2026-10-08T09:30:05.123+08:00', market_data_time: '2026-10-08T09:30:05+08:00',
  price: 19.52, previous_close: 19.1, volume: 12000, amount: 234240, provider: 'tencent',
  phase: 'continuous', bids: [[19.51, 1000]], asks: [[19.52, 2000]], quality_issue: null, ...overrides,
});
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('quote snapshot API', () => {
  it('uses the auction endpoint, explicit bounds, maximum batch limit and abort signal', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ data: [raw({ observed_at: '2026-10-08T09:20:00+08:00' })], possibly_truncated: true }));
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    const result = await getQuoteSnapshots('auctions', ' 002580 ', '2026-10-08', AUCTION_WINDOW, signal);
    const url = new URL(fetcher.mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toBe('/backend-api/api/v1/stocks/002580/auctions');
    expect(Object.fromEntries(url.searchParams)).toEqual({ trade_date: '2026-10-08', start_time: '09:15:00', end_time: '09:30:00', limit: '1000' });
    expect(fetcher.mock.calls[0][1].signal).toBe(signal);
    expect(result.possiblyTruncated).toBe(true);
    expect(result.items).toHaveLength(1);
  });

  it('filters other symbols, dates, invalid timestamps and observations outside the requested window', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: [raw(), raw({ code: '000001' }),
      raw({ observed_at: '2026-10-07T09:30:05+08:00' }), raw({ observed_at: 'bad' }),
      raw({ observed_at: '2026-10-08T09:45:00+08:00' })] })));
    const result = await getQuoteSnapshots('snapshots', '002580', '2026-10-08', SNAPSHOT_WINDOWS[0]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].observedAt).toBe('2026-10-08T09:30:05.123+08:00');
    expect(result.items[0].sourceTime).toBe('2026-10-08T09:30:05+08:00');
  });

  it('includes closing auction batches and the 15:00 uncross without an oversized API window', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ data: [raw({ observed_at: '2026-10-08T14:56:59+08:00' })] }))
      .mockResolvedValueOnce(json({ data: [raw({ observed_at: '2026-10-08T15:00:00+08:00' })], possibly_truncated: true }));
    vi.stubGlobal('fetch', fetcher);
    const result = await getSecondSnapshots('002580', '2026-10-08', SNAPSHOT_WINDOWS[15]);
    expect(result.items).toHaveLength(2);
    expect(result.possiblyTruncated).toBe(true);
    expect(fetcher.mock.calls[1][0]).toContain('/auctions?');
    for (const [request] of fetcher.mock.calls) {
      const params = new URL(request, 'http://localhost').searchParams;
      const duration = Date.parse(`2026-10-08T${params.get('end_time')}+08:00`) - Date.parse(`2026-10-08T${params.get('start_time')}+08:00`);
      expect(duration).toBeLessThanOrEqual(900000);
    }
  });
});

describe('quote snapshot chart data', () => {
  it('sorts actual observations and prefers usable, newer source data for duplicate seconds', () => {
    const rows = [raw({ observed_at: '2026-10-08T09:30:10+08:00' }), raw({ price: 18, quality_issue: 'stale_source_time' }),
      raw({ provider: 'sina', price: 19.6 }), raw({ price: 18.1, market_data_time: '2026-10-08T09:30:01+08:00' })];
    const result = selectQuoteSnapshots(rows.map(mapQuoteSnapshot), 'snapshots');
    expect(result.map(row => row.price)).toEqual([19.6, 19.52]);
    expect(result[0].provider).toBe('sina');
  });

  it('does not treat the previous close as an auction indicative price or remove a zero-trade auction', () => {
    const rows = [raw({ phase: 'opening_auction_locked', price: 0 }),
      raw({ phase: 'opening_auction_locked', bids: [], asks: [] })];
    const result = selectQuoteSnapshots(rows.map(mapQuoteSnapshot), 'auctions');
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(0);
    expect(result[0].bids[0][0]).toBe(19.51);
  });

  it('excludes invalid prices, invalid source times and outside-session validation snapshots', () => {
    const rows = [raw({ price: 0 }), raw({ price: 'NaN' }), raw({ market_data_time: 'bad' }), raw({ phase: 'outside_session' })];
    expect(selectQuoteSnapshots(rows.map(mapQuoteSnapshot), 'snapshots')).toEqual([]);
    expect(mapQuoteSnapshot(raw({ price: '', volume: null, amount: -1, bids: [[null, 0], ['bad', -1]] })).bids).toEqual([[null, 0], [null, null]]);
  });

});

describe('whole-day snapshots', () => {
  it('merges morning, afternoon and closing observations into one sorted day within API limits', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T15:10:00+08:00'));
    let active = 0; let peak = 0;
    const fetcher = vi.fn(async (path: string) => {
      active++; peak = Math.max(peak, active);
      await Promise.resolve();
      const url = new URL(path, 'http://localhost');
      const time = url.pathname.endsWith('/auctions') ? '15:00:00' : url.searchParams.get('start_time')!;
      active--;
      const row = raw({ observed_at: `2026-10-08T${time}+08:00`, market_data_time: `2026-10-08T${time}+08:00` });
      return json({ data: [row, row], last_observed_at: row.observed_at });
    });
    vi.stubGlobal('fetch', fetcher);
    const load = createTradingDaySnapshotLoader('002580', '2026-10-08');
    const result = await load(new AbortController().signal);
    expect(peak).toBeLessThanOrEqual(2);
    expect(result.startTime).toBe('09:30:00');
    expect(result.endTime).toBe('15:00:01');
    expect(result.items).toHaveLength(18);
    expect(result.items[0].observedAt).toBe('2026-10-08T09:30:00+08:00');
    expect(result.items.at(-1)?.observedAt).toBe('2026-10-08T15:00:00+08:00');
    expect(result.items.some(row => row.observedAt.includes('T11:30:00'))).toBe(true);
    for (const [path] of fetcher.mock.calls) {
      const params = new URL(path, 'http://localhost').searchParams;
      const duration = Date.parse(`2026-10-08T${params.get('end_time')}+08:00`) - Date.parse(`2026-10-08T${params.get('start_time')}+08:00`);
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThanOrEqual(900000);
    }
    const calls = fetcher.mock.calls.length;
    await load(new AbortController().signal);
    expect(fetcher).toHaveBeenCalledTimes(calls);
  });

  it('fetches only elapsed windows, then appends a new window without dropping the morning data', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T09:44:58+08:00'));
    const fetcher = vi.fn().mockResolvedValueOnce(json({ data: [raw()], last_observed_at: '2026-10-08T09:44:55+08:00' }))
      .mockResolvedValueOnce(json({ data: [], last_observed_at: '2026-10-08T09:44:55+08:00' }))
      .mockResolvedValueOnce(json({ data: [raw({ observed_at: '2026-10-08T09:45:05+08:00' })], last_observed_at: '2026-10-08T09:45:05+08:00' }));
    vi.stubGlobal('fetch', fetcher);
    const load = createTradingDaySnapshotLoader('002580', '2026-10-08');
    await load(new AbortController().signal);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-10-08T09:45:05+08:00'));
    const result = await load(new AbortController().signal);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toContain('start_time=09%3A44%3A55');
    expect(fetcher.mock.calls[2][0]).toContain('start_time=09%3A45%3A00');
    expect(result.items.map(row => row.observedAt)).toEqual(['2026-10-08T09:30:05.123+08:00', '2026-10-08T09:45:05+08:00']);
  });

  it('retries a failed historical batch without silently omitting it or reloading successful batches', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T10:01:00+08:00'));
    const fetcher = vi.fn().mockImplementation(async (path: string) => {
      if (path.includes('start_time=09%3A45%3A00')) throw new Error('offline');
      return json({ data: [] });
    });
    vi.stubGlobal('fetch', fetcher);
    const load = createTradingDaySnapshotLoader('002580', '2026-10-08');
    await expect(load(new AbortController().signal)).rejects.toThrow('offline');
    fetcher.mockClear(); fetcher.mockImplementation(async () => json({ data: [] }));
    await load(new AbortController().signal);
    expect(fetcher.mock.calls.map(([path]) => new URL(path, 'http://localhost').searchParams.get('start_time')).sort())
      .toEqual(['09:45:00', '10:00:00']);
  });

  it('does not request future afternoon windows during lunch and honors cancellation', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T12:00:00+08:00'));
    const fetcher = vi.fn().mockImplementation(async () => json({ data: [] }));
    vi.stubGlobal('fetch', fetcher);
    const load = createTradingDaySnapshotLoader('002580', '2026-10-08');
    await load(new AbortController().signal);
    expect(fetcher.mock.calls.map(([path]) => new URL(path, 'http://localhost').searchParams.get('start_time')))
      .toEqual(['09:30:00', '09:45:00', '10:00:00', '10:15:00', '10:30:00', '10:45:00', '11:00:00', '11:15:00', '11:30:00']);
    const controller = new AbortController(); controller.abort();
    await expect(load(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(9);
  });
});

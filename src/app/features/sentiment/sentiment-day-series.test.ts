import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapQuoteSnapshot, type QuoteSnapshotResponse } from '../../lib/quote-snapshots';
import { createDaySeriesStore, dayQuoteSeries, SESSION_HALF, sessionAxisLabel, sessionAxisTime } from './sentiment-day-series';
import type { Envelope, EventPage, SentimentEvent } from './sentiment-contract';
import { ApiRequestError } from '../../lib/api';
import { sentimentApi } from './sentiment-api';
import example from '../../../../docs/短线情绪响应示例.json';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const day = '2026-10-15', code = '002343';
const at = (clock: string) => Date.parse(`${day}T${clock}+08:00`);
const quote = (clock: string, extra = {}) => mapQuoteSnapshot({ code, observed_at: `${day}T${clock}+08:00`, market_data_time: `${day}T${clock}+08:00`, price: 10.5, previous_close: 10, phase: 'continuous', provider: 'tencent', ...extra });
const data = (items = [quote('09:30:03'), quote('11:29:58')]): QuoteSnapshotResponse => ({ code, tradeDate: day, startTime: '09:30:00', endTime: '15:00:01', items, possiblyTruncated: false, lastObservedAt: items.at(-1)?.observedAt ?? '' });
const event = (id: string, clock = '09:30:03'): SentimentEvent => ({ event_id: id, snapshot_id: 'snapshot', code, type: 'first_seal', observed_at: `${day}T${clock}+08:00`, source_time: `${day}T${clock}+08:00`, timing_basis: 'snapshot_observation' });
const page = (items: SentimentEvent[] = [], hasMore = false) => ({ meta: { trade_date: day }, data: { items, next_cursor: items.at(-1)?.event_id ?? null, has_more: hasMore } }) as Envelope<EventPage>;

describe('full-day theme overlay', () => {
  it.each(['rapid_rise', 'rapid_fall', 'quick_rebound', 'high_dive', 'volume_surge', 'open_limit_down'] as const)('anchors %s only to matching real quotes and preserves evidence', type => {
    const behavior = { ...event(type), type, evidence: { change_ratio: .04 }, rule_version: 'price-behavior-v1', cooldown_seconds: 300 };
    const result = dayQuoteSeries(data([quote('09:30:03')]), [behavior]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ evidence: behavior.evidence, rule_version: behavior.rule_version, cooldown_seconds: 300 });
    expect(dayQuoteSeries(data([quote('09:30:05')]), [behavior]).events).toEqual([]);
  });
  it('rereads for a new publication even if the observation time is unchanged and a prior archive read is still running', async () => {
    let finish!: (value: QuoteSnapshotResponse) => void;
    const load = vi.fn().mockImplementationOnce(() => new Promise<QuoteSnapshotResponse>(resolve => { finish = resolve; })).mockResolvedValue(data());
    const events = vi.fn().mockResolvedValue(page());
    const store = createDaySeriesStore({ quotes: () => load, events });
    const stop = store.subscribe(code, day, at('15:00:00'), vi.fn(), 'all_a', 'retained-publication', 'opaque-first');
    store.advance(code, day, at('15:00:00'), 'all_a', 'final-publication', 'opaque-final');
    finish(data());
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(store.get(code, day).loading).toBe(false));
    expect(events.mock.calls.at(-1)?.[0].snapshot_id).toBe('opaque-final');
    store.advance(code, day, at('15:00:00'), 'all_a', 'final-publication', 'opaque-final');
    expect(load).toHaveBeenCalledTimes(2); stop();
  });
  it('isolates stock archives and opaque event cursors by scope and invalidates both on reset', async () => {
    const quotes = vi.fn(() => vi.fn().mockResolvedValue(data()));
    const events = vi.fn().mockImplementation(query => Promise.resolve(page([event(`${query.scope}:opaque-cursor`)])));
    const store = createDaySeriesStore({ quotes, events });
    const stopA = store.subscribe(code, day, at('11:30:00'), vi.fn(), 'all_a');
    const stopB = store.subscribe(code, day, at('11:30:00'), vi.fn(), 'hs_mainboard');
    await vi.waitFor(() => expect(events).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(store.get(code, day, 'hs_mainboard').loading).toBe(false));
    expect(quotes).toHaveBeenCalledTimes(2);
    expect(store.get(code, day, 'all_a').series.events[0].id).toBe('all_a:opaque-cursor');
    expect(store.get(code, day, 'hs_mainboard').series.events[0].id).toBe('hs_mainboard:opaque-cursor');
    store.advance(code, day, at('13:00:00'), 'hs_mainboard');
    await vi.waitFor(() => expect(events).toHaveBeenCalledTimes(3));
    expect(events.mock.calls[2][0]).toMatchObject({ scope: 'hs_mainboard', after: 'hs_mainboard:opaque-cursor' });
    stopA(); stopB(); store.clear();
    expect(store.get(code, day, 'all_a').series.points).toEqual([]);
    const stopC = store.subscribe(code, day, at('13:00:00'), vi.fn(), 'all_a');
    await vi.waitFor(() => expect(events).toHaveBeenCalledTimes(4));
    expect(events.mock.calls[3][0].after).toBeUndefined(); stopC();
  });
  it('stops invalid event-cursor retries on new quotes and resets the cursor on manual recovery', async () => {
    const events = vi.fn().mockResolvedValueOnce(page([event('old-cursor')])).mockRejectedValueOnce(new ApiRequestError(422, 'invalid cursor')).mockResolvedValue(page());
    const store = createDaySeriesStore({ quotes: () => vi.fn().mockResolvedValue(data()), events });
    const stop = store.subscribe(code, day, at('10:00:00'), vi.fn());
    await vi.waitFor(() => expect(store.get(code, day).loading).toBe(false));
    store.advance(code, day, at('11:00:00'));
    await vi.waitFor(() => expect(store.get(code, day).eventError).toContain('422'));
    store.advance(code, day, at('13:00:00'));
    await vi.waitFor(() => expect(store.get(code, day).loading).toBe(false));
    expect(events).toHaveBeenCalledTimes(2);
    store.reload(code, day);
    await vi.waitFor(() => expect(events).toHaveBeenCalledTimes(3));
    expect(events.mock.calls[2][0].after).toBeUndefined(); stop();
  });
  it('refreshes the dashboard after a future cursor and discards the obsolete event history', async () => {
    vi.spyOn(sentimentApi, 'dashboard').mockResolvedValue({ ...example.dashboard, meta: { ...example.dashboard.meta, trade_date: day, snapshot_id: 'opaque-rebuilt-snapshot' } } as never);
    const events = vi.fn().mockResolvedValueOnce(page([event('obsolete')])).mockRejectedValueOnce(new ApiRequestError(409, 'future cursor')).mockResolvedValueOnce(page([event('rebuilt')]));
    const store = createDaySeriesStore({ quotes: () => vi.fn().mockResolvedValue(data()), events });
    const stop = store.subscribe(code, day, at('10:00:00'), vi.fn());
    await vi.waitFor(() => expect(store.get(code, day).loading).toBe(false));
    store.advance(code, day, at('11:00:00'));
    await vi.waitFor(() => expect(events).toHaveBeenCalledTimes(3));
    expect(sentimentApi.dashboard).toHaveBeenCalledWith({ scope: 'all_a', trade_date: day }, expect.any(AbortSignal));
    expect(events.mock.calls[2][0]).toMatchObject({ scope: 'all_a', snapshot_id: 'opaque-rebuilt-snapshot' });
    expect(events.mock.calls[2][0].after).toBeUndefined();
    expect(store.get(code, day).series.events.map(item => item.id)).toEqual(['rebuilt']); stop();
  });
  it('retains opening observations, calculates percentage from each actual previous close and excludes unusable quotes', () => {
    const result = dayQuoteSeries(data([quote('09:30:03'), quote('11:29:58', { price: 8.1, previous_close: 7.36 }), quote('11:29:59', { quality_issue: 'stale' }), quote('11:30:00', { previous_close: null })]), []);
    const valid = result.points.filter(point => point.change_ratio !== null);
    expect(valid).toHaveLength(2);
    expect(result.points.find(point => point.time === at('11:29:59'))?.change_ratio).toBeNull();
    expect(result.points.find(point => point.time === at('11:30:00'))?.change_ratio).toBeNull();
    expect(valid[0].time).toBe(at('09:30:03'));
    expect(valid[0].change_ratio).toBeCloseTo(.05);
    expect(valid[1].change_ratio).toBeCloseTo(8.1 / 7.36 - 1);
  });
  it('anchors events to the matching source quote nearest the observation, never inferring events or event prices', () => {
    const rows = data([quote('09:30:03'), quote('09:30:08', { market_data_time: `${day}T09:30:03+08:00` })]);
    const captured = { ...event('seal'), observed_at: `${day}T09:30:08+08:00` };
    const result = dayQuoteSeries(rows, [captured, event('unmatched', '10:00:00'), { ...captured, event_id: 'other-stock', code: '000001' }]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ id: 'seal', kind: '封板', time: at('09:30:08') });
    expect(result.events[0].change_ratio).toBeCloseTo(.05);
  });
  it('compresses lunch while keeping both sessions and the full closing axis', () => {
    expect(['09:30:00', '10:30:00', '11:30:00', '13:00:00', '14:00:00', '15:00:00'].map(clock => sessionAxisTime(day, at(clock))))
      .toEqual([0, SESSION_HALF / 2, SESSION_HALF, SESSION_HALF, SESSION_HALF * 1.5, SESSION_HALF * 2]);
    expect([0, SESSION_HALF, SESSION_HALF * 1.5, SESSION_HALF * 2].map(sessionAxisLabel)).toEqual(['09:30', '11:30 / 13:00', '14:00', '15:00']);
  });
  it('shares a stock between themes, appends updates without losing the morning and walks event cursors', async () => {
    const load = vi.fn().mockResolvedValueOnce(data()).mockResolvedValueOnce(data([quote('09:30:03'), quote('13:00:03')]));
    const quotes = vi.fn(() => load);
    const events = vi.fn().mockResolvedValueOnce(page([event('first')], true)).mockResolvedValueOnce(page([event('second')])).mockResolvedValueOnce(page());
    const store = createDaySeriesStore({ quotes, events });
    const a = store.subscribe(code, day, at('11:30:00'), vi.fn()), b = store.subscribe(code, day, at('11:30:00'), vi.fn());
    await vi.waitFor(() => expect(store.get(code, day).loading).toBe(false));
    expect(quotes).toHaveBeenCalledTimes(1); expect(load).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[1][0].after).toBe('first');
    expect(store.get(code, day).series.events).toHaveLength(2);
    a(); store.advance(code, day, at('13:00:05'));
    await vi.waitFor(() => expect(store.get(code, day).series.points.at(-1)?.time).toBe(at('13:00:03')));
    expect(store.get(code, day).series.points[0].time).toBe(at('09:30:03'));
    expect(events.mock.calls[2][0].after).toBe('second'); b();
  });
  it('cancels the last subscription without publishing a late response into another day', async () => {
    const pending: { signal: AbortSignal; resolve: (data: QuoteSnapshotResponse) => void }[] = [];
    const quotes = vi.fn(() => (signal: AbortSignal) => new Promise<QuoteSnapshotResponse>(resolve => pending.push({ signal, resolve })));
    const events = vi.fn().mockResolvedValue(page());
    const store = createDaySeriesStore({ quotes, events });
    const a = store.subscribe(code, day, at('11:30:00'), vi.fn());
    const b = store.subscribe('000001', day, at('11:30:00'), vi.fn());
    const c = store.subscribe(code, '2026-10-14', at('11:30:00'), vi.fn());
    expect(pending).toHaveLength(3); a(); expect(pending[0].signal.aborted).toBe(true);
    pending[0].resolve(data());
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    expect(store.get(code, day).loaded).toBe(false);
    expect(store.get(code, '2026-10-14').loaded).toBe(false);
    b(); c(); pending[1].resolve(data()); pending[2].resolve(data());
    await vi.waitFor(() => expect(store.get(code, '2026-10-14').loading).toBe(false));
    expect(store.get(code, day).series.events).toEqual([]);
  });
  it('gives all seven stocks an opening slice before any stock receives a third slice, with four quote reads at most', async () => {
    const inFlight: { resolve: () => void }[] = [];
    let active = 0, peak = 0;
    const fetcher = vi.fn((path: string) => new Promise<Response>(resolve => {
      active++; peak = Math.max(peak, active);
      const url = new URL(path, 'http://localhost'), symbol = url.pathname.split('/').at(-2)!;
      const time = `${day}T${url.searchParams.get('start_time')}+08:00`;
      inFlight.push({ resolve: () => { active--; resolve(new Response(JSON.stringify({ data: [{ code: symbol, observed_at: time, market_data_time: time, phase: 'continuous', provider: 'tencent', price: 10.5, previous_close: 10 }], last_observed_at: time }))); } });
    }));
    vi.stubGlobal('fetch', fetcher);
    const symbols = Array.from({ length: 7 }, (_, i) => `00000${i + 1}`);
    const store = createDaySeriesStore({ events: vi.fn().mockResolvedValue(page()) });
    const stops = symbols.map(symbol => store.subscribe(symbol, day, at('10:01:00'), vi.fn()));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
    inFlight.splice(0).forEach(job => job.resolve());
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(8));
    expect(fetcher.mock.calls.slice(0, 7).map(([path]) => new URL(path, 'http://localhost').pathname.split('/').at(-2))).toEqual(symbols);
    inFlight.splice(0).forEach(job => job.resolve());
    await vi.waitFor(() => expect(symbols.every(symbol => store.get(symbol, day).series.points.length > 0)).toBe(true));
    // Let every remaining real window complete; no candle or observation is manufactured.
    for (let i = 0; i < 12 && symbols.some(symbol => !store.get(symbol, day).loaded); i++) {
      inFlight.splice(0).forEach(job => job.resolve());
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    await vi.waitFor(() => expect(symbols.every(symbol => store.get(symbol, day).loaded)).toBe(true));
    expect(peak).toBe(4);
    expect(fetcher).toHaveBeenCalledTimes(21);
    for (const symbol of symbols) expect(store.get(symbol, day).series.points.filter(point => point.change_ratio !== null).map(point => point.time)).toEqual(['09:30:00', '09:45:00', '10:00:00'].map(at));
    stops.forEach(stop => stop());
  });
  it('removes cancelled stocks from the HTTP slice queue before they start', async () => {
    const fetcher = vi.fn((_path: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(options.signal!.reason), { once: true });
    }));
    vi.stubGlobal('fetch', fetcher);
    const store = createDaySeriesStore({ events: vi.fn().mockResolvedValue(page()) });
    const stops = ['000001', '000002', '000003', '000004', '000005', '000006', '000007'].map(symbol => store.subscribe(symbol, day, at('11:30:00'), vi.fn()));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
    stops.forEach(stop => stop());
    await vi.waitFor(() => expect(store.get('000007', day).loading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(store.get('000007', day).series.points).toEqual([]);
    store.clear();
  });
  it('loads every stock even when event responses are still pending, then anchors events to the received quotes', async () => {
    const responses: { resolve: (value: Envelope<EventPage>) => void }[] = [];
    const events = vi.fn(() => new Promise<Envelope<EventPage>>(resolve => responses.push({ resolve })));
    const store = createDaySeriesStore({ quotes: symbol => vi.fn().mockResolvedValue({ ...data(), code: symbol }), events });
    const stops = [code, '000001', '000002'].map(symbol => store.subscribe(symbol, day, at('11:30:00'), vi.fn()));
    await vi.waitFor(() => expect([code, '000001', '000002'].every(symbol => store.get(symbol, day).loaded)).toBe(true));
    expect(events).toHaveBeenCalledTimes(2);
    expect(store.get(code, day).series.points.length).toBeGreaterThan(0);
    responses[0].resolve(page([event('early-seal')])); responses[1].resolve(page());
    await vi.waitFor(() => expect(events).toHaveBeenCalledTimes(3)); responses[2].resolve(page());
    await vi.waitFor(() => expect(store.get(code, day).series.events[0]?.id).toBe('early-seal'));
    stops.forEach(stop => stop());
  });
  it('keeps successfully read prices when event retrieval fails and exposes partial archives', async () => {
    const store = createDaySeriesStore({ quotes: () => vi.fn().mockResolvedValue({ ...data(), possiblyTruncated: true }), events: vi.fn().mockRejectedValue(new Error('events offline')) });
    const stop = store.subscribe(code, day, at('11:30:00'), vi.fn());
    await vi.waitFor(() => expect(store.get(code, day).loading).toBe(false));
    expect(store.get(code, day)).toMatchObject({ loaded: true, error: null, eventError: 'events offline', truncated: true });
    expect(store.get(code, day).series.points.filter(point => point.change_ratio !== null)).toHaveLength(2); stop();
  });
});

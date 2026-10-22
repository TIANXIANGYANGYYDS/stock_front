import { describe, expect, it } from 'vitest';
import example from '../../../../docs/短线情绪响应示例.json';
import type { DashboardData, Envelope, SentimentStock, StreamData, SentimentEvent } from './sentiment-contract';
import { applyStreamMessage, compareLiveStocks, emotionTitle, mergeSnapshot, pct, selectLiveStocks, stockHeight, stockStatus } from './sentiment-live-model';

const fixture = example.stock.data as SentimentStock;
const stock = (values: Partial<SentimentStock> = {}): SentimentStock => ({ ...structuredClone(fixture), code: '000001', change_ratio: .1, first_seal_at: fixture.source_time, theme_ids: ['theme-one', 'theme-two'], ...values });
const message = (stocks: SentimentStock[] = [stock()], replace = true): Envelope<StreamData> => ({ meta: { ...example.dashboard.meta, generated_at: '2026-09-03T10:00:01+08:00', data_mode: 'observed_snapshots' }, data: { dashboard: structuredClone(example.dashboard.data) as DashboardData, stocks_upsert: stocks, removed_codes: [], replace_all: replace } });
const event = (id: string, type: SentimentEvent['type'] = 'open'): SentimentEvent => ({ event_id: id, snapshot_id: example.dashboard.meta.snapshot_id, type, code: '000001', theme_ids: [], source_time: fixture.source_time, observed_at: fixture.source_time!, timing_basis: 'snapshot_observation' });

describe('live sentiment facts and snapshots', () => {
  it('uses backend board types, including 302 ChiNext, STAR and Beijing, without interpreting return as limit status', () => {
    const members = [stock({ code: '302001', board_type: 'chinext', change_ratio: .2 }), stock({ code: '688001', board_type: 'star', change_ratio: .2 }), stock({ code: '920001', market: 'BJ', board_type: 'bse', change_ratio: .3 }), stock({ code: '000009', board_type: 'chinext', change_ratio: .1, is_limit_up: false })];
    expect(selectLiveStocks(members, { query: '', board: 'chinext', height: null, status: 'limit_up' }).map(item => item.code)).toEqual(['302001']);
    expect(selectLiveStocks(members, { query: '', board: 'bse', height: null, status: 'touched' })[0].market).toBe('BJ');
    expect(selectLiveStocks(members, { query: '', board: 'star', height: null, status: 'touched' })[0].code).toBe('688001');
  });
  it('isolates scopes without comparing ID suffixes and replaces events on resync', () => {
    const original = message(); original.data.dashboard.recent_events = [event('old-event')];
    const first = mergeSnapshot(null, original)!;
    const incoming = message([stock({ code: '920001', board_type: 'bse' })]);
    incoming.meta.scope = 'hs_mainboard'; incoming.meta.snapshot_id = 'opaque:not:a:sequence';
    incoming.data.dashboard.recent_events = [];
    expect(mergeSnapshot(first, incoming, undefined, 'all_a')).toBe(first);
    const switched = mergeSnapshot(first, incoming, undefined, 'hs_mainboard')!;
    expect(Object.keys(switched.stocks)).toEqual(['920001']); expect(switched.events).toEqual([]);
    expect(applyStreamMessage(first, { type: 'heartbeat', payload: { meta: { ...first.meta, scope: 'hs_mainboard' } } }, undefined, 'all_a')).toBe(first);
    const replacement = message(); replacement.data.dashboard.recent_events = [];
    expect(applyStreamMessage(first, { type: 'resync', payload: replacement })!.events).toEqual([]);
  });
  it('preserves nulls, leading zeros and price-limit versus verified sealed status', () => {
    const state = mergeSnapshot(null, message([stock({ price: null, change_ratio: null, is_sealed: null, limit_status: 'at_limit' })]))!;
    expect(state.stocks['000001'].price).toBeNull();
    expect(state.stocks['000001'].is_sealed).toBeNull();
    expect(pct(state.stocks['000001'].change_ratio)).toBe('—');
    expect(stockStatus(state.stocks['000001'])).toContain('封单未知');
  });
  it('uses target streak after opening, independently from the backend multi-day label', () => {
    const a = stock({ intraday_streak: 3, board_run: { window_days: 11, limit_up_days: 8, label: '11天8板', is_final: false } });
    expect(stockHeight(a)).toBe(3);
    const opened = { ...a, intraday_streak: 0, is_limit_up: false, limit_status: 'opened' as const, target_streak: 3 };
    expect(stockHeight(opened)).toBe(3);
    expect(selectLiveStocks([opened], { query: '', status: 'limit_up', height: null, board: '' })).toHaveLength(0);
    expect(selectLiveStocks([opened], { query: '', status: 'touched', height: 3, board: '' })).toHaveLength(1);
    expect(opened.board_run.label).toBe('11天8板');
  });
  it('sorts height, observed sealing time, return and code, keeping missing values last', () => {
    const records = [stock({ code: '000004', intraday_streak: 3, first_seal_at: null }), stock({ code: '000003', change_ratio: null }), stock({ code: '000002', change_ratio: .11 }), stock({ code: '000001', intraday_streak: 4 })];
    expect(records.sort(compareLiveStocks).map(item => item.code)).toEqual(['000001', '000002', '000003', '000004']);
  });
  it('deduplicates stocks across themes and leaves backend market statistics untouched', () => {
    const input = message([stock(), stock()]); input.data.dashboard.market.values.limit_up = null;
    const state = mergeSnapshot(null, input)!;
    expect(Object.keys(state.stocks)).toEqual(['000001']);
    expect(state.stocks['000001'].theme_ids).toHaveLength(2);
    expect(state.dashboard.market.values.limit_up).toBeNull();
    expect(state.dashboard.unique_stock_count).toBe(example.dashboard.data.unique_stock_count);
  });
  it('applies full replacement, partial upserts and removals', () => {
    const first = mergeSnapshot(null, message([stock(), stock({ code: '000002' })]))!;
    const update = message([stock({ code: '000003' })], false); update.data.removed_codes = ['000002'];
    const second = mergeSnapshot(first, update)!;
    expect(Object.keys(second.stocks).sort()).toEqual(['000001', '000003']);
    const resync = applyStreamMessage(second, { type: 'resync', payload: message([stock({ code: '000004' })]) })!;
    expect(Object.keys(resync.stocks)).toEqual(['000004']);
    expect(first.stocks['000002']).toBeDefined();
  });
  it('accepts late events for the same snapshot ID and independently deduplicates event IDs', () => {
    const input = message(); input.data.dashboard.recent_events = [];
    const first = mergeSnapshot(null, input)!;
    input.data.events = { items: [event('a'), event('b', 'reseal')], next_cursor: 'cursor', has_more: false };
    const next = applyStreamMessage(first, { type: 'update', id: input.meta.snapshot_id, payload: input })!;
    const again = applyStreamMessage(next, { type: 'update', id: input.meta.snapshot_id, payload: input })!;
    expect(again.events.map(item => item.event_id)).toEqual(['a', 'b']);
    expect(again.series['000001'].events).toHaveLength(2);
  });
  it('keeps heartbeat age/staleness, isolates history and clears a previous day on rollover', () => {
    const first = mergeSnapshot(null, message())!;
    const heartbeat = { type: 'heartbeat' as const, payload: { meta: { ...first.meta, is_stale: true, age_seconds: 80 } } };
    expect(applyStreamMessage(first, heartbeat)!.meta.is_stale).toBe(true);
    expect(applyStreamMessage(first, heartbeat, first.meta.trade_date)).toBe(first);
    const nextDay = message([stock({ code: '000002', source_time: '2026-09-04T10:00:00+08:00' })]);
    nextDay.meta = { ...nextDay.meta, trade_date: '2026-09-04', as_of: '2026-09-04T10:00:00+08:00', generated_at: '2026-09-04T10:00:01+08:00' };
    nextDay.data.dashboard.recent_events = [];
    const next = mergeSnapshot(first, nextDay)!;
    expect(Object.keys(next.stocks)).toEqual(['000002']); expect(next.events).toEqual([]);
    expect(mergeSnapshot(next, message())).toBe(next);
    expect(mergeSnapshot(first, nextDay, first.meta.trade_date)).toBe(first);
  });
  it('records only real source-time observations, breaks gaps, and does not invent event prices or historical paths', () => {
    const first = mergeSnapshot(null, message())!;
    const input = message([stock({ source_time: '2026-09-03T10:00:30+08:00', change_ratio: .08 })]);
    input.meta = { ...input.meta, as_of: '2026-09-03T10:00:30+08:00', generated_at: '2026-09-03T10:00:31+08:00' };
    input.data.events = { items: [{ ...event('gap-event'), source_time: '2026-09-03T10:00:10+08:00' }], next_cursor: null, has_more: false };
    const next = mergeSnapshot(first, input)!;
    expect(next.series['000001'].points.map(point => point.change_ratio)).toEqual([.1, null, .08]);
    expect(next.series['000001'].events.some(item => item.id === 'gap-event')).toBe(false);
    expect(next.events.some(item => item.event_id === 'gap-event')).toBe(true);
    expect(mergeSnapshot(null, message(), first.meta.trade_date)!.series['000001'].points).toEqual([]);
    input.meta.data_mode = 'daily_final';
    expect(mergeSnapshot(null, input)!.series['000001'].points).toEqual([]);
  });
  it('keeps the established state independent from the candidate and current support', () => {
    const emotion = { ...example.dashboard.data.market.emotion, state: '主升', candidate_state: '退潮', status: 'pending_confirmation' as const, intraday_change: 'unknown' as const };
    expect(emotionTitle(emotion)).toBe('主升');
    expect(emotionTitle({ ...emotion, support: null, status: 'insufficient_data' })).toBe('主升');
    expect(emotionTitle({ ...emotion, state: null, status: 'insufficient_data' })).toBe('数据不足');
  });
});

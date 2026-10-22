// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../../../../docs/短线情绪响应示例.json';
import { ApiRequestError } from '../../lib/api';
import type { DashboardData, StreamMessage, SentimentScope } from './sentiment-contract';

const mocks = vi.hoisted(() => ({ load: vi.fn(), connect: vi.fn() }));
vi.mock('./sentiment-api', async importOriginal => ({ ...await importOriginal<typeof import('./sentiment-api')>(), loadSentimentSnapshot: mocks.load, connectSentimentStream: mocks.connect }));
import { useSentiment, useSentimentResource } from './useSentiment';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const bundle = (date = '2026-09-03') => {
  const dashboard = structuredClone(example.dashboard), response = structuredClone(example.ladder);
  dashboard.meta.trade_date = date; response.meta.trade_date = date;
  return { dashboard, response };
};
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let root: Root, host: HTMLDivElement, activeSignals: AbortSignal[], messages: ((message: StreamMessage) => void)[];
beforeEach(() => {
  vi.useFakeTimers(); activeSignals = []; messages = []; mocks.load.mockReset().mockResolvedValue(bundle());
  mocks.connect.mockReset().mockImplementation((signal: AbortSignal, _id: string, emit: (message: StreamMessage) => void) => {
    activeSignals.push(signal); messages.push(emit); return new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
  });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
function Probe({ date, scope }: { date?: string; scope?: SentimentScope }) { const state = useSentiment(date, scope); return <div>{state.snapshot?.meta.trade_date ?? 'empty'}|{state.connection}|{state.error}</div>; }
describe('sentiment request lifecycle', () => {
  it('keeps the channel alive while retained, coalesces resync requests, preserves heartbeat data and receives final facts with empty upserts', async () => {
    let state!: ReturnType<typeof useSentiment>;
    function Capture() { state = useSentiment(undefined); return <span>{state.snapshot?.meta.data_mode}</span>; }
    const retained = bundle(); retained.dashboard.meta = structuredClone(example.retained_dashboard.meta);
    retained.dashboard.data = structuredClone(example.retained_dashboard.data);
    mocks.load.mockResolvedValueOnce(retained);
    await act(async () => root.render(<Capture />));
    expect(mocks.connect).toHaveBeenCalledTimes(1); expect(host.textContent).toBe('retained_observation');
    const oldData = state.snapshot!.dashboard;
    await act(async () => messages[0]({ type: 'heartbeat', payload: { meta: { ...state.snapshot!.meta, age_seconds: 50000, is_stale: true } } }));
    expect(state.snapshot!.dashboard).toBe(oldData);
    const pending = deferred<ReturnType<typeof bundle>>(); mocks.load.mockReturnValueOnce(pending.promise);
    await act(async () => { state.resync(); state.resync(); state.resync(); });
    expect(mocks.load).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve(retained));
    const final = { ...state.snapshot!.meta, is_final: true, is_retained: false, data_mode: 'daily_final' as const,
      generated_at: '2026-09-03T18:30:00+08:00', finalization: { status: 'finalized' as const, pending_reasons: [] } };
    const dashboard = structuredClone(oldData); dashboard.market.values.limit_up = 77;
    await act(async () => messages[0]({ type: 'update', payload: { meta: final, data: { dashboard, stocks_upsert: [], removed_codes: [], replace_all: false } } }));
    expect(state.snapshot!.dashboard.market.values.limit_up).toBe(77); expect(state.snapshot!.meta.is_final).toBe(true);
    expect(mocks.connect).toHaveBeenCalledTimes(1); expect(activeSignals[0].aborted).toBe(false);
  });
  it('closes the previous scope stream and clears its resume ID and late callbacks', async () => {
    await act(async () => root.render(<Probe />));
    await act(async () => messages[0]({ type: 'heartbeat', id: 'all_a:any:opaque:id', payload: { meta: example.dashboard.meta } }));
    const mainboard = bundle('2026-09-02'); mainboard.dashboard.meta.scope = 'hs_mainboard'; mainboard.response.meta.scope = 'hs_mainboard';
    mocks.load.mockResolvedValueOnce(mainboard);
    await act(async () => root.render(<Probe scope="hs_mainboard" />));
    expect(activeSignals[0].aborted).toBe(true);
    expect(mocks.load.mock.calls.at(-1)?.[2]).toBe('hs_mainboard');
    expect(mocks.connect.mock.calls.at(-1)?.[1]).toBeUndefined();
    expect(mocks.connect.mock.calls.at(-1)?.[3]).toBe('hs_mainboard');
    await act(async () => messages[0]({ type: 'snapshot', payload: { meta: example.dashboard.meta, data: { dashboard: example.dashboard.data as DashboardData, stocks_upsert: [], removed_codes: [], replace_all: true } } }));
    expect(host.textContent).toBe('2026-09-02|connecting|');
  });
  it('ignores an old scope REST request that resolves after switching scope', async () => {
    const older = deferred<ReturnType<typeof bundle>>(); mocks.load.mockReturnValueOnce(older.promise);
    await act(async () => root.render(<Probe />));
    const next = bundle('2026-09-02'); next.dashboard.meta.scope = 'hs_mainboard'; next.response.meta.scope = 'hs_mainboard';
    mocks.load.mockResolvedValueOnce(next);
    await act(async () => root.render(<Probe scope="hs_mainboard" date="2026-09-02" />));
    expect(mocks.load.mock.calls[0][1].aborted).toBe(true);
    await act(async () => older.resolve(bundle()));
    expect(host.textContent).toBe('2026-09-02|historical|'); expect(mocks.connect).not.toHaveBeenCalled();
  });
  it('recovers exhausted latest-day REST conflicts from a coherent full SSE snapshot', async () => {
    mocks.load.mockRejectedValue(new ApiRequestError(409, 'snapshot changed'));
    await act(async () => root.render(<Probe />));
    expect(mocks.load).toHaveBeenCalledTimes(1); expect(mocks.connect).toHaveBeenCalledTimes(1);
    await act(async () => messages[0]({ type: 'snapshot', payload: { meta: { ...example.dashboard.meta, data_mode: 'observed_snapshots' }, data: { dashboard: example.dashboard.data as DashboardData, stocks_upsert: [], removed_codes: [], replace_all: true } } }));
    expect(host.textContent).toBe('2026-09-03|live|');
  });
  it('never connects SSE for history and ignores a previous date request finishing late', async () => {
    const older = deferred<ReturnType<typeof bundle>>(); mocks.load.mockReturnValueOnce(older.promise).mockResolvedValueOnce(bundle('2026-09-02'));
    await act(async () => root.render(<Probe />));
    await act(async () => root.render(<Probe date="2026-09-02" />));
    expect(host.textContent).toBe('2026-09-02|historical|');
    await act(async () => older.resolve(bundle()));
    expect(host.textContent).toBe('2026-09-02|historical|'); expect(mocks.connect).not.toHaveBeenCalled();
  });
  it('cleans the old stream when switching to history and rejects an already queued message', async () => {
    await act(async () => root.render(<Probe />));
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    mocks.load.mockResolvedValueOnce(bundle('2026-09-02'));
    await act(async () => root.render(<Probe date="2026-09-02" />));
    expect(activeSignals[0].aborted).toBe(true);
    await act(async () => messages[0]({ type: 'heartbeat', payload: { meta: { ...example.dashboard.meta, data_mode: 'observed_snapshots' } } }));
    expect(host.textContent).toBe('2026-09-02|historical|');
  });
  it('polls after disconnect and reconnects only after the polling cycle, with no duplicate timer', async () => {
    mocks.connect.mockRejectedValueOnce(new Error('network disconnected'));
    await act(async () => root.render(<Probe />));
    expect(host.textContent).toContain('polling'); expect(mocks.load).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(5000)); expect(mocks.load).toHaveBeenCalledTimes(2); expect(mocks.connect).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(10000)); expect(mocks.load).toHaveBeenCalledTimes(4); expect(mocks.connect).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount()); expect(activeSignals.at(-1)?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
    root = createRoot(host);
  });
  it.each([404, 422])('does not retry a %i response on unchanged parameters', async code => {
    mocks.load.mockRejectedValue(new ApiRequestError(code, 'unavailable'));
    await act(async () => root.render(<Probe />));
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(mocks.load).toHaveBeenCalledTimes(1); expect(host.textContent).toContain(String(code)); expect(mocks.connect).not.toHaveBeenCalled();
  });
  it('backs off a 503 without showing zero-valued market statistics', async () => {
    mocks.load.mockRejectedValueOnce(new ApiRequestError(503, 'initializing')).mockResolvedValueOnce(bundle());
    await act(async () => root.render(<Probe />)); expect(host.textContent).toContain('empty|error|');
    await act(async () => vi.advanceTimersByTimeAsync(5000)); expect(mocks.load).toHaveBeenCalledTimes(2); expect(host.textContent).toContain('2026-09-03|connecting');
  });
  it('isolates detail filter/page changes from stale asynchronous results', async () => {
    const a = deferred<string>(), b = deferred<string>();
    function Resource({ query }: { query: string }) { const result = useSentimentResource(query, () => query === 'a' ? a.promise : b.promise); return <span>{result.data ?? 'loading'}</span>; }
    await act(async () => root.render(<Resource query="a" />));
    await act(async () => root.render(<Resource query="b" />));
    await act(async () => b.resolve('new')); expect(host.textContent).toBe('new');
    await act(async () => a.resolve('old')); expect(host.textContent).toBe('new');
  });
});

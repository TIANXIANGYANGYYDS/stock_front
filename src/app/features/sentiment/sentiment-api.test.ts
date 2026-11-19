import { afterEach, describe, expect, it, vi } from 'vitest';
import example from '../../../../docs/短线情绪响应示例.json';
import { ApiRequestError } from '../../lib/api';
import { connectSentimentStream, createSseDecoder, loadSentimentSnapshot, retryable, sentimentApi, sentimentError } from './sentiment-api';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
describe('sentiment API contract and transport', () => {
  it('accepts old dashboards without boards and requests five-minute windows with opaque bindings', async () => {
    const old = structuredClone(example.dashboard); delete (old.data as { boards?: unknown }).boards;
    const fetcher = vi.fn().mockResolvedValueOnce(json(old)).mockResolvedValueOnce(json({ meta: old.meta, data: { interval: '5m', items: [] } })); vi.stubGlobal('fetch', fetcher);
    expect((await sentimentApi.dashboard()).data.boards).toEqual([]);
    await sentimentApi.timeseries({ scope: 'all_a', interval: '5m', snapshot_id: old.meta.snapshot_id, theme_id: 'theme-id' });
    const url = new URL(fetcher.mock.calls[1][0], 'http://localhost');
    expect(url.searchParams.get('interval')).toBe('5m'); expect(url.searchParams.get('snapshot_id')).toBe(old.meta.snapshot_id);
  });
  it('uses the existing proxy, dashboard date and snapshot for its associated ladder', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(example.dashboard)).mockResolvedValueOnce(json(example.ladder)); vi.stubGlobal('fetch', fetcher);
    await loadSentimentSnapshot();
    expect(String(fetcher.mock.calls[0][0])).toBe('/backend-api/api/v1/sentiment/dashboard?scope=all_a');
    const url = new URL(fetcher.mock.calls[1][0], 'http://localhost');
    expect(url.searchParams.get('trade_date')).toBe(example.dashboard.meta.trade_date);
    expect(url.searchParams.get('snapshot_id')).toBe(example.dashboard.meta.snapshot_id);
    expect(url.searchParams.get('status')).toBe('touched');
  });
  it('restarts the full snapshot pair once for 409 and never loops indefinitely', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes('/dashboard') ? json(example.dashboard) : json({ detail: 'changed' }, 409))); vi.stubGlobal('fetch', fetcher);
    await expect(loadSentimentSnapshot()).rejects.toMatchObject({ status: 409 });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it.each([404, 422, 503])('preserves %i as an error instead of an empty/zero snapshot', async status => {
    const fetcher = vi.fn().mockResolvedValue(json({ detail: 'error' }, status)); vi.stubGlobal('fetch', fetcher);
    await expect(loadSentimentSnapshot()).rejects.toMatchObject({ status });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(retryable(new ApiRequestError(status, 'error'))).toBe(status === 503);
    expect(sentimentError(new ApiRequestError(status, 'error'))).toContain(String(status));
  });
  it('passes opaque cursors and six-digit codes without reformatting', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ meta: example.dashboard.meta, data: { items: [], next_cursor: null, has_more: false } })); vi.stubGlobal('fetch', fetcher);
    await sentimentApi.events({ code: '000001', after: '2026-09-03:00000001:00000' });
    const url = new URL(fetcher.mock.calls[0][0], 'http://localhost');
    expect(url.searchParams.get('code')).toBe('000001'); expect(url.searchParams.get('after')).toBe('2026-09-03:00000001:00000');
  });
  it.each(['sh_mainboard', 'sz_mainboard', 'chinext', 'star', 'bse'] as const)('passes the %s board filter with the explicit all-A scope', async board_type => {
    const fetcher = vi.fn().mockResolvedValue(json(example.ladder)); vi.stubGlobal('fetch', fetcher);
    await sentimentApi.ladder({ board_type });
    const url = new URL(fetcher.mock.calls[0][0], 'http://localhost');
    expect(url.searchParams.get('board_type')).toBe(board_type);
    expect(url.searchParams.get('scope')).toBe('all_a');
  });
  it('retains mainboard history with no board breakdown and rejects a different scope response', async () => {
    const historical = { ...example.dashboard, meta: { ...example.dashboard.meta, scope: 'hs_mainboard', snapshot_id: 'opaque-legacy' }, data: { ...example.dashboard.data, boards: [] } };
    const fetcher = vi.fn().mockResolvedValueOnce(json(historical)).mockResolvedValueOnce(json(example.dashboard)); vi.stubGlobal('fetch', fetcher);
    expect((await sentimentApi.dashboard({ scope: 'hs_mainboard' })).data.boards).toEqual([]);
    await expect(sentimentApi.dashboard({ scope: 'hs_mainboard' })).rejects.toThrow('契约不一致');
    expect(String(fetcher.mock.calls[0][0])).toContain('scope=hs_mainboard');
  });
  it('rejects SSE messages from another scope before delivering them', async () => {
    const encoder = new TextEncoder(), emit = vi.fn();
    const body = new ReadableStream({ start(c) { c.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ meta: { ...example.dashboard.meta, scope: 'hs_mainboard' } })}\n\n`)); } });
    const fetcher = vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })); vi.stubGlobal('fetch', fetcher);
    await expect(connectSentimentStream(new AbortController().signal, undefined, emit, 'all_a')).rejects.toThrow('范围');
    expect(emit).not.toHaveBeenCalled();
    expect(String(fetcher.mock.calls[0][0])).toContain('/stream?scope=all_a');
  });
  it('仅将同版本股票首帧与已加载的总览结合', async () => {
    const controller = new AbortController();
    const bootstrap = { meta: example.dashboard.meta, data: { replace_all: true, stocks_upsert: [], removed_codes: [] } };
    const stream = (payload: typeof bootstrap) => new Response(
      `event: stocks_snapshot\ndata: ${JSON.stringify(payload)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
    const fetcher = vi.fn().mockResolvedValueOnce(json(example.dashboard))
      .mockResolvedValueOnce(stream(bootstrap))
      .mockResolvedValueOnce(stream({ ...bootstrap, meta: { ...bootstrap.meta, snapshot_id: '其他版本' } }));
    vi.stubGlobal('fetch', fetcher);
    const known = await sentimentApi.dashboard();
    const emit = vi.fn(() => controller.abort());
    await connectSentimentStream(controller.signal, undefined, emit, 'all_a', known);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'snapshot', payload: {
      meta: bootstrap.meta, data: { ...bootstrap.data, dashboard: known.data },
    } }));
    expect(new URL(fetcher.mock.calls[1][0], 'http://localhost').searchParams.get('dashboard_id')).toBe(known.meta.snapshot_id);
    await expect(connectSentimentStream(new AbortController().signal, undefined, emit, 'all_a', known)).rejects.toThrow('版本不一致');
    expect(emit).toHaveBeenCalledTimes(1);
  });
  it('parses named, multiline SSE across CRLF and chunk boundaries', () => {
    const emit = vi.fn(), feed = createSseDecoder(emit);
    feed(': keepalive\r\nid: snapshot-1\r\nevent: update\r\nda'); feed('ta: {"a":\r\ndata: 1}\r\n\r'); feed('\n');
    expect(emit).toHaveBeenCalledWith({ id: 'snapshot-1', event: 'update', data: '{"a":\n1}' });
  });
  it('uses Last-Event-ID via the shared fetch transport and accepts repeated message IDs', async () => {
    const controller = new AbortController(), encoder = new TextEncoder(), received: string[] = [];
    const payload = JSON.stringify({ meta: example.dashboard.meta });
    const body = new ReadableStream({ start(c) { c.enqueue(encoder.encode(`id: same\nevent: heartbeat\ndata: ${payload}\n\nid: same\nevent: heartbeat\ndata: ${payload}\n\n`)); } });
    const fetcher = vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })); vi.stubGlobal('fetch', fetcher);
    await connectSentimentStream(controller.signal, 'previous', event => { received.push(event.id!); if (received.length === 2) controller.abort(); });
    expect(received).toEqual(['same', 'same']);
    expect(fetcher.mock.calls[0][1].headers.get('Last-Event-ID')).toBe('previous');
    expect(fetcher.mock.calls[0][1].headers.get('Accept')).toBe('text/event-stream');
  });
});

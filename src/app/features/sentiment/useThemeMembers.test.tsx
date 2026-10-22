// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../../../../docs/短线情绪响应示例.json';
import type { SentimentMeta, SentimentStock } from './sentiment-contract';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('./sentiment-members', () => ({ loadThemeMembers: mocks.load }));
import { useThemeMembers } from './useThemeMembers';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const meta = { ...example.dashboard.meta, snapshot_id: 'first' } as SentimentMeta;
const response = (basis = meta, code = '000001') => ({ meta: basis, data: { total: 1, items: [{ ...example.stock.data, code } as SentimentStock] } });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let root: Root, host: HTMLDivElement;
beforeEach(() => { mocks.load.mockReset(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function Probe({ basis = meta, id = 'theme' }: { basis?: SentimentMeta; id?: string }) {
  const state = useThemeMembers(id, basis);
  return <article ref={state.containerRef}>{state.items?.map(row => row.code).join(',') ?? 'waiting'}|{state.error}</article>;
}
describe('theme member request lifecycle', () => {
  it('loads retained members on a fresh visit despite stale meta, then accepts same-ID finalization', async () => {
    const retained = { ...meta, ...example.retained_dashboard.meta } as SentimentMeta;
    const final = { ...retained, is_final: true, is_retained: false, data_mode: 'daily_final' as const, finalization: { status: 'finalized' as const, pending_reasons: [] } };
    mocks.load.mockResolvedValueOnce(response(retained, '000002')).mockResolvedValueOnce(response(final, '000003'));
    await act(async () => root.render(<Probe basis={retained} />));
    expect(host.textContent).toBe('000002|');
    expect(mocks.load.mock.calls[0][1].snapshot_id).toBe(retained.snapshot_id);
    expect(mocks.load.mock.calls[0][3]).toBe('top');
    await act(async () => root.render(<Probe basis={final} />));
    expect(host.textContent).toBe('000003|'); expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it('rereads the server after remount and does not resurrect browser-cached members', async () => {
    const retained = { ...meta, ...example.retained_dashboard.meta } as SentimentMeta;
    mocks.load.mockResolvedValueOnce(response(retained, '000002')).mockResolvedValueOnce(response(retained, '000003'));
    await act(async () => root.render(<Probe basis={retained} />));
    await act(async () => root.render(null));
    await act(async () => root.render(<Probe basis={retained} />));
    expect(host.textContent).toBe('000003|'); expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it('waits for card visibility instead of requesting every offscreen theme', async () => {
    let observe!: (entries: { isIntersecting: boolean }[]) => void;
    vi.stubGlobal('IntersectionObserver', class { constructor(callback: typeof observe) { observe = callback; } observe() {} disconnect() {} });
    mocks.load.mockResolvedValue(response());
    await act(async () => root.render(<Probe />)); expect(mocks.load).not.toHaveBeenCalled();
    await act(async () => observe([{ isIntersecting: true }]));
    expect(mocks.load).toHaveBeenCalledTimes(1); expect(host.textContent).toBe('000001|');
  });
  it('finishes pagination before following the newest snapshot, without overlapping loads or losing a pending update', async () => {
    const first = deferred<ReturnType<typeof response>>(); mocks.load.mockReturnValueOnce(first.promise).mockResolvedValueOnce(response({ ...meta, snapshot_id: 'third' }, '000003'));
    await act(async () => root.render(<Probe />));
    await act(async () => root.render(<Probe basis={{ ...meta, snapshot_id: 'second' }} />));
    await act(async () => root.render(<Probe basis={{ ...meta, snapshot_id: 'third' }} />));
    expect(mocks.load).toHaveBeenCalledTimes(1); expect(mocks.load.mock.calls[0][2].aborted).toBe(false);
    await act(async () => first.resolve(response()));
    expect(mocks.load).toHaveBeenCalledTimes(2); expect(mocks.load.mock.calls[1][1].snapshot_id).toBe('third');
    expect(host.textContent).toBe('000003|');
  });
  it('cancels and ignores a late member result from a different scope or date', async () => {
    const first = deferred<ReturnType<typeof response>>(); mocks.load.mockReturnValueOnce(first.promise).mockResolvedValueOnce(response({ ...meta, scope: 'hs_mainboard', trade_date: '2026-09-02' }, '000002'));
    await act(async () => root.render(<Probe />));
    await act(async () => root.render(<Probe basis={{ ...meta, scope: 'hs_mainboard', trade_date: '2026-09-02' }} />));
    expect(mocks.load.mock.calls[0][2].aborted).toBe(true);
    await act(async () => first.resolve(response())); expect(host.textContent).toBe('000002|');
  });
});

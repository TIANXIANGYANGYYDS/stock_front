// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useQuoteSnapshots, useTradingDaySnapshots } from './useQuoteSnapshots';
import { AUCTION_WINDOW, SNAPSHOT_WINDOWS, type SnapshotKind } from '../lib/quote-snapshots';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement;
let state: ReturnType<typeof useQuoteSnapshots>;
function Harness({ code = '002580', kind = 'snapshots', enabled = true }: { code?: string; kind?: SnapshotKind; enabled?: boolean }) {
  state = useQuoteSnapshots({ kind, code, enabled, tradeDate: '2026-10-08', window: kind === 'auctions' ? AUCTION_WINDOW : SNAPSHOT_WINDOWS[0] });
  return <span>{state.data?.items.map(row => `${row.code}:${row.price}`).join(',')}</span>;
}
function DayHarness({ code = '002580' }: { code?: string }) {
  state = useTradingDaySnapshots({ code, tradeDate: '2026-10-08', enabled: true });
  return <span>{state.data?.items.map(row => `${row.code}:${row.price}`).join(',')}</span>;
}
const response = (time: string, price = 19.52, code = '002580') => new Response(JSON.stringify({
  data: [{ code, price, observed_at: `2026-10-08T${time}+08:00`, market_data_time: `2026-10-08T${time}+08:00`, provider: 'tencent', phase: 'continuous' }],
  last_observed_at: `2026-10-08T${time}+08:00`,
}));
async function render(props: Parameters<typeof Harness>[0] = {}) {
  if (!root) { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); }
  await act(async () => root!.render(<Harness {...props} />));
}
afterEach(async () => {
  await act(async () => root?.unmount()); root = null;
  document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('snapshot polling', () => {
  it('keeps one day dataset across API batch boundaries and preserves existing quotes while the new batch loads', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T09:44:59+08:00'));
    let finish!: (response: Response) => void;
    const fetcher = vi.fn().mockResolvedValueOnce(response('09:44:55'))
      .mockResolvedValueOnce(response('09:44:55'))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root!.render(<DayHarness />));
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(state.initialLoading).toBe(false);
    expect(state.refreshing).toBe(true);
    expect(host.textContent).toBe('002580:19.52');
    await act(async () => finish(response('09:45:03', 19.6)));
    expect(host.textContent).toBe('002580:19.52,002580:19.6');
    expect(state.data?.startTime).toBe('09:30:00');
    expect(state.data?.endTime).toBe('15:00:01');
  });

  it('aborts the whole-day load and resets its cache on a stock change', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T09:31:00+08:00'));
    let finish!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(response('09:30:05', 10, '000001'));
    vi.stubGlobal('fetch', fetcher);
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root!.render(<DayHarness />));
    const oldSignal = fetcher.mock.calls[0][1].signal as AbortSignal;
    await act(async () => root!.render(<DayHarness code="000001" />));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => finish(response('09:30:05')));
    expect(host.textContent).toBe('000001:10');
  });

  it('polls only the new tail, merges the overlapping second and retains data after refresh failure', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T09:31:00+08:00'));
    const fetcher = vi.fn().mockResolvedValueOnce(response('09:30:05'))
      .mockResolvedValueOnce(response('09:30:10', 19.6)).mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    const params = new URL(fetcher.mock.calls[1][0], 'http://localhost').searchParams;
    expect(params.get('start_time')).toBe('09:30:05');
    expect(state.data?.startTime).toBe('09:30:00');
    expect(state.data?.items.map(row => row.price)).toEqual([19.52, 19.6]);
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(state.delayed).toBe(true);
    expect(state.data?.items).toHaveLength(2);
  });

  it('refreshes premarket auctions every two seconds, even before continuous trading opens', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T09:20:00+08:00'));
    const fetcher = vi.fn().mockImplementation(async () => response('09:19:58'));
    vi.stubGlobal('fetch', fetcher);
    await render({ kind: 'auctions' });
    await act(async () => vi.advanceTimersByTimeAsync(1999));
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toContain('/auctions?');
  });

  it('cancels an old symbol request and never merges it into the newly selected symbol', async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(response('09:30:05', 10, '000001'));
    vi.stubGlobal('fetch', fetcher);
    await render();
    const oldSignal = fetcher.mock.calls[0][1].signal as AbortSignal;
    await render({ code: '000001' });
    expect(oldSignal.aborted).toBe(true);
    await act(async () => finish(response('09:30:05')));
    expect(host.textContent).toBe('000001:10');
    expect(state.data?.code).toBe('000001');
  });

  it('does not fetch while disabled, stops polling historical windows and clears data on disable', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-09T09:31:00+08:00'));
    const fetcher = vi.fn().mockImplementation(async () => response('09:30:05'));
    vi.stubGlobal('fetch', fetcher);
    await render({ enabled: false }); expect(fetcher).not.toHaveBeenCalled();
    await render(); expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(30000)); expect(fetcher).toHaveBeenCalledTimes(1);
    await render({ enabled: false }); expect(state.data).toBeNull();
  });
});

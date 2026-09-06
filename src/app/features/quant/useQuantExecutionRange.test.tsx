// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useQuantExecutionRange } from './useQuantExecutionRange';
import type { QuantExecutionRangeQuery } from './quant-execution-range-types';
import { rangeItem, rangeJson, rangeQuery, rangeResponse } from './execution-range-test-fixtures';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
function Probe({ query }: { query: QuantExecutionRangeQuery | null }) {
  const result = useQuantExecutionRange(query);
  return <div data-loading={result.loading}>{result.data?.items.map(item => item.name).join(',')}{result.error}</div>;
}
it('explains exhausted history retries and stops polling instead of showing empty records', async () => {
  vi.useFakeTimers();
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  const fetch = vi.fn(async () => rangeJson({}, 409)); vi.stubGlobal('fetch', fetch);
  await act(async () => root.render(<Probe query={rangeQuery} />));
  await act(async () => vi.advanceTimersByTimeAsync(260));
  expect(host.textContent).toContain('成交历史持续更新，已停止自动重试');
  expect(host.firstElementChild?.getAttribute('data-loading')).toBe('false');
  await act(async () => vi.advanceTimersByTimeAsync(120_000));
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('cancels superseded requests, ignores late stock responses and revalidates when returning to a cached stock', async () => {
  vi.useFakeTimers();
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  let resolveA!: (value: Response) => void;
  const queryB = { ...rangeQuery, code: '000001' };
  const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveA = resolve; }))
    .mockImplementation(async () => rangeJson(rangeResponse([rangeItem({ code: '000001', name: '当前股票' })], 1, 200, 'history-b', queryB)));
  vi.stubGlobal('fetch', fetch);
  await act(async () => root.render(<Probe query={rangeQuery} />));
  await act(async () => vi.advanceTimersByTimeAsync(260));
  const signal = fetch.mock.calls[0][1].signal;
  await act(async () => root.render(<Probe query={queryB} />));
  expect(signal.aborted).toBe(true); expect(host.textContent).toBe('');
  await act(async () => vi.advanceTimersByTimeAsync(260));
  expect(host.textContent).toBe('当前股票');
  await act(async () => resolveA(rangeJson(rangeResponse([rangeItem({ name: '旧股票' })]))));
  expect(host.textContent).toBe('当前股票');
  await act(async () => root.render(<Probe query={null} />));
  await act(async () => root.render(<Probe query={queryB} />));
  expect(host.textContent).toBe('');
  await act(async () => vi.advanceTimersByTimeAsync(260));
  expect(fetch).toHaveBeenCalledTimes(3); expect(host.textContent).toBe('当前股票');
  await act(async () => root.unmount());
  expect(vi.getTimerCount()).toBe(0);
});

it('debounces rapidly changed ranges and direction into the final query', async () => {
  vi.useFakeTimers(); const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  const final = { ...rangeQuery, startDate: '2026-09-01', action: 'sell' as const };
  const fetch = vi.fn().mockResolvedValue(rangeJson(rangeResponse([], 1, 200, 'history-a', final))); vi.stubGlobal('fetch', fetch);
  await act(async () => root.render(<Probe query={rangeQuery} />));
  await act(async () => vi.advanceTimersByTimeAsync(100));
  await act(async () => root.render(<Probe query={{ ...rangeQuery, startDate: '2026-08-31' }} />));
  await act(async () => vi.advanceTimersByTimeAsync(100));
  await act(async () => root.render(<Probe query={final} />));
  await act(async () => vi.advanceTimersByTimeAsync(260));
  expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0][0]).toContain('start_date=2026-09-01');
  expect(fetch.mock.calls[0][0]).toContain('action=sell');
});

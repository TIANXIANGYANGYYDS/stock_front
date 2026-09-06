// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../lib/api';
import { overviewFixture } from './quant-test-fixtures';
import { useQuantSnapshot } from './useQuantSnapshot';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const api = vi.hoisted(() => ({ getQuantOverview: vi.fn() }));
vi.mock('./quant-api', async importOriginal => ({ ...await importOriginal<typeof import('./quant-api')>(), ...api }));
let root: Root;
let current: ReturnType<typeof useQuantSnapshot>;
function Probe({ id = 'strategy_1', date = '', poll = true }: { id?: string; date?: string; poll?: boolean }) {
  current = useQuantSnapshot(id, true, date, poll);
  return <span>{current.data?.snapshot_id ?? current.error ?? 'loading'}</span>;
}
async function render(id = 'strategy_1', date = '') {
  await act(async () => root.render(<Probe id={id} date={date} />));
}
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers(); api.getQuantOverview.mockReset(); document.body.innerHTML = '';
});

it('uses snapshot_id even when runtime.version is unchanged; polls once a minute and pauses when hidden', async () => {
  api.getQuantOverview.mockResolvedValueOnce(overviewFixture())
    .mockResolvedValue(overviewFixture({ snapshot_id: 'snapshot-b' }));
  await render();
  expect(current.data?.snapshot_id).toBe('snapshot-a');
  await act(async () => vi.advanceTimersByTime(60_000));
  expect(current.data?.snapshot_id).toBe('snapshot-b');
  expect(api.getQuantOverview).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  await act(async () => vi.advanceTimersByTime(180_000));
  expect(api.getQuantOverview).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(api.getQuantOverview).toHaveBeenCalledTimes(3);
});

it('aborts previous dates and strategies and ignores a loader that resolves after cancellation', async () => {
  let resolveOld!: (value: ReturnType<typeof overviewFixture>) => void;
  api.getQuantOverview.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce(overviewFixture({ trade_date: '2026-09-03', snapshot_id: 'dated' }))
    .mockResolvedValueOnce(overviewFixture({ strategy_id: 'selected-public-id', snapshot_id: 'selected' }));
  await render();
  const firstSignal = api.getQuantOverview.mock.calls[0][2].signal;
  await render('strategy_1', '2026-09-03');
  expect(firstSignal.aborted).toBe(true);
  expect(current.data?.snapshot_id).toBe('dated');
  await act(async () => resolveOld(overviewFixture()));
  expect(current.data?.snapshot_id).toBe('dated');
  await render('selected-public-id', '2026-09-03');
  expect(current.data?.snapshot_id).toBe('selected');
  await act(async () => vi.advanceTimersByTime(180_000));
  expect(api.getQuantOverview).toHaveBeenCalledTimes(3);
});

it('clears all data on 404 and 503 instead of retaining successful-looking assets', async () => {
  api.getQuantOverview.mockResolvedValueOnce(overviewFixture()).mockRejectedValueOnce(new ApiRequestError(503, 'private detail'))
    .mockRejectedValueOnce(new ApiRequestError(404, 'private detail'));
  await render();
  await act(async () => current.refresh());
  expect(current.data).toBeNull(); expect(current.error).toContain('503');
  await act(async () => current.refresh());
  expect(current.data).toBeNull(); expect(current.error).toContain('404');
  expect(current.error).not.toContain('private detail');
});

it('recovers a conflict once, stops repeated conflicts and permits a manual retry', async () => {
  api.getQuantOverview.mockResolvedValue(overviewFixture());
  await render();
  await act(async () => current.recoverSnapshot());
  expect(api.getQuantOverview).toHaveBeenCalledTimes(2);
  await act(async () => current.recoverSnapshot());
  expect(current.data).toBeNull(); expect(current.error).toContain('已暂停自动重试');
  await act(async () => vi.advanceTimersByTime(300_000));
  expect(api.getQuantOverview).toHaveBeenCalledTimes(2);
  await act(async () => current.refresh());
  expect(current.data).not.toBeNull();
  expect(api.getQuantOverview).toHaveBeenCalledTimes(3);
});

it('aborts requests and removes scheduled polling on unmount', async () => {
  api.getQuantOverview.mockReturnValue(new Promise(() => {}));
  await render();
  const signal = api.getQuantOverview.mock.calls[0][2].signal;
  await act(async () => root.unmount());
  expect(signal.aborted).toBe(true);
  await act(async () => vi.advanceTimersByTime(180_000));
  expect(api.getQuantOverview).toHaveBeenCalledTimes(1);
});

it('resumes an interrupted historical request without adding a historical polling loop', async () => {
  api.getQuantOverview.mockReturnValueOnce(new Promise(() => {})).mockResolvedValue(overviewFixture({ trade_date: '2026-09-03' }));
  await render('strategy_1', '2026-09-03');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(api.getQuantOverview.mock.calls[0][2].signal.aborted).toBe(true);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(current.data?.trade_date).toBe('2026-09-03');
  await act(async () => vi.advanceTimersByTime(180_000));
  expect(api.getQuantOverview).toHaveBeenCalledTimes(2);
});

it('keeps latest full-snapshot views on demand without polling or visibility refresh', async () => {
  api.getQuantOverview.mockResolvedValue(overviewFixture());
  await act(async () => root.render(<Probe poll={false} />));
  await act(async () => vi.advanceTimersByTime(300_000));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(api.getQuantOverview).toHaveBeenCalledTimes(1);
  await act(async () => current.refresh());
  expect(api.getQuantOverview).toHaveBeenCalledTimes(2);
});


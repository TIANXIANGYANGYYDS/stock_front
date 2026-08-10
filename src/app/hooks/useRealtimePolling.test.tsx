// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useRealtimePolling,
  type RealtimePollingOptions,
  type RealtimePollingState,
} from './useRealtimePolling';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface QuotePayload {
  marketStatus: string;
  version: number;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

let root: Root | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function HookHarness({
  options,
  onState,
}: {
  options: RealtimePollingOptions<QuotePayload>;
  onState: (state: RealtimePollingState<QuotePayload>) => void;
}) {
  const state = useRealtimePolling(options);
  useEffect(() => onState(state), [onState, state]);
  return null;
}

async function renderHookHarness(
  options: RealtimePollingOptions<QuotePayload>,
  onState: (state: RealtimePollingState<QuotePayload>) => void,
): Promise<void> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(<HookHarness options={options} onState={onState} />));
  await flushPromises();
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useRealtimePolling', () => {
  it('requests immediately and schedules the next open-market request after completion', async () => {
    vi.useFakeTimers();
    const request = vi.fn()
      .mockResolvedValueOnce({ marketStatus: 'open', version: 1 })
      .mockResolvedValueOnce({ marketStatus: 'open', version: 2 });
    let latest: RealtimePollingState<QuotePayload> | null = null;

    await renderHookHarness({
      queryKey: 'indices',
      request,
      getMarketStatus: (data) => data.marketStatus,
      intervalMs: 5000,
    }, (state) => {
      latest = state;
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(latest?.data).toEqual({ marketStatus: 'open', version: 1 });

    await act(async () => vi.advanceTimersByTime(4999));
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTime(1));
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(2);
    expect(latest?.data).toEqual({ marketStatus: 'open', version: 2 });
  });

  it('stops timed polling after a closed-market response', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValue({ marketStatus: 'closed', version: 1 });

    await renderHookHarness({
      queryKey: 'indices',
      request,
      getMarketStatus: (data) => data.marketStatus,
      intervalMs: 5000,
    }, () => undefined);

    await act(async () => vi.advanceTimersByTime(20_000));
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('pauses while hidden and refreshes immediately when visibility returns', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('visible');
    const request = vi.fn()
      .mockResolvedValueOnce({ marketStatus: 'open', version: 1 })
      .mockResolvedValueOnce({ marketStatus: 'open', version: 2 });

    await renderHookHarness({
      queryKey: 'indices',
      request,
      getMarketStatus: (data) => data.marketStatus,
      intervalMs: 5000,
    }, () => undefined);

    visibility.mockReturnValue('hidden');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => vi.advanceTimersByTime(10_000));
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);

    visibility.mockReturnValue('visible');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('refreshes a closed market once when the window regains focus', async () => {
    vi.useFakeTimers();
    const request = vi.fn()
      .mockResolvedValueOnce({ marketStatus: 'closed', version: 1 })
      .mockResolvedValueOnce({ marketStatus: 'closed', version: 2 });

    await renderHookHarness({
      queryKey: 'indices',
      request,
      getMarketStatus: (data) => data.marketStatus,
      intervalMs: 5000,
    }, () => undefined);

    await act(async () => window.dispatchEvent(new Event('focus')));
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('coalesces focus and manual refreshes while one request is in flight', async () => {
    vi.useFakeTimers();
    const first = deferred<QuotePayload>();
    const request = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ marketStatus: 'closed', version: 2 });
    let latest: RealtimePollingState<QuotePayload> | null = null;

    await renderHookHarness({
      queryKey: 'indices',
      request,
      getMarketStatus: (data) => data.marketStatus,
      intervalMs: 5000,
    }, (state) => {
      latest = state;
    });

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      latest?.refresh();
    });
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve({ marketStatus: 'open', version: 1 }));
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(2);
    expect(latest?.data).toEqual({ marketStatus: 'closed', version: 2 });
  });

  it('retains successful data and reports a lightweight delayed state after refresh failure', async () => {
    vi.useFakeTimers();
    const request = vi.fn()
      .mockResolvedValueOnce({ marketStatus: 'open', version: 1 })
      .mockRejectedValueOnce(new Error('接口请求失败: 503'));
    let latest: RealtimePollingState<QuotePayload> | null = null;

    await renderHookHarness({
      queryKey: 'indices',
      request,
      getMarketStatus: (data) => data.marketStatus,
      intervalMs: 5000,
    }, (state) => {
      latest = state;
    });
    await act(async () => vi.advanceTimersByTime(5000));
    await flushPromises();

    expect(latest?.data).toEqual({ marketStatus: 'open', version: 1 });
    expect(latest?.delayed).toBe(true);
    expect(latest?.error).toBe('数据可能延迟');
  });

  it('reports unavailable on first network failure and retries after five seconds', async () => {
    vi.useFakeTimers();
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ marketStatus: 'closed', version: 2 });
    let latest: RealtimePollingState<QuotePayload> | null = null;

    await renderHookHarness({
      queryKey: 'indices',
      request,
      getMarketStatus: (data) => data.marketStatus,
      intervalMs: 5000,
    }, (state) => {
      latest = state;
    });

    expect(latest?.data).toBeNull();
    expect(latest?.delayed).toBe(true);
    expect(latest?.error).toBe('行情暂不可用');
    await act(async () => vi.advanceTimersByTime(5000));
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(2);
    expect(latest?.data).toEqual({ marketStatus: 'closed', version: 2 });
  });

  it('aborts hidden and unmounted requests without surfacing a quote error', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('visible');
    let capturedSignal: AbortSignal | null = null;
    const request = vi.fn((signal: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<QuotePayload>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(
          new DOMException('The operation was aborted', 'AbortError'),
        ));
      });
    });
    let latest: RealtimePollingState<QuotePayload> | null = null;

    await renderHookHarness({
      queryKey: 'indices',
      request,
      getMarketStatus: (data) => data.marketStatus,
      intervalMs: 5000,
    }, (state) => {
      latest = state;
    });

    visibility.mockReturnValue('hidden');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await flushPromises();
    expect(capturedSignal?.aborted).toBe(true);
    expect(latest?.delayed).toBe(false);
    expect(latest?.error).toBeNull();

    visibility.mockReturnValue('visible');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await flushPromises();
    const visibleSignal = capturedSignal;
    await act(async () => root?.unmount());
    root = null;
    expect(visibleSignal?.aborted).toBe(true);
  });

  it('aborts the previous query and prevents it from replacing new-query data', async () => {
    vi.useFakeTimers();
    const first = deferred<QuotePayload>();
    let firstSignal: AbortSignal | null = null;
    const request = vi.fn()
      .mockImplementationOnce((signal: AbortSignal) => {
        firstSignal = signal;
        signal.addEventListener('abort', () => first.reject(
          new DOMException('The operation was aborted', 'AbortError'),
        ));
        return first.promise;
      })
      .mockResolvedValueOnce({ marketStatus: 'closed', version: 2 });
    let latest: RealtimePollingState<QuotePayload> | null = null;
    const onState = (state: RealtimePollingState<QuotePayload>) => {
      latest = state;
    };
    const firstOptions: RealtimePollingOptions<QuotePayload> = {
      queryKey: 'stock:600519',
      request,
      getMarketStatus: (data) => data.marketStatus,
      intervalMs: 5000,
    };

    await renderHookHarness(firstOptions, onState);
    await act(async () => root?.render(
      <HookHarness
        options={{ ...firstOptions, queryKey: 'stock:000001' }}
        onState={onState}
      />,
    ));
    await flushPromises();

    expect(firstSignal?.aborted).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(latest?.data).toEqual({ marketStatus: 'closed', version: 2 });
  });
});

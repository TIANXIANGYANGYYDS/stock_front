import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequestCache } from './request-cache';

afterEach(() => vi.useRealTimers());

describe('request cache', () => {
  it('shares requests, expires results and bounds stored entries', async () => {
    vi.useFakeTimers();
    const cache = createRequestCache<number>(60_000, 2);
    const loader = vi.fn(async () => 1);
    expect(await Promise.all([cache.get('A', loader), cache.get('A', loader)])).toEqual([1, 1]);
    await cache.get('A', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    await cache.get('B', loader);
    cache.peek('A');
    await cache.get('C', loader);
    expect(cache.peek('B')).toBeUndefined();
    expect(cache.peek('A')).toBe(1);
    vi.advanceTimersByTime(60_000);
    expect(cache.peek('A')).toBeUndefined();
    await cache.get('A', loader);
    expect(loader).toHaveBeenCalledTimes(4);
  });

  it('cancels one reader without disrupting another reader', async () => {
    const cache = createRequestCache<number>(1000, 2);
    let resolve!: (value: number) => void;
    let sharedSignal!: AbortSignal;
    const loader = vi.fn((signal: AbortSignal) => {
      sharedSignal = signal;
      return new Promise<number>(done => { resolve = done; });
    });
    const controller = new AbortController();
    const first = cache.get('A', loader, controller.signal);
    const second = cache.get('A', loader);
    const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await cancelled;
    expect(sharedSignal.aborted).toBe(false);
    resolve(42);
    expect(await second).toBe(42);
    expect(cache.peek('A')).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('aborts abandoned requests and does not cache their late responses or errors', async () => {
    const cache = createRequestCache<number>(1000, 2);
    let resolve!: (value: number) => void;
    let sharedSignal!: AbortSignal;
    const controller = new AbortController();
    const request = cache.get('A', signal => {
      sharedSignal = signal;
      return new Promise<number>(done => { resolve = done; });
    }, controller.signal);
    const cancelled = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await cancelled;
    expect(sharedSignal.aborted).toBe(true);
    resolve(1);
    expect(await cache.get('A', async () => 2)).toBe(2);
    expect(cache.peek('A')).toBe(2);
    await expect(cache.get('B', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(await cache.get('B', async () => 3)).toBe(3);
  });

  it('rejects an already aborted reader even when a value is cached', async () => {
    const cache = createRequestCache<number>(1000, 2);
    await cache.get('A', async () => 1);
    const controller = new AbortController();
    controller.abort();
    await expect(cache.get('A', async () => 2, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

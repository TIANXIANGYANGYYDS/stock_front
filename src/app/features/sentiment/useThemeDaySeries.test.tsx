// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SentimentScope } from './sentiment-contract';
const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), advance: vi.fn(), get: vi.fn(), reload: vi.fn() }));
vi.mock('./sentiment-day-series', () => ({ sentimentDaySeries: mocks }));
import { useThemeDaySeries } from './useThemeDaySeries';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers(); Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.subscribe.mockImplementation(() => vi.fn());
  mocks.get.mockImplementation((code: string) => ({ series: { code, points: [], events: [], limit_ratio: null }, loaded: false, loading: true, error: null, eventError: null, truncated: false }));
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function Probe({ codes, day = '2026-10-14', scope = 'all_a' }: { codes: string[]; day?: string; scope?: SentimentScope }) {
  const state = useThemeDaySeries(codes, day, `${day}T15:00:00+08:00`, scope);
  return <div ref={state.containerRef}>{state.states.length}</div>;
}

describe('overlay subscriptions', () => {
  it('keeps retained stock reads alive when a ranking replaces or reorders members', async () => {
    await act(async () => root.render(<Probe codes={['000001', '000002']} />));
    const [firstStop, retainedStop] = mocks.subscribe.mock.results.map(result => result.value);
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
    await act(async () => root.render(<Probe codes={['000002', '000003']} />));
    expect(firstStop).toHaveBeenCalledTimes(1); expect(retainedStop).not.toHaveBeenCalled();
    expect(mocks.subscribe.mock.calls.map(call => call[0])).toEqual(['000001', '000002', '000003']);
    await act(async () => root.render(<Probe codes={['000003', '000002']} />));
    expect(mocks.subscribe).toHaveBeenCalledTimes(3); expect(retainedStop).not.toHaveBeenCalled();
  });
  it('releases old scope/date subscriptions and cancels a queued view update on unmount', async () => {
    await act(async () => root.render(<Probe codes={['000001']} />));
    const oldStop = mocks.subscribe.mock.results[0].value;
    await act(async () => root.render(<Probe codes={['000001']} scope="hs_mainboard" day="2026-10-13" />));
    expect(oldStop).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe.mock.calls[1][1]).toBe('2026-10-13'); expect(mocks.subscribe.mock.calls[1][4]).toBe('hs_mainboard');
    await act(async () => { mocks.subscribe.mock.calls[1][3](); });
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => root.render(null));
    expect(mocks.subscribe.mock.results[1].value).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it('restores subscriptions after React strict effect cleanup without leaking listeners', async () => {
    await act(async () => root.render(<StrictMode><Probe codes={['000001']} /></StrictMode>));
    const liveStops = () => mocks.subscribe.mock.results.map(result => result.value).filter(stop => !stop.mock.calls.length);
    expect(liveStops()).toHaveLength(1);
    await act(async () => root.render(null));
    expect(liveStops()).toHaveLength(0);
  });
});

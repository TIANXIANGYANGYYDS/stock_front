// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { QuantWorkspace } from './QuantWorkspace';
import { jsonResponse, overviewFixture, pageFixture, performanceFixture, rebasedSnapshotFixture, REBASED_TEST_DATES } from './quant-test-fixtures';
import type { QuantOverviewData } from './quant-types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
async function setup(resource = 'signals') {
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  await act(async () => root!.render(<MemoryRouter initialEntries={['/quant/' + resource]}><QuantWorkspace /></MemoryRouter>));
  return host;
}
const button = (host: HTMLElement, label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label)!;
async function selectDate(host: HTMLElement, date: string) {
  const select = host.querySelector<HTMLSelectElement>('[aria-label="量化交易日期"]')!;
  await act(async () => { select.value = date; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => select.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
function respondList(url: URL, snapshot: QuantOverviewData, size = 1) {
  const rows = Array.from({ length: size }, (_, i) => ({ code: String(i + 1).padStart(6, '0'), name: `记录-${snapshot.snapshot_id}`, status: 'unknown' }));
  return jsonResponse({ ...pageFixture(rows, Number(url.searchParams.get('page')), Number(url.searchParams.get('page_size')), snapshot), ...(url.pathname.endsWith('/accounts') ? { available: true } : {}) });
}

it.each(['accounts', 'observations', 'signals', 'executions', 'holdings', 'closed-trades', 'preselections', 'sell-candidates', 'exit-decisions'])('%s can query every required historical date with a matching overview and reset page', async resource => {
  const requests: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string, options: RequestInit) => {
    const url = new URL(input, 'http://test'); requests.push(url); expect(options.cache).toBe('no-store');
    if (url.pathname.endsWith('/strategies')) return jsonResponse({ items: [overviewFixture().strategy], total: 1 });
    const date = url.searchParams.get('trade_date') ?? REBASED_TEST_DATES.at(-1)!;
    const snapshot = rebasedSnapshotFixture(date);
    if (url.pathname.endsWith('/overview')) return jsonResponse({ data: snapshot });
    if (url.pathname.endsWith('/performance')) return jsonResponse(performanceFixture(REBASED_TEST_DATES.map(date => rebasedSnapshotFixture(date))));
    expect(url.searchParams.get('snapshot_id')).toBe(snapshot.snapshot_id);
    return respondList(url, snapshot, 51);
  }));
  const host = await setup(resource);
  expect([...host.querySelectorAll<HTMLOptionElement>('[aria-label="量化交易日期"] option')].map(option => option.value)).toEqual(['', ...REBASED_TEST_DATES]);
  for (const date of ['2026-08-20', '2026-08-31', '2026-09-03', '2026-09-04']) {
    await act(async () => button(host, '下一页').click());
    await selectDate(host, date);
    expect(host.querySelector('.quant-pager strong')?.textContent).toBe('1 / 2');
    expect(host.querySelector('.quant-snapshot-context')?.textContent).toContain(`数据截至日期 ${date}`);
    expect(host.querySelector('tbody')?.textContent).toContain(`记录-rebased:${date}`);
    expect(requests.at(-1)?.searchParams.get('trade_date')).toBe(date);
  }
  expect(requests.filter(url => url.pathname.endsWith('/performance'))).toHaveLength(1);
});

it('replaces old history and selected-day data after rebasing with unchanged schema and runtime versions', async () => {
  let rebased = false;
  const getSnapshot = (date: string) => rebased ? rebasedSnapshotFixture(date) : overviewFixture({ trade_date: date, snapshot_id: `old:${date}` });
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input, 'http://test');
    if (url.pathname.endsWith('/strategies')) return jsonResponse({ items: [overviewFixture().strategy], total: 1 });
    const snapshot = getSnapshot(url.searchParams.get('trade_date') ?? '2026-09-04');
    if (url.pathname.endsWith('/overview')) return jsonResponse({ data: snapshot });
    if (url.pathname.endsWith('/performance')) return jsonResponse(performanceFixture((rebased ? REBASED_TEST_DATES : ['2026-09-03', '2026-09-04']).map(getSnapshot)));
    return respondList(url, snapshot);
  }));
  const host = await setup(); await selectDate(host, '2026-09-03');
  expect(host.querySelector('tbody')?.textContent).toContain('old:2026-09-03');
  rebased = true; await act(async () => button(host, '刷新数据').click());
  expect(host.querySelector('tbody')?.textContent).toContain('rebased:2026-09-03');
  expect(host.textContent).not.toContain('old:');
  expect(host.querySelectorAll('[aria-label="量化交易日期"] option')).toHaveLength(13);
  expect(host.textContent).toContain('账户统计区间 2026-08-20 至 2026-09-03');
});

it('aborts a superseded historical overview and ignores its late response', async () => {
  let resolveOld!: (value: Response) => void;
  let oldSignal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn(async (input: string, options: RequestInit) => {
    const url = new URL(input, 'http://test');
    if (url.pathname.endsWith('/strategies')) return jsonResponse({ items: [overviewFixture().strategy], total: 1 });
    if (url.pathname.endsWith('/performance')) return jsonResponse(performanceFixture(REBASED_TEST_DATES.map(date => rebasedSnapshotFixture(date))));
    const date = url.searchParams.get('trade_date') ?? '2026-09-04';
    if (url.pathname.endsWith('/overview') && date === '2026-08-20') { oldSignal = options.signal!; return new Promise<Response>(resolve => { resolveOld = resolve; }); }
    const snapshot = rebasedSnapshotFixture(date);
    if (url.pathname.endsWith('/overview')) return jsonResponse({ data: snapshot });
    return respondList(url, snapshot);
  }));
  const host = await setup(); await selectDate(host, '2026-08-20'); await selectDate(host, '2026-08-31');
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => resolveOld(jsonResponse({ data: rebasedSnapshotFixture('2026-08-20') })));
  expect(host.querySelector('tbody')?.textContent).toContain('rebased:2026-08-31');
  expect(host.querySelector('.quant-snapshot-context')?.textContent).not.toContain('数据截至日期 2026-08-20');
});

it('extends available dates automatically while a historical day remains selected', async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  let nextDay = false;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input, 'http://test');
    if (url.pathname.endsWith('/strategies')) return jsonResponse({ items: [overviewFixture().strategy], total: 1 });
    const date = url.searchParams.get('trade_date') ?? (nextDay ? '2026-09-07' : '2026-09-04');
    const snapshot = rebasedSnapshotFixture(date);
    if (url.pathname.endsWith('/overview')) return jsonResponse({ data: snapshot });
    if (url.pathname.endsWith('/performance')) return jsonResponse(performanceFixture([...REBASED_TEST_DATES, ...(nextDay ? ['2026-09-07'] : [])].map(date => rebasedSnapshotFixture(date))));
    return respondList(url, snapshot);
  }));
  const host = await setup(); await selectDate(host, '2026-08-20'); nextDay = true;
  await act(async () => vi.advanceTimersByTime(60_000));
  expect(host.querySelector('[aria-label="量化交易日期"] option[value="2026-09-07"]')).not.toBeNull();
  expect(host.querySelector('.quant-snapshot-context')?.textContent).toContain('数据截至日期 2026-08-20');
  expect(host.querySelector('tbody')?.textContent).toContain('rebased:2026-08-20');
});

it('shows a history request failure without stale dates, asset figures or a fabricated empty list', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.endsWith('/strategies')) return jsonResponse({ items: [overviewFixture().strategy], total: 1 });
    if (input.includes('/overview')) return jsonResponse({ data: rebasedSnapshotFixture() });
    return jsonResponse({}, 503);
  }));
  const host = await setup();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('503');
  expect(host.querySelector('table')).toBeNull(); expect(host.querySelector('.quant-snapshot-context')).toBeNull();
  expect(host.querySelector<HTMLSelectElement>('[aria-label="量化交易日期"]')?.disabled).toBe(true);
});

it('rejects a historical snapshot that disagrees with the history and bounds its recovery', async () => {
  let latestCalls = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input, 'http://test');
    if (url.pathname.endsWith('/strategies')) return jsonResponse({ items: [overviewFixture().strategy], total: 1 });
    if (url.pathname.endsWith('/performance')) return jsonResponse(performanceFixture(REBASED_TEST_DATES.map(date => rebasedSnapshotFixture(date))));
    if (url.pathname.endsWith('/overview')) {
      const date = url.searchParams.get('trade_date');
      if (!date) ++latestCalls;
      return jsonResponse({ data: date ? { ...rebasedSnapshotFixture(date), snapshot_id: 'stale-day' } : rebasedSnapshotFixture() });
    }
    return respondList(url, rebasedSnapshotFixture());
  }));
  const host = await setup(); await selectDate(host, '2026-08-20');
  expect(latestCalls).toBe(2); expect(host.querySelector('table')).toBeNull();
  expect(host.textContent).toContain('已暂停自动重试');
});

it('cancels an old history download during refresh and never replaces the rebased dates with its late response', async () => {
  let latestCalls = 0;
  let resolveOld!: (value: Response) => void;
  let oldSignal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn(async (input: string, options: RequestInit) => {
    const url = new URL(input, 'http://test');
    if (url.pathname.endsWith('/strategies')) return jsonResponse({ items: [overviewFixture().strategy], total: 1 });
    if (url.pathname.endsWith('/overview')) return jsonResponse({ data: ++latestCalls === 1 ? overviewFixture() : rebasedSnapshotFixture() });
    if (url.pathname.endsWith('/performance')) {
      if (latestCalls === 1) { oldSignal = options.signal!; return new Promise<Response>(resolve => { resolveOld = resolve; }); }
      return jsonResponse(performanceFixture(REBASED_TEST_DATES.map(date => rebasedSnapshotFixture(date))));
    }
    return respondList(url, rebasedSnapshotFixture());
  }));
  const host = await setup();
  expect(host.querySelector<HTMLSelectElement>('[aria-label="量化交易日期"]')?.disabled).toBe(true);
  await act(async () => button(host, '刷新数据').click());
  expect(oldSignal?.aborted).toBe(true);
  expect(host.querySelectorAll('[aria-label="量化交易日期"] option')).toHaveLength(13);
  await act(async () => resolveOld(jsonResponse(performanceFixture())));
  expect(host.querySelectorAll('[aria-label="量化交易日期"] option')).toHaveLength(13);
  expect(host.querySelector('tbody')?.textContent).toContain('rebased:2026-09-04');
});

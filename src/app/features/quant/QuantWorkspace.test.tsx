// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { QuantWorkspace } from './QuantWorkspace';
import { overviewFixture, pageFixture, jsonResponse, dailyFixture, performanceFixture } from './quant-test-fixtures';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
const catalog = { items: [overviewFixture().strategy], total: 1 };
async function setup(path = '/quant/signals') {
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><QuantWorkspace /></MemoryRouter>));
  return host;
}

it.each(['/quant/runtime', '/quant/runtime/'])('replaces retired parameter route %s and removes its navigation entry', async path => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.endsWith('/strategies')) return jsonResponse(catalog);
    if (input.includes('/overview')) return jsonResponse({ data: overviewFixture() });
    if (input.includes('/performance')) return jsonResponse(performanceFixture());
    return jsonResponse(pageFixture([]));
  }));
  function RouteProbe() { const location = useLocation(); const navigate = useNavigate(); return <><output data-route>{location.pathname}</output><button data-back onClick={() => navigate(-1)}>后退</button></>; }
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={['/quant/signals', path]}><RouteProbe /><QuantWorkspace /></MemoryRouter>));
  expect(host.querySelector('[data-route]')?.textContent).toBe('/quant');
  expect(host.querySelector('.quant-subnav')?.textContent).not.toContain('参数与运行');
  expect(host.textContent).not.toContain('参数与成交约定');
  expect(host.textContent).toContain('账户总览');
  await act(async () => host.querySelector<HTMLButtonElement>('[data-back]')!.click());
  expect(host.querySelector('[data-route]')?.textContent).toBe('/quant/signals');
});

it('waits for overview before lists and recovers a changed snapshot as a complete unit', async () => {
  let overviewCalls = 0;
  const requested: string[] = [];
  const fetch = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://test'); requested.push(input);
    if (url.pathname.endsWith('/strategies')) return jsonResponse(catalog);
    if (url.pathname.endsWith('/overview')) return jsonResponse({ data: overviewFixture({ snapshot_id: ++overviewCalls === 1 ? 'snapshot-a' : 'snapshot-b' }) });
    if (url.pathname.endsWith('/performance')) return jsonResponse(performanceFixture([overviewFixture({ snapshot_id: overviewCalls === 1 ? 'snapshot-a' : 'snapshot-b' })]));
    if (url.searchParams.get('snapshot_id') === 'snapshot-a') return jsonResponse({}, 409);
    expect(url.searchParams.get('snapshot_id')).toBe('snapshot-b');
    expect(url.searchParams.get('trade_date')).toBe('2026-09-04');
    expect(url.searchParams.get('page')).toBe('1');
    return jsonResponse(pageFixture([{ code: '000001', name: '新快照记录' }], 1, 50, overviewFixture({ snapshot_id: 'snapshot-b' })));
  });
  vi.stubGlobal('fetch', fetch);
  const host = await setup();
  expect(requested.map(path => path.split('?')[0].split('/').at(-1))).toEqual(['strategies', 'overview', 'performance', 'signals', 'overview', 'performance', 'signals']);
  expect(host.textContent).toContain('新快照记录'); expect(host.textContent).toContain('策略1');
  expect(host.textContent).toContain('真实历史行情补录'); expect(host.textContent).toContain('非成交时间');
  expect(host.querySelectorAll('[aria-label="选择量化策略"] option')).toHaveLength(1);
});

it('stops a repeated 409 and clears the account and old table', async () => {
  let calls = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.endsWith('/strategies')) return jsonResponse(catalog);
    if (input.includes('/overview')) { ++calls; return jsonResponse({ data: overviewFixture() }); }
    if (input.includes('/performance')) return jsonResponse(performanceFixture());
    return jsonResponse({}, 409);
  }));
  const host = await setup();
  expect(calls).toBe(2);
  expect(host.textContent).toContain('已暂停自动重试');
  expect(host.querySelector('table')).toBeNull(); expect(host.querySelector('.quant-snapshot-context')).toBeNull();
});

it('resets pagination when switching dates and uses the date returned by overview', async () => {
  const queries: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input, 'http://test'); queries.push(url);
    if (url.pathname.endsWith('/strategies')) return jsonResponse(catalog);
    const date = url.searchParams.get('trade_date') || '2026-09-04';
    const snapshot = overviewFixture({ trade_date: date, snapshot_id: date });
    if (url.pathname.endsWith('/overview')) return jsonResponse({ data: snapshot });
    if (url.pathname.endsWith('/performance')) return jsonResponse(performanceFixture(['2026-09-03', '2026-09-04'].map(trade_date => overviewFixture({ trade_date, snapshot_id: trade_date }))));
    expect(url.searchParams.get('snapshot_id')).toBe(date);
    return jsonResponse(pageFixture(Array.from({ length: 51 }, (_, index) => ({ code: String(index).padStart(6, '0') })), Number(url.searchParams.get('page')), 50, snapshot));
  }));
  const host = await setup();
  const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)!;
  await act(async () => button('下一页').click());
  expect(host.querySelector('.quant-pager strong')?.textContent).toBe('2 / 2');
  const dateInput = host.querySelector<HTMLSelectElement>('[aria-label="量化交易日期"]')!;
  await act(async () => {
    dateInput.value = '2026-09-03';
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => dateInput.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(host.querySelector('.quant-pager strong')?.textContent).toBe('1 / 2');
  expect(queries.at(-1)?.searchParams.get('trade_date')).toBe('2026-09-03');
  expect(host.querySelector('.quant-snapshot-context')?.textContent).toContain('2026-09-03');
});

it('does not fabricate a strategy when the directory is empty', async () => {
  const fetch = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0 })); vi.stubGlobal('fetch', fetch);
  const host = await setup();
  expect(fetch).toHaveBeenCalledTimes(1); expect(host.textContent).toContain('暂无公开策略');
  expect(host.querySelector('table')).toBeNull();
});

it.each([404, 503])('does not request lists when overview fails with %s', async status => {
  const fetch = vi.fn().mockResolvedValueOnce(jsonResponse(catalog)).mockResolvedValueOnce(jsonResponse({}, status));
  vi.stubGlobal('fetch', fetch); const host = await setup();
  expect(fetch).toHaveBeenCalledTimes(2); expect(host.querySelector('[role="alert"]')?.textContent).toContain(String(status));
  expect(host.querySelector('table')).toBeNull();
});

it('waits for the on-demand overview before loading a latest full snapshot once', async () => {
  const requested: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const path = new URL(input, 'http://test').pathname;
    requested.push(path);
    if (path.endsWith('/strategies')) return jsonResponse(catalog);
    if (path.endsWith('/overview')) return jsonResponse({ data: overviewFixture() });
    if (path.endsWith('/performance')) return jsonResponse(performanceFixture());
    if (path.includes('/daily-results/')) return jsonResponse({ data: dailyFixture() });
    return jsonResponse(pageFixture([]));
  }));
  function OpenLatestDaily() { const navigate = useNavigate(); return <button onClick={() => navigate('/quant/daily/latest')}>打开最新完整记录</button>; }
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={['/quant/signals']}><OpenLatestDaily /><QuantWorkspace /></MemoryRouter>));
  await act(async () => host.querySelector('button')!.click());
  expect(requested.map(path => path.split('/').at(-1))).toEqual(['strategies', 'overview', 'performance', 'signals', 'overview', 'performance', '2026-09-04']);
  expect(host.textContent).toContain('2026-09-04 · 当日完整记录');
});

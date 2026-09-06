// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { QuantRecordsPage } from './QuantRecordsPage';
import { WorkspaceStateProvider } from '../../hooks/useWorkspaceState';
import { jsonResponse, overviewFixture, pageFixture } from './quant-test-fixtures';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
const resources = ['signals', 'observations', 'executions', 'holdings', 'closed-trades', 'accounts', 'preselections', 'sell-candidates', 'exit-decisions'] as const;
function setup() { const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); return host; }
const button = (host: HTMLElement, label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label)!;
async function inputCode(host: HTMLElement, code: string) {
  const input = host.querySelector<HTMLInputElement>('[aria-label="股票代码"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
it.each(resources)('%s applies drafts explicitly, resets pagination and preserves six-digit code filters', async resource => {
  const fetch = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://test');
    const rows = url.searchParams.has('code') ? [] : Array.from({ length: 51 }, (_, i) => ({ code: String(i).padStart(6, '0') }));
    return jsonResponse({ ...pageFixture(rows, Number(url.searchParams.get('page')), Number(url.searchParams.get('page_size'))), ...(resource === 'accounts' ? { available: true } : {}) });
  });
  vi.stubGlobal('fetch', fetch);
  const host = setup();
  await act(async () => root.render(<WorkspaceStateProvider><QuantRecordsPage resource={resource} snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} /></WorkspaceStateProvider>));
  await act(async () => button(host, '下一页').click());
  expect(host.querySelector('.quant-pager strong')?.textContent).toBe('2 / 2');
  await inputCode(host, '000001');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain('筛选已修改');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const url = new URL(fetch.mock.lastCall![0], 'http://test');
  expect(url.searchParams.get('code')).toBe('000001');
  expect(url.searchParams.get('page')).toBe('1');
  expect(host.querySelector('.quant-pager strong')?.textContent).toBe('1 / 1');
  expect(host.textContent).toContain('当前筛选条件下暂无');
  await act(async () => button(host, '清空筛选').click());
  expect(fetch.mock.lastCall![0]).not.toContain('code=');
});

it.each(resources)('%s discards late filtered responses and cancels obsolete work', async resource => {
  let resolveOld!: (value: Response) => void;
  const fetch = vi.fn().mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValue(jsonResponse({ ...pageFixture([{ code: '000002', name: '当前查询' }]), ...(resource === 'accounts' ? { available: true } : {}) }));
  vi.stubGlobal('fetch', fetch);
  const host = setup();
  await act(async () => root.render(<QuantRecordsPage resource={resource} snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} />));
  const firstSignal = fetch.mock.calls[0][1].signal;
  await inputCode(host, '000002');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(firstSignal.aborted).toBe(true);
  expect(host.textContent).toContain('当前查询');
  await act(async () => resolveOld(jsonResponse({ ...pageFixture([{ code: '000001', name: '过期查询' }]), ...(resource === 'accounts' ? { available: true } : {}) })));
  expect(host.textContent).not.toContain('过期查询');
});

it.each([404, 503])('shows an explicit %s error without a fabricated empty list', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'private' }, status)));
  const host = setup();
  await act(async () => root.render(<QuantRecordsPage resource="holdings" snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} />));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(String(status));
  expect(host.textContent).not.toContain('暂无持仓记录');
  expect(host.querySelector('.quant-pager')).toBeNull();
});

it('delegates 409 to the single snapshot owner without retrying the old page', async () => {
  const fetch = vi.fn().mockResolvedValue(jsonResponse({}, 409)); vi.stubGlobal('fetch', fetch);
  const conflict = vi.fn(); const host = setup();
  await act(async () => root.render(<QuantRecordsPage resource="signals" snapshot={overviewFixture()} onSnapshotConflict={conflict} />));
  expect(conflict).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(host.querySelector('table')).toBeNull();
});

it('keeps observation and signal filters separate, including holding observations', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(pageFixture([]))));
  const host = setup(); const conflict = vi.fn();
  await act(async () => root.render(<QuantRecordsPage key="observation" resource="observations" snapshot={overviewFixture()} onSnapshotConflict={conflict} />));
  const observations = [...host.querySelectorAll('select option')].map(item => item.value);
  expect(observations).toContain('hold'); expect(observations).toContain('not_triggered');
  expect(observations).not.toContain('cancelled');
  await act(async () => root.render(<QuantRecordsPage key="signal" resource="signals" snapshot={overviewFixture()} onSnapshotConflict={conflict} />));
  const signals = [...host.querySelectorAll('select option')].map(item => item.value);
  expect(signals).toContain('cancelled'); expect(signals).not.toContain('holding'); expect(signals).not.toContain('not_triggered');
});

it('returns bottom-pagination users to the new records after an asynchronous page load', async () => {
  const rows = Array.from({ length: 75 }, (_, i) => ({ code: String(i).padStart(6, '0'), name: `记录${i}` }));
  let finishPage!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const page = Number(new URL(input, 'http://test').searchParams.get('page'));
    return page === 2 ? new Promise<Response>(resolve => { finishPage = resolve; }) : jsonResponse(pageFixture(rows, page, 50));
  }));
  const host = setup();
  await act(async () => root.render(<QuantRecordsPage resource="signals" snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} />));
  const region = host.querySelector<HTMLElement>('.quant-paged-results')!;
  const scroll = vi.fn();
  region.scrollIntoView = scroll;
  expect(document.activeElement).not.toBe(region);
  expect(host.querySelectorAll('.quant-pager')).toHaveLength(2);
  expect(host.querySelector('.quant-table-scroll')?.hasAttribute('tabindex')).toBe(false);
  await act(async () => button(host.querySelector<HTMLElement>('[aria-label="底部分页"]')!, '下一页').click());
  expect(document.activeElement).toBe(region);
  expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
  expect(region.getAttribute('aria-busy')).toBe('true');
  expect(host.querySelector('tbody')).toBeNull();
  await act(async () => finishPage(jsonResponse(pageFixture(rows, 2, 50))));
  expect(scroll).toHaveBeenCalledTimes(2);
  expect(document.activeElement).toBe(region);
  expect(region.getAttribute('aria-busy')).toBe('false');
  expect(host.querySelector('tbody tr')?.textContent).toContain('000050');
  expect(host.querySelectorAll('.quant-pager')).toHaveLength(2);
  expect(host.querySelector('.quant-pager-count')?.textContent).toContain('第 51–75 条');
  expect([...host.querySelectorAll('.quant-pager strong')].map(item => item.textContent)).toEqual(['2 / 2', '2 / 2']);
});


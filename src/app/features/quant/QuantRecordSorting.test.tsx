// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { QuantSignalsPage } from './QuantSignalsPage';
import { QuantExecutionsPage } from './QuantExecutionsPage';
import { jsonResponse, overviewFixture, pageFixture } from './quant-test-fixtures';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
const cases = [{ Component: QuantSignalsPage, label: '信号时间' }, { Component: QuantExecutionsPage, label: '成交时间' }];
const records = Array.from({ length: 205 }, (_, index) => ({
  code: String(index).padStart(6, '0'), name: `股票${index}`, action: 'buy' as const,
  signal_at: new Date(Date.parse('2026-09-04T01:39:00Z') + index * 60000).toISOString(),
  execution_at: new Date(Date.parse('2026-09-04T01:42:00Z') + index * 60000).toISOString(),
}));
function setup(items = records) {
  const fetch = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://test');
    return jsonResponse(pageFixture(items, Number(url.searchParams.get('page')), Number(url.searchParams.get('page_size'))));
  });
  vi.stubGlobal('fetch', fetch);
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  return { host, fetch };
}
const names = (host: HTMLElement) => [...host.querySelectorAll('tbody tr td:first-child strong')].map(item => item.textContent);
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)!;

it.each(cases)('sorts all pages by $label and locally paginates without truncating records', async ({ Component, label }) => {
  const { host, fetch } = setup();
  await act(async () => root.render(<Component snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} />));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(names(host)).toHaveLength(50);
  await act(async () => button(host, '下一页').click());
  expect(fetch).toHaveBeenCalledTimes(2);
  await act(async () => button(host, label).click());
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(names(host)[0]).toBe('股票204');
  expect(host.querySelector('.quant-pager strong')?.textContent).toBe('1 / 5');
  const all = [...names(host)];
  for (let page = 2; page <= 5; page += 1) {
    await act(async () => button(host, '下一页').click()); all.push(...names(host));
  }
  expect(all).toEqual(records.map(item => item.name).reverse());
  expect(fetch).toHaveBeenCalledTimes(4);
  await act(async () => button(host, label).click());
  expect(names(host)[0]).toBe('股票0');
  expect(host.querySelector('.quant-pager strong')?.textContent).toBe('1 / 5');
  expect(fetch).toHaveBeenCalledTimes(4);
});

it.each(cases)('leaves unavailable $label last and compares timestamp offsets', async ({ Component, label }) => {
  const items = [
    { code: '000001', name: 'A', action: 'buy' as const, signal_at: '2026-09-04T09:39:00+08:00', execution_at: '2026-09-04T09:39:00+08:00' },
    { code: '000002', name: 'B', action: 'buy' as const, signal_at: '2026-09-04T06:00:00Z', execution_at: '2026-09-04T06:00:00Z' },
    { code: '000003', name: 'C', action: 'buy' as const, signal_at: 'invalid', execution_at: 'invalid' },
  ];
  const { host } = setup(items);
  await act(async () => root.render(<Component snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} />));
  await act(async () => button(host, label).click());
  expect(names(host)).toEqual(['B', 'A', 'C']);
  await act(async () => button(host, label).click());
  expect(names(host)).toEqual(['A', 'B', 'C']);
});


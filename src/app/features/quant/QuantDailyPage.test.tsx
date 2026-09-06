// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { QuantDailyPage } from './QuantDailyPage';
import { dailyFixture, jsonResponse, overviewFixture } from './quant-test-fixtures';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
function setup() { const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); return host; }

it('loads the selected full public snapshot and treats closed trades as day records', async () => {
  const fetch = vi.fn().mockResolvedValue(jsonResponse({ data: dailyFixture({ closed_trades: { count: 1, items: [{ code: '000001', name: '当日已平仓', total_fees: 0, net_pnl: 12, net_return: 0.0123 }] } }) }));
  vi.stubGlobal('fetch', fetch); const host = setup();
  await act(async () => root.render(<QuantDailyPage snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} />));
  expect(fetch.mock.calls[0][0]).toContain('/daily-results/2026-09-04');
  await act(async () => { const select = host.querySelector<HTMLSelectElement>('[aria-label="完整记录业务列表"]')!; select.value = 'closed-trades'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.textContent).toContain('当日已平仓'); expect(host.textContent).toContain('+¥12.00'); expect(host.textContent).toContain('+1.23%');
  expect(host.textContent).toContain('仅包含所选交易日');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('rejects a full snapshot that differs from the overview identity', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: dailyFixture({ snapshot_id: 'changed' }) })));
  const conflict = vi.fn(); const host = setup();
  await act(async () => root.render(<QuantDailyPage snapshot={overviewFixture()} onSnapshotConflict={conflict} />));
  expect(conflict).toHaveBeenCalledTimes(1); expect(host.querySelector('table')).toBeNull();
});

it('ignores a cancelled response when changing dates', async () => {
  let resolveOld!: (value: Response) => void;
  const fetch = vi.fn().mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(jsonResponse({ data: dailyFixture({ trade_date: '2026-09-03' }) }));
  vi.stubGlobal('fetch', fetch); const host = setup(); const conflict = vi.fn();
  await act(async () => root.render(<QuantDailyPage key="first" snapshot={overviewFixture()} onSnapshotConflict={conflict} />));
  await act(async () => root.render(<QuantDailyPage key="second" snapshot={overviewFixture({ trade_date: '2026-09-03' })} onSnapshotConflict={conflict} />));
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => resolveOld(jsonResponse({ data: dailyFixture() })));
  expect(host.textContent).toContain('2026-09-03 · 当日完整记录');
  expect(host.textContent).not.toContain('2026-09-04 · 当日完整记录');
});


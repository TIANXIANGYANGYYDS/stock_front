import { afterEach, expect, it, vi } from 'vitest';
import { loadQuantPerformance } from './quant-records';
import { jsonResponse, overviewFixture, performanceFixture, rebasedSnapshotFixture, REBASED_TEST_DATES } from './quant-test-fixtures';
import { performancePointLabel } from './QuantPerformance';
afterEach(() => vi.unstubAllGlobals());

it('fetches more than one page, retains all recorded dates and sorts ascending', async () => {
  const points = Array.from({ length: 205 }, (_, index) => overviewFixture({ trade_date: new Date(Date.UTC(2026, 8, 3 + index)).toISOString().slice(0, 10), snapshot_id: `point-${index}` }));
  const snapshot = points.at(-1)!;
  const descending = [...points].reverse();
  const fetch = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://test');
    const page = Number(url.searchParams.get('page'));
    expect(url.searchParams.get('start_date')).toBe('2026-09-03');
    expect(url.searchParams.get('end_date')).toBe(snapshot.trade_date);
    return jsonResponse({ strategy_id: 'strategy_1', strategy_name: '策略1', items: descending.slice((page - 1) * 200, page * 200), total: 205, page, page_size: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  const result = await loadQuantPerformance(snapshot);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result.map(item => item.trade_date)).toEqual(points.map(item => item.trade_date));
});

it('excludes pre-recording research points without filling missing dates or null returns', async () => {
  const snapshot = overviewFixture({ trade_date: '2026-09-07' });
  const points = [overviewFixture({ trade_date: '2026-09-02' }), overviewFixture({ trade_date: '2026-09-03', summary: { total_return: 0 } }), { ...snapshot, summary: { total_return: null } }];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ strategy_id: 'strategy_1', items: points, total: 3, page: 1, page_size: 200 })));
  const result = await loadQuantPerformance(snapshot);
  expect(result.map(item => item.trade_date)).toEqual(['2026-09-03', '2026-09-07']);
  expect(result.map(item => item.summary.total_return)).toEqual([0, null]);
});

it('rejects a curve from a different current-day snapshot', async () => {
  const point = overviewFixture({ snapshot_id: 'changed' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ strategy_id: 'strategy_1', items: [point], total: 1, page: 1, page_size: 200 })));
  await expect(loadQuantPerformance(overviewFixture())).rejects.toMatchObject({ status: 409 });
});

it('reports historical errors and stops after cancellation instead of exposing a partial curve', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(loadQuantPerformance(overviewFixture(), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockResolvedValue(jsonResponse({}, 503));
  await expect(loadQuantPerformance(overviewFixture())).rejects.toMatchObject({ status: 503 });
});

it('never labels an intraday point as final close', () => {
  expect(performancePointLabel(overviewFixture({ runtime: { data_status: 'fresh' } }))).toContain('非最终收盘');
  expect(performancePointLabel(overviewFixture({ runtime: { data_status: 'closed_partial' } }))).toBe('收盘记录');
});

it('uses the rebased account start and preserves exactly the twelve recorded days', async () => {
  const points = REBASED_TEST_DATES.map(date => rebasedSnapshotFixture(date));
  const fetch = vi.fn().mockResolvedValue(jsonResponse(performanceFixture([...points].reverse())));
  vi.stubGlobal('fetch', fetch);
  const result = await loadQuantPerformance(points.at(-1)!);
  expect(new URL(fetch.mock.calls[0][0], 'http://test').searchParams.get('start_date')).toBe('2026-08-20');
  expect(result.map(point => point.trade_date)).toEqual(REBASED_TEST_DATES);
  expect(result).not.toContainEqual(expect.objectContaining({ trade_date: '2026-08-22' }));
});

it('does not invent a fallback start when the backend has not provided one', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(loadQuantPerformance(overviewFixture({ recording: { start_date: null } }))).rejects.toThrow('账户记录起点缺失');
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects a mixed old-start and rebased history instead of joining their returns', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(performanceFixture([overviewFixture({ trade_date: '2026-09-03' }), rebasedSnapshotFixture()]))));
  await expect(loadQuantPerformance(rebasedSnapshotFixture())).rejects.toThrow('账户起点不一致');
});

it('does not silently accept a history missing its as-of date', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(performanceFixture([rebasedSnapshotFixture('2026-08-20')]))));
  await expect(loadQuantPerformance(rebasedSnapshotFixture())).rejects.toThrow('缺少数据截至日');
});

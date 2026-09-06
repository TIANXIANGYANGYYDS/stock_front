import { afterEach, expect, it, vi } from 'vitest';
import { getQuantExecutionRangePage } from './quant-api';
import { loadQuantExecutionRange } from './quant-execution-range';
import { rangeItem, rangeJson, rangeQuery, rangeResponse } from './execution-range-test-fixtures';
afterEach(() => vi.unstubAllGlobals());
const records = [rangeItem({ event_id: 'sell-1', action: 'sell', trade_date: '2026-09-01', execution_at: '2026-09-01T10:39:00+08:00' }), rangeItem()];

it('loads both size-one pages, pins range versions, preserves day identities and sorts oldest first', async () => {
  const fetch = vi.fn(async (path: string) => {
    const url = new URL(path, 'http://test'); const page = Number(url.searchParams.get('page'));
    expect(url.searchParams.get('code')).toBe('000036');
    expect(url.searchParams.has('trade_date')).toBe(false); expect(url.searchParams.has('snapshot_id')).toBe(false);
    expect(url.searchParams.get('history_version')).toBe(page === 1 ? null : 'history-a');
    return rangeJson(rangeResponse(records, page, 1));
  });
  vi.stubGlobal('fetch', fetch);
  const result = await loadQuantExecutionRange(rangeQuery, { pageSize: 1 });
  expect(fetch).toHaveBeenCalledTimes(2); expect(result.trade_date).toBeNull();
  expect(result.items.map(item => item.event_id)).toEqual(['buy-1', 'sell-1']);
  expect(result.items[0].snapshot_id).toBe('source-day-version');
  expect(result.items[0].execution_price).toBe(4.002001);
});

it('discards every old page on 409 and restarts page one without its old version', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(rangeJson(rangeResponse(records, 1, 1)))
    .mockResolvedValueOnce(rangeJson({}, 409))
    .mockResolvedValueOnce(rangeJson(rangeResponse([rangeItem({ event_id: 'new-buy' })], 1, 1, 'history-b')));
  vi.stubGlobal('fetch', fetch); const conflict = vi.fn();
  const result = await loadQuantExecutionRange(rangeQuery, { pageSize: 1, onConflict: conflict });
  expect(result.items.map(item => item.event_id)).toEqual(['new-buy']); expect(result.history_version).toBe('history-b');
  expect(new URL(fetch.mock.calls[2][0], 'http://test').searchParams.has('history_version')).toBe(false);
  expect(conflict).toHaveBeenCalledOnce();
});

it('limits repeated history conflicts instead of looping or reporting an empty success', async () => {
  const fetch = vi.fn().mockResolvedValue(rangeJson({}, 409)); vi.stubGlobal('fetch', fetch);
  await expect(loadQuantExecutionRange(rangeQuery)).rejects.toThrow('已停止自动重试');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('also recovers a mismatched version in a successful later page', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(rangeJson(rangeResponse(records, 1, 1)))
    .mockResolvedValueOnce(rangeJson(rangeResponse(records, 2, 1, 'history-b')))
    .mockResolvedValueOnce(rangeJson(rangeResponse([], 1, 1, 'history-b'))));
  const result = await loadQuantExecutionRange(rangeQuery, { pageSize: 1 });
  expect(result.history_version).toBe('history-b'); expect(result.items).toEqual([]);
});

it('deduplicates event identities while preserving separate executions on the same day', async () => {
  const items = [rangeItem(), rangeItem(), rangeItem({ event_id: 'buy-2' })];
  vi.stubGlobal('fetch', vi.fn(async (path: string) => rangeJson(rangeResponse(items, Number(new URL(path, 'http://test').searchParams.get('page')), 1))));
  expect((await loadQuantExecutionRange(rangeQuery, { pageSize: 1 })).items).toHaveLength(2);
});

it('revalidates a cached history version and reloads all pages after an earlier day is recomputed', async () => {
  const cached = rangeResponse(records);
  const fetch = vi.fn().mockResolvedValueOnce(rangeJson(rangeResponse(records, 1, 1)))
    .mockResolvedValueOnce(rangeJson(rangeResponse([rangeItem({ event_id: 'rebased' })], 1, 1, 'history-b')));
  vi.stubGlobal('fetch', fetch);
  expect((await loadQuantExecutionRange(rangeQuery, { cached, pageSize: 1 })).items).toHaveLength(2);
  expect(fetch).toHaveBeenCalledTimes(1);
  const next = await loadQuantExecutionRange(rangeQuery, { cached, pageSize: 1 });
  expect(next.items[0].event_id).toBe('rebased'); expect(next.history_version).toBe('history-b');
});

it.each([404, 422, 503, 500])('surfaces HTTP %s without producing fake empty records', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rangeJson({}, status)));
  await expect(loadQuantExecutionRange(rangeQuery)).rejects.toMatchObject({ status });
});

it('passes action filtering and accepts a valid empty range', async () => {
  const query = { ...rangeQuery, action: 'buy' as const };
  const fetch = vi.fn().mockResolvedValue(rangeJson(rangeResponse([], 1, 200, 'history-a', query))); vi.stubGlobal('fetch', fetch);
  expect((await loadQuantExecutionRange(query)).items).toEqual([]);
  expect(fetch.mock.calls[0][0]).toContain('action=buy');
});

it('rejects malformed range identity and incomplete pagination', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(rangeJson({ ...rangeResponse(records), trade_date: '2026-09-04' }))
    .mockResolvedValueOnce(rangeJson({ ...rangeResponse(records), items: [] })); vi.stubGlobal('fetch', fetch);
  await expect(getQuantExecutionRangePage(rangeQuery, { pageSize: 200 })).rejects.toThrow('查询不一致');
  await expect(getQuantExecutionRangePage(rangeQuery, { pageSize: 200 })).rejects.toThrow('分页数据不完整');
});

it('does not continue pagination when a pending response arrives after cancellation', async () => {
  let finish!: (value: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal('fetch', fetch);
  const controller = new AbortController(); const promise = loadQuantExecutionRange(rangeQuery, { pageSize: 1, signal: controller.signal });
  controller.abort(); finish(rangeJson(rangeResponse(records, 1, 1)));
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' }); expect(fetch).toHaveBeenCalledOnce();
});

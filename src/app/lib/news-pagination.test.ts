import { afterEach, expect, it, vi } from 'vitest';
import { getNews } from './api';

afterEach(() => vi.unstubAllGlobals());

it('requests one server-sorted page with a stable snapshot and filtered total', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({
    page: 2, page_size: 1, total: 3, snapshot: 123,
    items: [{ event_id: 'hit', title: '新闻标题', publish_ts: 1786080000 }],
  })));
  vi.stubGlobal('fetch', fetch);
  const response = await getNews({ tradeDate: '2026-08-07', search: '通信设备', sort: 'impact_asc',
    page: 2, pageSize: 1, snapshot: 123, sentiment: 'negative' });
  expect(fetch).toHaveBeenCalledTimes(1);
  const url = String(vi.mocked(globalThis.fetch).mock.calls[0][0]);
  expect(Object.fromEntries(new URL(url, 'http://localhost').searchParams)).toMatchObject({
    page: '2', page_size: '1', keyword: '通信设备', sort_by: 'score', sort_order: 'asc',
    snapshot: '123', sentiment: 'negative', view: 'feed',
  });
  expect(response.pagination.total).toBe(3);
  expect(response.items[0].id).toBe('hit');
});

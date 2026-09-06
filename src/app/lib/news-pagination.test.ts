import { afterEach, expect, it, vi } from 'vitest';
import { getNews } from './api';

afterEach(() => vi.unstubAllGlobals());

it('includes later backend pages before filtering, sorting and slicing the UI page', async () => {
  const requests: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost');
    requests.push(url);
    const page = Number(url.searchParams.get('page'));
    return new Response(JSON.stringify({ total: 3, page_size: 2, items: page === 1 ? [
      { event_id: 'first', title: '较新资讯', publish_ts: 1786090000 },
      { event_id: 'second', title: '最新资讯', publish_ts: 1786100000 },
    ] : [{ event_id: 'third', title: '最早资讯', publish_ts: 1786080000 }] }));
  }));
  const response = await getNews({ tradeDate: '2026-08-07', sort: 'time_asc', page: 1, pageSize: 1 });
  expect(requests.map((url) => url.searchParams.get('page'))).toEqual(['1', '2']);
  expect(response.items.map((item) => item.title)).toEqual(['最早资讯']);
  expect(response.pagination.total).toBe(3);
});

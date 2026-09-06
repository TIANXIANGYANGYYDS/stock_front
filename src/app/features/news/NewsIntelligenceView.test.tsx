// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getNews: vi.fn().mockResolvedValue({
    tradeDate: '2026-08-07',
    items: [],
    pagination: { page: 1, page_size: 100, total: 0, returned: 0 },
  }),
}));

vi.mock('../../lib/api', () => ({
  getNews: apiMocks.getNews,
}));

import { NewsIntelligenceView } from './NewsIntelligenceView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
  apiMocks.getNews.mockClear();
  vi.useRealTimers();
});

describe('NewsIntelligenceView controls', () => {
  it('paginates and sorts the complete loaded window without fetching it again', async () => {
    vi.useFakeTimers();
    apiMocks.getNews.mockResolvedValueOnce({
      tradeDate: '2026-08-07',
      items: Array.from({ length: 201 }, (_, index) => ({
        id: String(index), title: `资讯${index}`, content: `正文${index}`, summary: '', source: '测试来源',
        publishTs: 1000 - index, impact: index, sentiment: 'positive', keyPoints: [], relatedStocks: [],
      })),
      pagination: { page: 1, page_size: 201, total: 201, returned: 201 },
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<NewsIntelligenceView tradeDate="2026-08-07" />));
    await act(async () => vi.advanceTimersByTimeAsync(180));
    const button = (label: string) => [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label)!;
    expect(host.querySelectorAll('.news-stream-item')).toHaveLength(100);
    expect(host.textContent).toContain('共 201 条');
    await act(async () => button('下一页').click());
    expect(host.querySelector('.news-stream-item h3')?.textContent).toBe('资讯100');
    await act(async () => button('按评分').click());
    expect(host.querySelector('.news-pagination')?.textContent).toContain('1 / 3');
    expect(host.querySelector('.news-stream-item h3')?.textContent).toBe('资讯200');
    expect(apiMocks.getNews).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('recovers from a failed request and lets the user clear a filter with no matches', async () => {
    vi.useFakeTimers();
    apiMocks.getNews.mockRejectedValueOnce(new Error('网络异常'));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<NewsIntelligenceView tradeDate="2026-08-07" />));
    await act(async () => vi.advanceTimersByTimeAsync(180));
    const button = (label: string) => [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label)!;
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('网络异常');
    await act(async () => button('重试').click());
    await act(async () => vi.advanceTimersByTimeAsync(180));
    expect(host.querySelector('[role="alert"]')).toBeNull();
    await act(async () => button('利好').click());
    await act(async () => button('清除筛选').click());
    expect(button('全部').getAttribute('aria-pressed')).toBe('true');
    expect(apiMocks.getNews).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
  });

  it('exposes independent date window, sort field, and sort direction controls', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<NewsIntelligenceView tradeDate="2026-08-07" />));

    expect(host.querySelector('.view-heading')).toBeNull();
    const search = host.querySelector<HTMLInputElement>(
      'input[placeholder="搜索新闻、股票或板块"]',
    );
    expect(search).not.toBeNull();
    expect(search?.closest('.news-filter-bar')).not.toBeNull();

    const button = (label: string) => {
      const match = [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
      if (!match) throw new Error(`Missing button: ${label}`);
      return match;
    };
    for (const label of ['当天', '3天', '7天', '按时间', '按评分', '降序', '升序']) button(label);

    await act(async () => {
      button('7天').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button('按评分').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button('升序').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(button('7天').className).toContain('is-active');
    expect(button('按评分').className).toContain('is-active');
    expect(button('升序').className).toContain('is-active');
    expect(host.textContent).toContain('资讯窗口：7天 · 影响分升序');

    await act(async () => root.unmount());
  });

  it('keeps the relocated search input connected to the news request', async () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<NewsIntelligenceView tradeDate="2026-08-07" />));
    const search = host.querySelector<HTMLInputElement>(
      'input[placeholder="搜索新闻、股票或板块"]',
    );
    if (!search) throw new Error('Missing relocated news search input');
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    await act(async () => {
      valueSetter?.call(search, ' 中际旭创 ');
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(180);
    });

    expect(apiMocks.getNews).toHaveBeenLastCalledWith({
      tradeDate: '2026-08-07',
      windowDays: 1,
      search: '中际旭创',
      sentiment: null,
      page: 1,
      pageSize: 'all',
    }, { signal: expect.any(AbortSignal) });

    await act(async () => root.unmount());
  });
});

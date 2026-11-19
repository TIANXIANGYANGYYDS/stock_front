// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getNewsUpdates: vi.fn().mockResolvedValue(2),
  getNews: vi.fn().mockResolvedValue({
    tradeDate: '2026-08-07',
    items: [],
    pagination: { page: 1, page_size: 100, total: 0, returned: 0 },
  }),
}));

vi.mock('../../lib/api', () => ({
  getNews: apiMocks.getNews,
  getNewsUpdates: apiMocks.getNewsUpdates,
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
  it('requests the selected server page and waits for the reader to accept new items', async () => {
    vi.useFakeTimers();
    const response = { snapshot: 123, items: [{ id: '1', title: '正在阅读',
      content: '正文', summary: '', source: '测试', impact: 5, sentiment: 'neutral', keyPoints: [], relatedStocks: [] }],
      pagination: { page: 1, page_size: 100, total: 201, returned: 1 } };
    apiMocks.getNews.mockResolvedValueOnce(response).mockResolvedValueOnce(response);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<NewsIntelligenceView tradeDate="2026-08-07" />));
    await act(async () => vi.advanceTimersByTimeAsync(200));
    const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent?.trim() === label)!;
    await act(async () => button('下一页').click());
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(apiMocks.getNews).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, snapshot: 123 }), expect.anything());
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(apiMocks.getNewsUpdates).toHaveBeenCalled();
    expect(host.textContent).toContain('有 2 条新资讯');
    expect(host.textContent).toContain('正在阅读');
    expect(apiMocks.getNews).toHaveBeenCalledTimes(2);
    await act(async () => button('有 2 条新资讯 · 查看').click());
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(apiMocks.getNews).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, snapshot: undefined }), expect.anything());
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

    expect(apiMocks.getNews).toHaveBeenLastCalledWith(expect.objectContaining({
      tradeDate: '2026-08-07',
      windowDays: 1,
      search: '中际旭创',
      sentiment: null,
      page: 1,
      pageSize: 100,
    }), { signal: expect.any(AbortSignal) });

    await act(async () => root.unmount());
  });
});

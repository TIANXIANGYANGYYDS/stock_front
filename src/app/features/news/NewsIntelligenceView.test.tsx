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
      pageSize: 100,
    });

    await act(async () => root.unmount());
  });
});

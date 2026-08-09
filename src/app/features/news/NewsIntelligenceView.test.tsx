// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  getNews: vi.fn().mockResolvedValue({ tradeDate: '2026-08-07', items: [], pagination: { page: 1, page_size: 100, total: 0, returned: 0 } }),
}));

import { NewsIntelligenceView } from './NewsIntelligenceView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('NewsIntelligenceView controls', () => {
  it('exposes independent date window, sort field, and sort direction controls', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<NewsIntelligenceView tradeDate="2026-08-07" />));

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
});

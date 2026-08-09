// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

vi.mock('../../components/MarketAnalysis', () => ({ MarketAnalysis: () => <section>盘前分析</section> }));
vi.mock('../../components/SectorTrend', () => ({ SectorTrend: () => <section>投资倾向</section> }));
vi.mock('../../components/NewsHeatmap', () => ({ NewsHeatmap: () => <section>新闻热度</section> }));

import { vi } from 'vitest';
import { MarketInsightsView } from './MarketInsightsView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MarketInsightsView ranking windows', () => {
  it('lets both rankings share hour, day, three-day, and seven-day windows', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<MarketInsightsView preferredTradeDate="2026-08-07" />));

    for (const label of ['1小时', '1天', '3天', '7天']) {
      expect([...host.querySelectorAll('button')].some((button) => button.textContent === label)).toBe(true);
    }
    const threeDay = [...host.querySelectorAll('button')].find((button) => button.textContent === '3天');
    if (!threeDay) throw new Error('Missing three-day window');
    await act(async () => threeDay.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(threeDay.className).toContain('is-active');
    expect(host.textContent).toContain('排名窗口：3天');

    await act(async () => root.unmount());
  });
});

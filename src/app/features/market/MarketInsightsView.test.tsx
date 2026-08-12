// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

vi.mock('../../components/MarketAnalysis', () => ({
  MarketAnalysis: ({ analysisDate }: { analysisDate: string | null }) => (
    <section>盘前分析日期 {analysisDate ?? 'latest'}</section>
  ),
}));
vi.mock('../../components/SectorTrend', () => ({
  SectorTrend: ({ bizDate }: { bizDate: string }) => <section>投资倾向 {bizDate}</section>,
}));
vi.mock('../../components/NewsHeatmap', () => ({
  NewsHeatmap: ({ bizDate }: { bizDate: string }) => <section>新闻热度 {bizDate}</section>,
}));

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
    await act(async () => root.render(
      <MarketInsightsView marketTradeDate="2026-08-10" analysisDate="2026-08-11" />,
    ));

    expect(host.textContent).toContain('盘前分析日期 2026-08-11');
    expect(host.textContent).toContain('投资倾向 2026-08-10');
    expect(host.textContent).toContain('新闻热度 2026-08-10');
    expect(host.querySelector('.view-heading')).toBeNull();

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

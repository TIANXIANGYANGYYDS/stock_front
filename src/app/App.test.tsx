// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  getLatestTradeDate: vi.fn(),
  getMarketOverview: vi.fn(),
}));

vi.mock('./lib/api', () => ({
  getLatestTradeDate: apiMocks.getLatestTradeDate,
  getMarketOverview: apiMocks.getMarketOverview,
}));

vi.mock('./components/TerminalHeader', () => ({
  TerminalHeader: ({
    marketError,
    onViewChange,
  }: {
    marketError: string | null;
    onViewChange: (view: string) => void;
  }) => (
    <header>
      terminal header {marketError}
      <button type="button" onClick={() => onViewChange('creators')}>博主观点</button>
    </header>
  ),
}));

vi.mock('./features/decision/DecisionWorkspace', () => ({
  DecisionWorkspace: ({ preferredTradeDate }: { preferredTradeDate: string }) => (
    <main data-testid="decision-workspace">workspace {preferredTradeDate}</main>
  ),
}));

vi.mock('./features/market/MarketInsightsView', () => ({
  MarketInsightsView: () => <main>market insights</main>,
}));

vi.mock('./features/news/NewsIntelligenceView', () => ({
  NewsIntelligenceView: () => <main>news intelligence</main>,
}));

vi.mock('./features/creators/CreatorInsightsView', () => ({
  CreatorInsightsView: () => <main data-testid="creator-insights">creator insights</main>,
}));

import App from './App';

afterEach(() => {
  apiMocks.getLatestTradeDate.mockReset();
  apiMocks.getMarketOverview.mockReset();
  document.body.innerHTML = '';
});

describe('App latest trading date gate', () => {
  it('does not load or mount date-related data before the date endpoint resolves', async () => {
    let resolveDate!: (value: string | null) => void;
    apiMocks.getLatestTradeDate.mockReturnValue(new Promise((resolve) => {
      resolveDate = resolve;
    }));
    apiMocks.getMarketOverview.mockResolvedValue({
      tradeDate: '2026-08-07', updatedAt: '', items: [], stockCount: 0, newsCount: 0,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<App />));

    expect(host.textContent).toContain('正在解析 Stock_Project 最新交易日');
    expect(host.querySelector('[data-testid="decision-workspace"]')).toBeNull();
    expect(apiMocks.getLatestTradeDate).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDate('2026-08-07');
      await Promise.resolve();
    });

    expect(host.textContent).toContain('workspace 2026-08-07');
    expect(apiMocks.getMarketOverview).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('stops initialization when the market endpoint returns a null date', async () => {
    apiMocks.getLatestTradeDate.mockResolvedValue(null);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<App />));

    expect(host.textContent).toContain('Stock_Project 未返回最新交易日');
    expect(host.querySelector('[data-testid="decision-workspace"]')).toBeNull();

    await act(async () => root.unmount());
  });

  it('shows an explicit error and stops initialization when the date request fails', async () => {
    apiMocks.getLatestTradeDate.mockRejectedValue(new Error('接口请求失败: 503'));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<App />));

    expect(host.textContent).toContain('最新交易日加载失败：接口请求失败: 503');
    expect(host.querySelector('[data-testid="decision-workspace"]')).toBeNull();

    await act(async () => root.unmount());
  });

  it('opens realtime creator intelligence without waiting for the trading date gate', async () => {
    apiMocks.getLatestTradeDate.mockReturnValue(new Promise(() => undefined));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<App />));

    const creatorButton = [...host.querySelectorAll('button')].find(
      (item) => item.textContent?.includes('博主观点'),
    );
    if (!creatorButton) throw new Error('Missing creator workspace button');
    await act(async () => creatorButton.click());

    expect(host.querySelector('[data-testid="creator-insights"]')).not.toBeNull();
    expect(host.textContent).not.toContain('正在解析 Stock_Project 最新交易日');

    await act(async () => root.unmount());
  });
});

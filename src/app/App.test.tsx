// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  getLatestMarketDates: vi.fn(),
  getMarketOverview: vi.fn(),
}));

const realtimeMocks = vi.hoisted(() => ({
  useRealtimeMarketIndices: vi.fn(),
}));

vi.mock('./lib/api', () => ({
  getLatestMarketDates: apiMocks.getLatestMarketDates,
  getMarketOverview: apiMocks.getMarketOverview,
}));

vi.mock('./hooks/useRealtimeQuotes', () => realtimeMocks);

vi.mock('./components/TerminalHeader', () => ({
  TerminalHeader: ({
    realtimeIndices,
    indicesError,
    onViewChange,
  }: {
    realtimeIndices: { items: Array<{ price: number | null }> } | null;
    indicesError: string | null;
    onViewChange: (view: string) => void;
  }) => (
    <header>
      terminal header {indicesError} index price {realtimeIndices?.items[0]?.price ?? '--'}
      <button type="button" onClick={() => onViewChange('market')}>市场洞察</button>
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
  MarketInsightsView: ({
    marketTradeDate,
    analysisDate,
  }: {
    marketTradeDate: string;
    analysisDate: string | null;
  }) => (
    <main data-testid="market-insights">
      market {marketTradeDate} analysis {analysisDate ?? 'latest'}
    </main>
  ),
}));

vi.mock('./features/news/NewsIntelligenceView', () => ({
  NewsIntelligenceView: () => <main>news intelligence</main>,
}));

vi.mock('./features/creators/CreatorInsightsView', () => ({
  CreatorInsightsView: () => <main data-testid="creator-insights">creator insights</main>,
}));

import App from './App';

afterEach(() => {
  vi.useRealTimers();
  apiMocks.getLatestMarketDates.mockReset();
  apiMocks.getMarketOverview.mockReset();
  realtimeMocks.useRealtimeMarketIndices.mockReset();
  document.body.innerHTML = '';
});

describe('App latest trading date gate', () => {
  function prepareIndices() {
    realtimeMocks.useRealtimeMarketIndices.mockReturnValue({
      data: {
        tradingDate: '2026-08-10',
        marketStatus: 'open',
        updatedAt: '2026-08-10T09:30:05+08:00',
        cacheAgeMs: 0,
        items: [{ price: 3966.59 }],
      },
      initialLoading: false,
      refreshing: false,
      delayed: false,
      error: null,
      marketStatus: 'open',
      lastSuccessAt: Date.now(),
      refresh: vi.fn(),
    });
  }

  it('refreshes the latest market date without remounting the loading gate', async () => {
    vi.useFakeTimers();
    prepareIndices();
    apiMocks.getLatestMarketDates
      .mockResolvedValueOnce({ marketTradeDate: '2026-08-11', analysisDate: '2026-08-12' })
      .mockResolvedValueOnce({ marketTradeDate: '2026-08-12', analysisDate: '2026-08-12' });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(<App />));
    await act(async () => await Promise.resolve());
    expect(host.textContent).toContain('workspace 2026-08-11');

    await act(async () => vi.advanceTimersByTime(60_000));
    await act(async () => await Promise.resolve());

    expect(apiMocks.getLatestMarketDates).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('workspace 2026-08-12');
    expect(host.textContent).not.toContain('正在解析 Stock_Project 最新交易日');

    await act(async () => root.unmount());
  });

  it('does not load or mount date-related data before the date endpoint resolves', async () => {
    prepareIndices();
    let resolveDate!: (value: {
      marketTradeDate: string | null;
      analysisDate: string | null;
    }) => void;
    apiMocks.getLatestMarketDates.mockReturnValue(new Promise((resolve) => {
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
    expect(apiMocks.getLatestMarketDates).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDate({
        marketTradeDate: '2026-08-10',
        analysisDate: '2026-08-11',
      });
      await Promise.resolve();
    });

    expect(host.textContent).toContain('workspace 2026-08-10');
    expect(apiMocks.getMarketOverview).not.toHaveBeenCalled();

    const marketButton = [...host.querySelectorAll('button')].find(
      (item) => item.textContent?.includes('市场洞察'),
    );
    if (!marketButton) throw new Error('Missing market workspace button');
    await act(async () => marketButton.click());

    expect(host.textContent).toContain('market 2026-08-10 analysis 2026-08-11');

    await act(async () => root.unmount());
  });

  it('keeps an empty analysis date separate from the market trade date', async () => {
    prepareIndices();
    apiMocks.getLatestMarketDates.mockResolvedValue({
      marketTradeDate: '2026-08-10',
      analysisDate: null,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<App />));

    const marketButton = [...host.querySelectorAll('button')].find(
      (item) => item.textContent?.includes('市场洞察'),
    );
    if (!marketButton) throw new Error('Missing market workspace button');
    await act(async () => marketButton.click());

    expect(host.textContent).toContain('market 2026-08-10 analysis latest');
    expect(host.textContent).not.toContain('analysis 2026-08-10');

    await act(async () => root.unmount());
  });

  it('stops initialization when the market endpoint returns a null date', async () => {
    prepareIndices();
    apiMocks.getLatestMarketDates.mockResolvedValue({
      marketTradeDate: null,
      analysisDate: '2026-08-11',
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<App />));

    expect(host.textContent).toContain('Stock_Project 未返回最新交易日');
    expect(host.querySelector('[data-testid="decision-workspace"]')).toBeNull();

    await act(async () => root.unmount());
  });

  it('shows an explicit error and stops initialization when the date request fails', async () => {
    prepareIndices();
    apiMocks.getLatestMarketDates.mockRejectedValue(new Error('接口请求失败: 503'));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<App />));

    expect(host.textContent).toContain('最新交易日加载失败：接口请求失败: 503');
    expect(host.querySelector('[data-testid="decision-workspace"]')).toBeNull();

    await act(async () => root.unmount());
  });

  it('opens realtime creator intelligence without waiting for the trading date gate', async () => {
    prepareIndices();
    apiMocks.getLatestMarketDates.mockReturnValue(new Promise(() => undefined));

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

  it('shows realtime indices while the latest trading date is still pending', async () => {
    prepareIndices();
    apiMocks.getLatestMarketDates.mockReturnValue(new Promise(() => undefined));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<App />));

    expect(host.textContent).toContain('index price 3966.59');
    expect(host.textContent).toContain('正在解析 Stock_Project 最新交易日');

    await act(async () => root.unmount());
  });
});

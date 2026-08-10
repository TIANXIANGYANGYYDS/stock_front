// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getStockList: vi.fn(),
  getStockDetail: vi.fn(),
}));

const quoteMocks = vi.hoisted(() => ({
  useRealtimeStocks: vi.fn(),
  useRealtimeStock: vi.fn(),
}));

vi.mock('../../lib/api', () => apiMocks);
vi.mock('../../hooks/useRealtimeQuotes', () => quoteMocks);

vi.mock('./StockNavigator', () => ({
  StockNavigator: ({
    items,
    onSelect,
  }: {
    items: Array<{ code: string; close: number | null; changePercent: number | null }>;
    onSelect: (code: string) => void;
  }) => (
    <section data-testid="stock-navigator">
      {items.map((item) => (
        <span key={item.code}>
          {item.code}:{item.close}:{item.changePercent}
        </span>
      ))}
      <button type="button" onClick={() => onSelect('000001')}>选择平安银行</button>
    </section>
  ),
}));

vi.mock('../chart/ProfessionalCandlestickChart', () => ({
  ProfessionalCandlestickChart: ({
    realtimeQuote,
  }: {
    realtimeQuote?: { code: string; close: number | null } | null;
  }) => <section data-testid="chart">图表实时 {realtimeQuote?.code}:{realtimeQuote?.close}</section>,
}));

vi.mock('./DecisionPanel', () => ({
  DecisionPanel: ({
    realtimeQuote,
  }: {
    realtimeQuote?: { code: string; close: number | null } | null;
  }) => <aside data-testid="decision-panel">快照实时 {realtimeQuote?.code}:{realtimeQuote?.close}</aside>,
}));

import { DecisionWorkspace } from './DecisionWorkspace';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  Object.values(apiMocks).forEach((mock) => mock.mockReset());
  Object.values(quoteMocks).forEach((mock) => mock.mockReset());
});

function pollingState(data: unknown) {
  return {
    data,
    initialLoading: false,
    refreshing: false,
    delayed: false,
    error: null,
    marketStatus: 'open',
    lastSuccessAt: Date.now(),
    refresh: vi.fn(),
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
  });
}

describe('DecisionWorkspace realtime stock coordination', () => {
  it('merges batch prices, preserves daily percentages, and follows selected-stock quotes', async () => {
    apiMocks.getStockList.mockResolvedValue([
      {
        code: '600519', name: '贵州茅台', tradeDate: '2026-08-10',
        close: 1300, changePercent: 1.2, amount: 10,
      },
      {
        code: '000001', name: '平安银行', tradeDate: '2026-08-10',
        close: 12, changePercent: -0.4, amount: 20,
      },
    ]);
    apiMocks.getStockDetail.mockResolvedValue(null);
    quoteMocks.useRealtimeStocks.mockReturnValue(pollingState({
      tradingDate: '2026-08-10',
      marketStatus: 'open',
      interval: '1m',
      items: [{
        code: '600519', name: '贵州茅台', market: 'SH', tradeDate: '2026-08-10',
        interval: '1m', timestamp: '2026-08-10T09:31:00+08:00', open: 1348,
        high: 1349.2, low: 1347.5, close: 1348.86, volume: 1000,
        amount: 1348860, provider: 'TENCENT',
      }],
      missingCodes: ['000001'],
    }));
    quoteMocks.useRealtimeStock.mockImplementation((code: string) => pollingState({
      tradingDate: '2026-08-10',
      marketStatus: 'open',
      interval: '1m',
      items: code === '600519' ? [{
        code: '600519', close: 1348.86,
      }] : [],
      missingCodes: code === '000001' ? ['000001'] : [],
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root?.render(<DecisionWorkspace preferredTradeDate="2026-08-10" />));
    await flush();

    expect(quoteMocks.useRealtimeStocks).toHaveBeenLastCalledWith(['600519', '000001']);
    expect(host.textContent).toContain('600519:1348.86:1.2');
    expect(host.textContent).toContain('000001:12:-0.4');
    expect(host.textContent).toContain('图表实时 600519:1348.86');
    expect(host.textContent).toContain('快照实时 600519:1348.86');

    const select = [...host.querySelectorAll('button')].find(
      (item) => item.textContent?.includes('选择平安银行'),
    );
    if (!select) throw new Error('Missing stock selection button');
    await act(async () => select.click());
    await flush();

    expect(quoteMocks.useRealtimeStock).toHaveBeenLastCalledWith('000001');
    expect(host.textContent).toContain('图表实时 :');
  });
});

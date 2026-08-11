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
  useStockIntraday: vi.fn(),
}));

vi.mock('../../lib/api', () => apiMocks);
vi.mock('../../hooks/useRealtimeQuotes', () => quoteMocks);

vi.mock('./StockNavigator', () => ({
  StockNavigator: ({
    items,
    query,
    selectedCode,
    loading,
    error,
    missingCodes,
    realtimeDelayed,
    realtimeError,
    onQueryChange,
    onSelect,
  }: {
    items: Array<{ code: string; close: number | null; changePercent: number | null }>;
    query: string;
    selectedCode: string;
    loading: boolean;
    error: string | null;
    missingCodes?: string[];
    realtimeDelayed?: boolean;
    realtimeError?: string | null;
    onQueryChange: (query: string) => void;
    onSelect: (code: string) => void;
  }) => (
    <section data-testid="stock-navigator">
      <input
        aria-label="搜索股票"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <output>{`loading:${loading};error:${error};selected:${selectedCode};missing:${missingCodes?.join(',')};delayed:${String(realtimeDelayed)};realtimeError:${realtimeError}`}</output>
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
  stockCode,
  stockName,
  realtimeData,
  realtimeLoading,
  realtimeDelayed,
  realtimeError,
  intradayData,
  intradayLoading,
  intradayDelayed,
  intradayError,
  chartMode,
  intradayInterval,
}: {
    stockCode?: string;
    stockName?: string;
    realtimeData?: { items: Array<{ code: string; price: number | null }> } | null;
    realtimeLoading?: boolean;
    realtimeDelayed?: boolean;
    realtimeError?: string | null;
    intradayData?: { items: Array<{ code: string; timestamp: string; close: number | null }> } | null;
    intradayLoading?: boolean;
    intradayDelayed?: boolean;
    intradayError?: string | null;
    chartMode?: 'daily' | 'intraday';
    intradayInterval?: '1m' | '5m';
  }) => (
    <section data-testid="chart">
      身份 {stockCode}:{stockName};快照错误:{realtimeError};分钟错误:{intradayError};
      快照项 {realtimeData?.items.map((item) => `${item.code}:${item.price}`).join('|')}
      :{String(realtimeLoading)}:{String(realtimeDelayed)};
      分钟项 {intradayData?.items.map((item) => `${item.timestamp}:${item.close}`).join('|')}
      :{String(intradayLoading)}:{String(intradayDelayed)};模式:{chartMode};周期:{intradayInterval}
    </section>
  ),
}));

vi.mock('./DecisionPanel', () => ({
  DecisionPanel: (props: Record<string, unknown>) => (
    <aside data-testid="decision-panel">
      {Object.keys(props).filter((key) => /realtime|intraday/i.test(key)).join('|') || '日线快照'}
    </aside>
  ),
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
  vi.useRealTimers();
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setSearchValue(host: HTMLElement, value: string): void {
  const input = host.querySelector('input');
  if (!input) throw new Error('Missing stock search input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('DecisionWorkspace realtime stock coordination', () => {
  it('separates selected snapshots and intraday bars for the chart while exposing batch gaps to the navigator', async () => {
    vi.useFakeTimers();
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
      items: [{
        code: '600519', name: '贵州茅台', market: 'SH', price: 1348.86,
        sourceTime: '2026-08-10T09:31:00+08:00', receivedAt: '2026-08-10T09:31:01+08:00',
        volume: 1000, amount: 1348860, provider: 'TENCENT',
      }],
      missingCodes: ['000001'],
    }));
    quoteMocks.useRealtimeStock.mockImplementation((code: string) => pollingState({
      tradingDate: '2026-08-10',
      marketStatus: 'open',
      items: code === '600519' ? [{
        code: '600519', name: '贵州茅台', market: 'SH', price: 1348.86,
        sourceTime: '2026-08-10T09:31:00+08:00', receivedAt: '2026-08-10T09:31:01+08:00',
        volume: 1000, amount: 1348860, provider: 'TENCENT',
      }] : [],
      missingCodes: code === '000001' ? ['000001'] : [],
    }));
    quoteMocks.useStockIntraday.mockImplementation((options: { code: string }) => pollingState({
      tradingDate: '2026-08-10',
      interval: '1m',
      count: options.code === '600519' ? 2 : 0,
      items: options.code === '600519' ? [{
        code: '600519', interval: '1m', timestamp: '2026-08-10T09:30:00+08:00', open: 1347,
        high: 1348, low: 1346.5, close: 1347.52, volume: 800,
        amount: 1_078_016, provider: 'TENCENT',
      }, {
        code: '600519', interval: '1m', timestamp: '2026-08-10T09:31:00+08:00', open: 1347.52,
        high: 1349.2, low: 1347.5, close: 1348.86, volume: 1000,
        amount: 1_348_860, provider: 'TENCENT',
      }] : [],
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root?.render(<DecisionWorkspace preferredTradeDate="2026-08-10" />));
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => await Promise.resolve());

    expect(quoteMocks.useRealtimeStocks).toHaveBeenLastCalledWith(['600519', '000001']);
    expect(host.textContent).toContain('600519:1348.86:1.2');
    expect(host.textContent).toContain('000001:12:-0.4');
    expect(host.textContent).toContain('missing:000001;delayed:false;realtimeError:null');
    expect(host.textContent).toContain('快照项 600519:1348.86:false:false');
    expect(host.textContent).toContain('分钟项 2026-08-10T09:30:00+08:00:1347.52|2026-08-10T09:31:00+08:00:1348.86:false:false');
    expect(host.textContent).toContain('模式:daily;周期:1m');
    expect(host.textContent).toContain('日线快照');

    const select = [...host.querySelectorAll('button')].find(
      (item) => item.textContent?.includes('选择平安银行'),
    );
    if (!select) throw new Error('Missing stock selection button');
    await act(async () => select.click());
    await act(async () => await Promise.resolve());

    expect(quoteMocks.useRealtimeStock).toHaveBeenLastCalledWith('000001');
    expect(quoteMocks.useStockIntraday).toHaveBeenLastCalledWith(expect.objectContaining({
      code: '000001',
      tradeDate: '2026-08-10',
      interval: '1m',
      enabled: false,
      marketStatus: 'open',
    }));
    expect(host.textContent).toContain('分钟项 :false:false');
  });

  it('keeps a successful list and selection visible while the next query is pending', async () => {
    vi.useFakeTimers();
    const replacement = deferred<Array<{ code: string; name: string; tradeDate: string; close: number; changePercent: number; amount: number }>>();
    apiMocks.getStockList
      .mockResolvedValueOnce([{
        code: '000001', name: '平安银行', tradeDate: '2026-08-10',
        close: 12, changePercent: 1.1, amount: 10,
      }])
      .mockReturnValueOnce(replacement.promise);
    apiMocks.getStockDetail.mockResolvedValue(null);
    quoteMocks.useRealtimeStocks.mockReturnValue(pollingState(null));
    quoteMocks.useRealtimeStock.mockReturnValue(pollingState(null));
    quoteMocks.useStockIntraday.mockReturnValue(pollingState(null));
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => root?.render(<DecisionWorkspace preferredTradeDate="2026-08-10" />));
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => await Promise.resolve());
    await act(async () => setSearchValue(host, '平安'));
    await act(async () => vi.advanceTimersByTime(180));

    expect(host.textContent).toContain('000001:12:1.1');
    expect(host.textContent).toContain('selected:000001');
    expect(host.textContent).toContain('loading:true');
  });

  it('passes selected list identity and realtime error while daily detail is independently pending', async () => {
    vi.useFakeTimers();
    apiMocks.getStockList.mockResolvedValue([{
      code: '300308', name: '中际旭创', tradeDate: '2026-08-11',
      close: 880, changePercent: 2.34, amount: 20,
    }]);
    apiMocks.getStockDetail.mockReturnValue(new Promise(() => undefined));
    quoteMocks.useRealtimeStocks.mockReturnValue(pollingState(null));
    quoteMocks.useRealtimeStock.mockReturnValue({
      ...pollingState(null),
      delayed: true,
      error: '实时服务暂不可用',
    });
    quoteMocks.useStockIntraday.mockReturnValue(pollingState(null));
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => root?.render(<DecisionWorkspace preferredTradeDate="2026-08-11" />));
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => await Promise.resolve());

    expect(host.textContent).toContain('身份 300308:中际旭创;快照错误:实时服务暂不可用');
  });

  it('aborts the previous list request and sends one trimmed query after 180ms', async () => {
    vi.useFakeTimers();
    const initial = deferred<never[]>();
    const replacement = deferred<never[]>();
    apiMocks.getStockList.mockReturnValueOnce(initial.promise).mockReturnValueOnce(replacement.promise);
    quoteMocks.useRealtimeStocks.mockReturnValue(pollingState(null));
    quoteMocks.useRealtimeStock.mockReturnValue(pollingState(null));
    quoteMocks.useStockIntraday.mockReturnValue(pollingState(null));
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => root?.render(<DecisionWorkspace preferredTradeDate="2026-08-10" />));
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => setSearchValue(host, ' 平安 '));

    const firstSignal = apiMocks.getStockList.mock.calls[0]?.[2] as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(apiMocks.getStockList).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(179));
    expect(apiMocks.getStockList).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(1));

    expect(apiMocks.getStockList).toHaveBeenLastCalledWith(
      '2026-08-10',
      '平安',
      expect.any(AbortSignal),
    );
  });

  it('does not repeat a request when only trailing whitespace changes', async () => {
    vi.useFakeTimers();
    apiMocks.getStockList.mockResolvedValue([]);
    quoteMocks.useRealtimeStocks.mockReturnValue(pollingState(null));
    quoteMocks.useRealtimeStock.mockReturnValue(pollingState(null));
    quoteMocks.useStockIntraday.mockReturnValue(pollingState(null));
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => root?.render(<DecisionWorkspace preferredTradeDate="2026-08-10" />));
    await act(async () => setSearchValue(host, '平安 '));
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => await Promise.resolve());
    await act(async () => setSearchValue(host, '平安   '));
    await act(async () => vi.advanceTimersByTime(180));

    expect(apiMocks.getStockList).toHaveBeenCalledTimes(1);
    expect(apiMocks.getStockList).toHaveBeenCalledWith(
      '2026-08-10',
      '平安',
      expect.any(AbortSignal),
    );
  });

  it('retains the last successful list and selection after a non-abort failure', async () => {
    vi.useFakeTimers();
    apiMocks.getStockList
      .mockResolvedValueOnce([{
        code: '000001', name: '平安银行', tradeDate: '2026-08-10',
        close: 12, changePercent: 1.1, amount: 10,
      }])
      .mockRejectedValueOnce(new Error('网络异常'));
    apiMocks.getStockDetail.mockResolvedValue(null);
    quoteMocks.useRealtimeStocks.mockReturnValue(pollingState(null));
    quoteMocks.useRealtimeStock.mockReturnValue(pollingState(null));
    quoteMocks.useStockIntraday.mockReturnValue(pollingState(null));
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => root?.render(<DecisionWorkspace preferredTradeDate="2026-08-10" />));
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => await Promise.resolve());
    await act(async () => setSearchValue(host, '平安'));
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => await Promise.resolve());

    expect(host.textContent).toContain('000001:12:1.1');
    expect(host.textContent).toContain('selected:000001');
    expect(host.textContent).toContain('error:网络异常');
  });

  it('does not show an error or clear retained results for an AbortError rejection', async () => {
    vi.useFakeTimers();
    const abortError = new DOMException('request cancelled', 'AbortError');
    apiMocks.getStockList
      .mockResolvedValueOnce([{
        code: '000001', name: '平安银行', tradeDate: '2026-08-10',
        close: 12, changePercent: 1.1, amount: 10,
      }])
      .mockRejectedValueOnce(abortError);
    apiMocks.getStockDetail.mockResolvedValue(null);
    quoteMocks.useRealtimeStocks.mockReturnValue(pollingState(null));
    quoteMocks.useRealtimeStock.mockReturnValue(pollingState(null));
    quoteMocks.useStockIntraday.mockReturnValue(pollingState(null));
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => root?.render(<DecisionWorkspace preferredTradeDate="2026-08-10" />));
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => await Promise.resolve());
    await act(async () => setSearchValue(host, '平安'));
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => await Promise.resolve());

    expect(host.textContent).toContain('000001:12:1.1');
    expect(host.textContent).toContain('selected:000001');
    expect(host.textContent).toContain('error:null');
  });
});

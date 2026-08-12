// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  StockIntradayBar,
  StockIntradayResponse,
  StockRealtimeQuote,
  StockRealtimeResponse,
  SectorStock,
} from '../../lib/api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const chartHarness = vi.hoisted(() => {
  const candlestickSeries = Symbol('CandlestickSeries');
  const histogramSeries = Symbol('HistogramSeries');
  const lineSeries = Symbol('LineSeries');
  const remove = vi.fn();
  const removeSeries = vi.fn();
  const series: Array<{
    definition: symbol;
    setData: ReturnType<typeof vi.fn>;
    applyOptions: ReturnType<typeof vi.fn>;
    moveToPane: ReturnType<typeof vi.fn>;
  }> = [];
  const charts: Array<{
    addSeries: ReturnType<typeof vi.fn>;
    subscribeCrosshairMove: ReturnType<typeof vi.fn>;
  }> = [];
  const panes = Array.from({ length: 8 }, () => ({
    setHeight: vi.fn(),
    setStretchFactor: vi.fn(),
  }));
  let crosshairMove: ((param: unknown) => void) | null = null;
  let visibleRange = { from: 70, to: 100 };
  const timeScale = {
    getVisibleLogicalRange: vi.fn(() => visibleRange),
    setVisibleLogicalRange: vi.fn((range: { from: number; to: number }) => {
      visibleRange = range;
    }),
    fitContent: vi.fn(),
  };
  const createChart = vi.fn(() => {
    const chart = {
      addSeries: vi.fn((definition: symbol) => {
        const api = {
          definition,
          setData: vi.fn(),
          applyOptions: vi.fn(),
          createPriceLine: vi.fn(),
          moveToPane: vi.fn(),
        };
        series.push(api);
        return api;
      }),
      removeSeries,
      panes: vi.fn(() => panes),
      subscribeCrosshairMove: vi.fn((handler) => { crosshairMove = handler; }),
      unsubscribeCrosshairMove: vi.fn(),
      timeScale: vi.fn(() => timeScale),
      remove,
    };
    charts.push(chart);
    return chart;
  });
  return {
    candlestickSeries,
    histogramSeries,
    lineSeries,
    charts,
    createChart,
    timeScale,
    remove,
    removeSeries,
    panes,
    series,
    getCrosshairMove: () => crosshairMove,
    getVisibleRange: () => visibleRange,
    setVisibleRange: (range: { from: number; to: number }) => { visibleRange = range; },
    reset: () => {
      charts.length = 0;
      series.length = 0;
      crosshairMove = null;
      visibleRange = { from: 70, to: 100 };
      removeSeries.mockClear();
      panes.forEach((pane) => {
        pane.setHeight.mockClear();
        pane.setStretchFactor.mockClear();
      });
      timeScale.getVisibleLogicalRange.mockClear();
      timeScale.setVisibleLogicalRange.mockClear();
      timeScale.fitContent.mockClear();
    },
  };
});

vi.mock('lightweight-charts', () => ({
  CandlestickSeries: chartHarness.candlestickSeries,
  ColorType: { Solid: 'Solid' },
  createChart: chartHarness.createChart,
  CrosshairMode: { Normal: 0 },
  HistogramSeries: chartHarness.histogramSeries,
  LineSeries: chartHarness.lineSeries,
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
}));

import { ProfessionalCandlestickChart } from './ProfessionalCandlestickChart';

const stock: SectorStock = {
  code: '600000',
  name: '浦发银行',
  tradeDate: '2026-08-08',
  open: 10,
  high: 11,
  low: 9.8,
  close: 10.8,
  changeAmount: 0.8,
  changePercent: 8,
  amplitudePercent: 12,
  amount: 100_000_000,
  volume: 9_000_000,
  turnoverPercent: 1.2,
  ma: { ma5: 10.4, ma10: 10.2, ma20: 10, ma30: null, ma60: null },
  volumeMa: { volMa5: 8_500_000, volMa10: null, volMa20: null, volMa60: null },
  macd: { dif: 0.3, dea: 0.2, hist: 0.2 },
  boll: null,
  kdj: { k: 62, d: 58, j: 70 },
  rsi: null,
  cci: null,
  wr: null,
  atr: null,
  chip: null,
  kline: [{
    date: '2026-08-07',
    open: 9.8,
    high: 10.4,
    low: 9.5,
    close: 10,
    amount: 80_000_000,
    volume: 7_000_000,
    ma: { ma5: 10.1, ma10: null, ma20: null, ma30: 9.9, ma60: null },
    macd: { dif: 0.1, dea: 0.08, hist: 0.04 },
    kdj: { k: 60, d: 55, j: 70 },
  }, {
    date: '2026-08-08',
    open: 10,
    high: 11,
    low: 9.8,
    close: 10.8,
    amount: 100_000_000,
    volume: 9_000_000,
    ma: { ma5: 10.4, ma10: null, ma20: null, ma30: 10, ma60: null },
    macd: { dif: 0.3, dea: 0.2, hist: 0.2 },
    kdj: { k: 62, d: 58, j: 70 },
  }],
};

const navigationStock: SectorStock = {
  ...stock,
  kline: Array.from({ length: 40 }, (_, index) => ({
    ...stock.kline[1],
    date: index < 28
      ? `2026-06-${String(index + 1).padStart(2, '0')}`
      : `2026-07-${String(index - 27).padStart(2, '0')}`,
  })),
};

const nextNavigationStock: SectorStock = {
  ...navigationStock,
  code: '002384',
  name: '东山精密',
};

const realtimeQuote: StockRealtimeQuote = {
  code: '600000',
  name: '浦发银行',
  market: 'SH',
  price: 11.23,
  sourceTime: '2026-08-10T01:33:00Z',
  receivedAt: '2026-08-10T01:33:01Z',
  volume: 1000,
  amount: 11230,
  provider: 'TENCENT',
};

const realtimeResponse: StockRealtimeResponse = {
  tradingDate: '2026-08-10',
  marketStatus: 'open',
  items: [realtimeQuote],
  missingCodes: [],
};

const earlierIntradayBar: StockIntradayBar = {
  code: '600000',
  name: '浦发银行',
  market: 'SH',
  tradeDate: '2026-08-10',
  interval: '1m',
  timestamp: '2026-08-10T01:31:00Z',
  open: 10.7,
  high: 10.84,
  low: 10.68,
  close: 10.8,
  volume: 1_000,
  amount: 10_800,
  provider: 'TENCENT',
};

const latestIntradayBar: StockIntradayBar = {
  ...earlierIntradayBar,
  timestamp: '2026-08-10T01:32:00Z',
  open: 10.8,
  high: 10.95,
  low: 10.78,
  close: 10.92,
  volume: null,
};

const intradayResponse: StockIntradayResponse = {
  code: '600000',
  name: '浦发银行',
  tradeDate: '2026-08-10',
  interval: '1m',
  count: 2,
  items: [latestIntradayBar, earlierIntradayBar],
};

afterEach(() => {
  document.body.innerHTML = '';
  chartHarness.createChart.mockClear();
  chartHarness.remove.mockClear();
  chartHarness.reset();
});

describe('ProfessionalCandlestickChart interactions', () => {
  it('renders a real intraday aggregate as the temporary latest daily candle', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeData={realtimeResponse}
        intradayData={intradayResponse}
        intradayInterval="60m"
      />,
    ));

    const chart = chartHarness.charts[0];
    const candleSeries = chart.addSeries.mock.results[0]?.value;
    expect(candleSeries.setData).toHaveBeenLastCalledWith([
      expect.objectContaining({ time: '2026-08-07', close: 10 }),
      expect.objectContaining({ time: '2026-08-08', close: 10.8 }),
      {
        time: '2026-08-10',
        open: 10.7,
        high: 10.95,
        low: 10.68,
        close: 10.92,
      },
    ]);
    expect(host.querySelector('.trade-date-chip')?.textContent).toContain('2026-08-10');
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('实时涨跌 +3.98%');
    expect(host.querySelector('.stock-live-state')?.textContent).toContain('盘中临时日 K');
    expect(host.querySelector('.ohlc-legend')?.textContent).toContain('2026-08-10');
    expect(host.querySelector('.ohlc-legend')?.textContent).toContain('开 10.70');
    expect(host.querySelector('.ohlc-legend')?.textContent).toContain('收 10.92');

    await act(async () => root.unmount());
  });

  it('keeps official daily candles unchanged when only a realtime price is available', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart stock={stock} realtimeData={realtimeResponse} />,
    ));

    const chart = chartHarness.charts[0];
    const candleSeries = chart.addSeries.mock.results[0]?.value;
    expect(candleSeries.setData).toHaveBeenLastCalledWith([
      expect.objectContaining({ time: '2026-08-07', close: 10 }),
      expect.objectContaining({ time: '2026-08-08', close: 10.8 }),
    ]);
    expect(host.querySelector('.trade-date-chip')?.textContent).toContain('2026-08-10');
    expect(host.querySelector('.stock-live-state')?.textContent).not.toContain('盘中临时日 K');

    await act(async () => root.unmount());
  });

  it('does not let an older realtime snapshot override a newer official daily close', async () => {
    const officialToday: SectorStock = {
      ...stock,
      tradeDate: '2026-08-12',
      close: 12,
      changeAmount: 1.2,
      changePercent: 11.11,
      kline: [...stock.kline, {
        date: '2026-08-12', open: 11, high: 12.2, low: 10.9, close: 12,
      }],
    };
    const staleRealtime: StockRealtimeResponse = {
      ...realtimeResponse,
      tradingDate: '2026-08-11',
      items: [{ ...realtimeQuote, price: 11.23 }],
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart stock={officialToday} realtimeData={staleRealtime} />,
    ));

    expect(host.querySelector('.trade-date-chip')?.textContent).toContain('2026-08-12');
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('12.00');
    expect(host.querySelector('.stock-price-row')?.textContent).not.toContain('11.23');
    expect(host.querySelector('.stock-price-row')?.textContent).not.toContain('实时价');

    await act(async () => root.unmount());
  });

  it('uses realtime price only at the latest daily position and historical close under crosshair', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart stock={stock} realtimeData={realtimeResponse} />,
    ));

    const dailyButton = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '日线');
    expect(dailyButton?.className).toContain('is-active');
    expect(dailyButton?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('11.23');
    expect(host.querySelector('.stock-price-row > span')?.className).toBe('market-rise');
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('实时价');
    expect(host.textContent).toContain('实时涨跌 +3.98%');

    const move = chartHarness.getCrosshairMove();
    if (!move) throw new Error('Crosshair handler was not registered');
    await act(async () => move({ time: '2026-08-07', seriesData: new Map() }));
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('10.00');
    expect(host.querySelector('.stock-price-row')?.textContent).not.toContain('11.23');
    expect(host.querySelector('.stock-price-row')?.textContent).not.toContain('实时价');
    expect(host.querySelector('.ohlc-legend')?.textContent).toContain('收 10.00');

    await act(async () => move({ time: undefined, seriesData: new Map() }));
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('11.23');

    await act(async () => root.unmount());
  });

  it('does not render stale daily data under a newly selected stock identity', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        stockCode="002384"
        stockName="东山精密"
      />,
    ));

    expect(host.querySelector('.stock-identity')?.textContent).toContain('东山精密002384');
    expect(host.querySelector('.stock-price-row')?.textContent).not.toContain('10.80');
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('--');
    expect(host.querySelector('.ohlc-legend')?.textContent).not.toContain('2026-08-08');
    expect(host.querySelector('.indicator-legend-board')?.textContent).not.toContain('10.40');
    expect(host.querySelector('.stock-live-state')?.textContent).toContain('暂无日线行情');
    expect(host.querySelector('.chart-canvas-shell')?.textContent)
      .toContain('请选择包含有效日 K 数据的股票');
    expect(chartHarness.createChart).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('hides matching daily data while its detail request is loading', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        stockCode="600000"
        stockName="浦发银行"
        loading
      />,
    ));

    expect(host.querySelector('.stock-price-row')?.textContent).not.toContain('10.80');
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('--');
    expect(host.querySelector('.ohlc-legend')?.textContent).not.toContain('2026-08-08');
    expect(host.querySelector('.indicator-legend-board')?.textContent).not.toContain('10.40');
    expect(host.querySelector('.stock-live-state')?.textContent).toContain('日线行情加载中');
    expect(host.querySelector('.chart-canvas-shell')?.textContent).toContain('正在加载个股行情');

    await act(async () => root.unmount());
  });

  it('keeps chart mode and all six intraday interval controls externally controlled', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onChartModeChange = vi.fn();
    const onIntradayIntervalChange = vi.fn();

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        chartMode="daily"
        onChartModeChange={onChartModeChange}
        intradayInterval="1m"
        onIntradayIntervalChange={onIntradayIntervalChange}
      />,
    ));

    const minuteButton = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '分钟线');
    if (!minuteButton) throw new Error('Missing minute mode button');
    await act(async () => minuteButton.click());
    expect(onChartModeChange).toHaveBeenCalledWith('intraday');
    expect(minuteButton.className).not.toContain('is-active');

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        chartMode="intraday"
        onChartModeChange={onChartModeChange}
        intradayInterval="1m"
        onIntradayIntervalChange={onIntradayIntervalChange}
      />,
    ));

    const intervalButtons = [...host.querySelectorAll<HTMLButtonElement>('.intraday-intervals button')];
    expect(intervalButtons.map((button) => [button.value, button.textContent])).toEqual([
      ['1m', '1分'],
      ['5m', '5分'],
      ['15m', '15分'],
      ['30m', '30分'],
      ['60m', '60分'],
      ['120m', '120分'],
    ]);
    expect(intervalButtons[0].className).toContain('is-active');
    await act(async () => intervalButtons[4].click());
    expect(onIntradayIntervalChange).toHaveBeenCalledWith('60m');

    await act(async () => root.unmount());
  });

  it('renders only selected timestamp-based intraday bars in chronological order', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onActiveDateChange = vi.fn();
    const wrongCodeBar: StockIntradayBar = {
      ...latestIntradayBar,
      code: '000001',
      timestamp: '2026-08-10T01:33:00Z',
      close: 99,
    };

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeData={realtimeResponse}
        intradayData={{ ...intradayResponse, count: 3, items: [wrongCodeBar, latestIntradayBar, earlierIntradayBar] }}
        chartMode="intraday"
        intradayInterval="1m"
        onActiveDateChange={onActiveDateChange}
      />,
    ));

    expect(host.querySelector('.stock-price-row')?.textContent).toContain('11.23');
    expect(host.querySelector('.stock-price-row')?.textContent).not.toContain('10.92');
    expect(host.querySelector('.stock-price-row > span')?.className).toBe('market-flat');
    expect(host.textContent).toContain('分钟线 1m 09:32:00');
    expect(host.textContent).not.toContain('日线涨跌');

    const minuteChart = chartHarness.charts[0];
    expect(minuteChart.addSeries.mock.calls.map((call) => call[0])).toEqual([
      chartHarness.candlestickSeries,
      chartHarness.histogramSeries,
    ]);
    const candleSeries = minuteChart.addSeries.mock.results[0]?.value;
    const volumeSeries = minuteChart.addSeries.mock.results[1]?.value;
    expect(candleSeries.setData).toHaveBeenLastCalledWith([
      { time: 1_786_325_460, open: 10.7, high: 10.84, low: 10.68, close: 10.8 },
      { time: 1_786_325_520, open: 10.8, high: 10.95, low: 10.78, close: 10.92 },
    ]);
    expect(volumeSeries.setData).toHaveBeenLastCalledWith([
      { time: 1_786_325_460, value: 1_000, color: expect.any(String) },
    ]);
    expect(minuteChart.subscribeCrosshairMove).not.toHaveBeenCalled();
    expect(onActiveDateChange).not.toHaveBeenCalledWith('2026-08-10T01:32:00Z');

    await act(async () => root.unmount());
  });

  it('shows intraday loading, empty, error, delayed, and closed states without dropping bars', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const render = async ({
      realtimeData = realtimeResponse,
      intradayData = null,
      intradayLoading = false,
      intradayDelayed = false,
      intradayError = null,
    }: {
      realtimeData?: StockRealtimeResponse | null;
      intradayData?: StockIntradayResponse | null;
      intradayLoading?: boolean;
      intradayDelayed?: boolean;
      intradayError?: string | null;
    }) => act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeData={realtimeData}
        intradayData={intradayData}
        intradayLoading={intradayLoading}
        intradayDelayed={intradayDelayed}
        intradayError={intradayError}
        chartMode="intraday"
        intradayInterval="1m"
      />,
    ));

    await render({ realtimeData: null, intradayLoading: true });
    expect(host.textContent).toContain('分钟行情加载中');

    await render({ realtimeData: null, intradayError: '分钟服务暂不可用' });
    expect(host.textContent).toContain('分钟行情暂不可用');

    await render({ intradayData: { ...intradayResponse, count: 0, items: [] } });
    expect(host.textContent).toContain('暂无当日分钟行情');

    const oneBarResponse = { ...intradayResponse, count: 1, items: [earlierIntradayBar] };
    await render({ intradayData: oneBarResponse, intradayDelayed: true });
    expect(host.textContent).toContain('数据可能延迟');
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('11.23');

    await render({
      realtimeData: { ...realtimeResponse, marketStatus: 'closed' },
      intradayData: oneBarResponse,
    });
    expect(host.textContent).toContain('已闭市 · 最后行情');
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('11.23');

    await act(async () => root.unmount());
  });

  it('surfaces delayed state for retained empty intraday results and stale realtime', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const emptyIntraday = { ...intradayResponse, count: 0, items: [] };

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeData={realtimeResponse}
        intradayData={emptyIntraday}
        intradayDelayed
        intradayError="刷新失败"
        chartMode="intraday"
        intradayInterval="1m"
      />,
    ));
    expect(host.querySelector('.stock-live-state')?.textContent).toContain('数据可能延迟');
    expect(host.querySelector('.stock-live-state')?.className).toContain('is-delayed');

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeData={{ ...realtimeResponse, marketStatus: 'stale' }}
        intradayData={emptyIntraday}
        chartMode="intraday"
        intradayInterval="1m"
      />,
    ));
    expect(host.querySelector('.stock-live-state')?.textContent).toContain('数据可能延迟');
    expect(host.querySelector('.stock-live-state')?.className).toContain('is-delayed');

    await act(async () => root.unmount());
  });

  it('prioritizes stale realtime over intraday loading when no minute bar exists', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeData={{ ...realtimeResponse, marketStatus: 'stale' }}
        intradayData={{ ...intradayResponse, count: 0, items: [] }}
        intradayLoading
        chartMode="intraday"
        intradayInterval="1m"
      />,
    ));

    const state = host.querySelector('.stock-live-state');
    expect(state?.textContent).toContain('数据可能延迟');
    expect(state?.textContent).not.toContain('分钟行情加载中');
    expect(state?.className).toContain('is-delayed');

    await act(async () => root.unmount());
  });

  it('uses a neutral tone for realtime-only price without a matching daily direction', async () => {
    const snapshot: StockRealtimeQuote = {
      ...realtimeQuote,
      code: '300308',
      name: '中际旭创',
      price: 887.98,
      sourceTime: '2026-08-11T12:05:15+08:00',
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={null}
        stockCode="300308"
        stockName="中际旭创"
        realtimeData={{ ...realtimeResponse, tradingDate: '2026-08-11', items: [snapshot] }}
      />,
    ));

    const price = host.querySelector('.stock-price-row > span');
    expect(price?.textContent).toBe('887.98');
    expect(price?.className).toBe('market-flat');

    await act(async () => root.unmount());
  });

  it('keeps an intraday realtime fallback neutral when no minute bar is available', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeData={realtimeResponse}
        intradayData={{ ...intradayResponse, count: 0, items: [] }}
        chartMode="intraday"
        intradayInterval="1m"
      />,
    ));

    const price = host.querySelector('.stock-price-row > span');
    expect(price?.textContent).toBe('11.23');
    expect(price?.className).toBe('market-flat');
    expect(host.textContent).not.toContain('日线涨跌');

    await act(async () => root.unmount());
  });

  it('replaces same-session intraday bars without creating another chart', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeData={realtimeResponse}
        intradayData={intradayResponse}
        chartMode="intraday"
        intradayInterval="1m"
      />,
    ));
    const minuteChart = chartHarness.charts[0];
    const candleSeries = minuteChart.addSeries.mock.results[0]?.value;
    expect(chartHarness.createChart).toHaveBeenCalledTimes(1);
    expect(chartHarness.timeScale.fitContent).toHaveBeenCalledTimes(1);

    const nextBar: StockIntradayBar = {
      ...latestIntradayBar,
      timestamp: '2026-08-10T01:33:00Z',
      open: 10.92,
      high: 11,
      low: 10.9,
      close: 10.98,
      volume: 2_000,
    };
    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeData={realtimeResponse}
        intradayData={{
          ...intradayResponse,
          count: 3,
          items: [nextBar, latestIntradayBar, earlierIntradayBar],
        }}
        chartMode="intraday"
        intradayInterval="1m"
      />,
    ));

    expect(chartHarness.createChart).toHaveBeenCalledTimes(1);
    expect(chartHarness.timeScale.fitContent).toHaveBeenCalledTimes(1);
    expect(candleSeries.setData).toHaveBeenLastCalledWith([
      expect.objectContaining({ time: 1_786_325_460 }),
      expect.objectContaining({ time: 1_786_325_520 }),
      expect.objectContaining({ time: 1_786_325_580, close: 10.98 }),
    ]);

    await act(async () => root.unmount());
  });

  it('resets a manually navigated daily chart to the latest 60 trading days when switching stocks', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<ProfessionalCandlestickChart stock={navigationStock} />);
    });

    chartHarness.setVisibleRange({ from: 10, to: 30 });
    const zoomIn = host.querySelector<HTMLButtonElement>('button[aria-label="放大K线"]');
    if (!zoomIn) throw new Error('Missing zoom-in control');
    await act(async () => zoomIn.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    await act(async () => {
      root.render(<ProfessionalCandlestickChart stock={nextNavigationStock} />);
    });

    expect(chartHarness.createChart).toHaveBeenCalledTimes(2);
    expect(chartHarness.getVisibleRange()).toEqual({ from: 0, to: 40.5 });
    const dailyButton = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '日线');
    expect(dailyButton?.className).toContain('is-active');

    await act(async () => root.unmount());
  });

  it('formats the crosshair trading date as an unambiguous ISO date', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<ProfessionalCandlestickChart stock={stock} />);
    });

    const chartOptions = (chartHarness.createChart.mock.calls[0] as unknown as [
      HTMLElement,
      { localization: { locale: string; dateFormat: string } },
    ] | undefined)?.[1];
    if (!chartOptions) throw new Error('Missing chart options');
    expect(chartOptions.localization).toEqual({
      locale: 'zh-CN',
      dateFormat: 'yyyy-MM-dd',
    });

    await act(async () => root.unmount());
  });

  it('keeps auxiliary series labels off the right edge while preserving the main price label', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<ProfessionalCandlestickChart stock={stock} />);
    });

    const chart = chartHarness.createChart.mock.results[0]?.value;
    const addSeriesCalls = chart?.addSeries.mock.calls ?? [];
    const mainSeriesOptions = addSeriesCalls[0]?.[1];
    const auxiliarySeriesOptions = addSeriesCalls
      .filter((call) => typeof call[2] === 'number' && call[2] > 0)
      .map((call) => call[1]);

    expect(mainSeriesOptions).toMatchObject({ lastValueVisible: true });
    expect(auxiliarySeriesOptions.length).toBeGreaterThan(0);
    expect(auxiliarySeriesOptions.every((options) => !options.title)).toBe(true);

    await act(async () => root.unmount());
  });

  it('leaves the mouse wheel to page scrolling and exposes explicit main-chart navigation', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<ProfessionalCandlestickChart stock={navigationStock} />);
    });

    const chartOptions = (chartHarness.createChart.mock.calls[0] as unknown as [
      HTMLElement,
      {
        handleScale: { mouseWheel: boolean };
        handleScroll: { mouseWheel: boolean; vertTouchDrag: boolean };
      },
    ] | undefined)?.[1];
    if (!chartOptions) throw new Error('Missing chart options');
    expect(chartOptions.handleScale).toMatchObject({ mouseWheel: false });
    expect(chartOptions.handleScroll).toMatchObject({ mouseWheel: false, vertTouchDrag: false });
    expect(host.querySelector('.chart-fixed-header')).not.toBeNull();
    expect(host.querySelectorAll('.chart-navigation-controls button')).toHaveLength(4);
    expect(chartHarness.panes[0].setStretchFactor).toHaveBeenCalledWith(2.8);
    expect(chartHarness.panes[1].setStretchFactor).toHaveBeenCalledWith(1);
    expect(chartHarness.panes[2].setStretchFactor).toHaveBeenCalledWith(1);

    const click = async (label: string) => {
      const control = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      if (!control) throw new Error(`Missing control: ${label}`);
      await act(async () => control.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };

    chartHarness.setVisibleRange({ from: 10, to: 30 });
    await click('查看更早K线');
    expect(chartHarness.getVisibleRange()).toEqual({ from: 6, to: 26 });
    await click('放大K线');
    expect(chartHarness.getVisibleRange()).toEqual({ from: 8, to: 24 });

    await act(async () => root.unmount());
  });

  it('shows only available lines and keeps multiple auxiliary panes active without rebuilding', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<ProfessionalCandlestickChart stock={stock} />);
    });

    const button = (label: string) => {
      const match = [...host.querySelectorAll('button')]
        .find((item) => item.textContent?.trim() === label);
      if (!match) throw new Error(`Missing button: ${label}`);
      return match;
    };

    await act(async () => {
      button('KDJ').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(button('成交量').className).toContain('is-active');
    expect(button('MACD').className).toContain('is-active');
    expect(button('KDJ').className).toContain('is-active');
    expect(host.textContent).not.toContain('BOLL');
    expect(host.textContent).not.toContain('RSI');
    expect(host.textContent).not.toContain('CCI');
    expect(host.textContent).not.toContain('WR');
    expect(host.textContent).toContain('MA5');
    expect(host.textContent).toContain('MA30');
    expect(host.textContent).not.toContain('MA10');
    expect(chartHarness.createChart).toHaveBeenCalledTimes(1);
    expect(chartHarness.remove).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    expect(chartHarness.remove).toHaveBeenCalledTimes(1);
  });

  it('reports the exact bar date under the crosshair and clears it on exit', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onActiveDateChange = vi.fn();

    await act(async () => {
      root.render(
        <ProfessionalCandlestickChart
          stock={stock}
          onActiveDateChange={onActiveDateChange}
        />,
      );
    });

    const move = chartHarness.getCrosshairMove();
    if (!move) throw new Error('Crosshair handler was not registered');
    await act(async () => {
      move({
        time: '2026-08-07',
        seriesData: new Map([[chartHarness.series[0], {
          open: 9.8, high: 10.4, low: 9.5, close: 10,
        }]]),
      });
    });
    expect(onActiveDateChange).toHaveBeenLastCalledWith('2026-08-07');

    await act(async () => {
      move({ time: undefined, seriesData: new Map() });
    });
    expect(onActiveDateChange).toHaveBeenLastCalledWith(null);

    await act(async () => root.unmount());
  });
});

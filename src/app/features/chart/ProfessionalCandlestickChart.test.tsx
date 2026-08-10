// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  RealtimeStockQuote,
  RealtimeStocksResponse,
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

const realtimeQuote: RealtimeStockQuote = {
  code: '600000',
  name: '浦发银行',
  market: 'SH',
  tradeDate: '2026-08-10',
  interval: '1m',
  timestamp: '2026-08-10T01:31:00Z',
  open: 10.7,
  high: 10.9,
  low: 10.65,
  close: 10.88,
  volume: 1000,
  amount: 10880,
  provider: 'TENCENT',
};

const earlierIntradayQuote: RealtimeStockQuote = {
  ...realtimeQuote,
  timestamp: '2026-08-10T01:31:00Z',
  open: 10.7,
  high: 10.84,
  low: 10.68,
  close: 10.8,
  volume: 1_000,
};

const latestIntradayQuote: RealtimeStockQuote = {
  ...realtimeQuote,
  timestamp: '2026-08-10T01:32:00Z',
  open: 10.8,
  high: 10.95,
  low: 10.78,
  close: 10.92,
  volume: null,
};

const intradayResponse: RealtimeStocksResponse = {
  tradingDate: '2026-08-10',
  marketStatus: 'open',
  interval: '1m',
  items: [latestIntradayQuote, earlierIntradayQuote],
  missingCodes: [],
};

afterEach(() => {
  document.body.innerHTML = '';
  chartHarness.createChart.mockClear();
  chartHarness.remove.mockClear();
  chartHarness.reset();
});

describe('ProfessionalCandlestickChart interactions', () => {
  it('defaults to daily mode without legacy range controls or realtime price overwrite', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        realtimeQuote={realtimeQuote}
        realtimeMarketStatus="open"
      />,
    ));

    const dailyButton = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '日线');
    expect(dailyButton?.className).toContain('is-active');
    expect(dailyButton?.getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).not.toContain('近10日');
    expect(host.textContent).not.toContain('近20日');
    expect(host.textContent).not.toContain('近30日');
    expect(host.textContent).not.toContain('近60日');
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('10.80');
    expect(host.textContent).not.toContain('实时 1m');
    expect(host.textContent).toContain('日线涨跌 +8.00%');

    await act(async () => root.unmount());
  });

  it('renders sorted minute candles and finite volume without reporting a minute date', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onActiveDateChange = vi.fn();

    await act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        intradayData={intradayResponse}
        onActiveDateChange={onActiveDateChange}
      />,
    ));
    onActiveDateChange.mockClear();

    const minuteButton = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '分钟线');
    if (!minuteButton) throw new Error('Missing minute mode button');
    await act(async () => minuteButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onActiveDateChange).toHaveBeenCalledTimes(1);
    expect(onActiveDateChange).toHaveBeenCalledWith(null);
    expect(host.querySelector('.stock-price-row')?.textContent).toContain('10.92');
    expect(host.textContent).toContain('分钟线 1m 09:32:00');
    expect(host.textContent).not.toContain('日线涨跌');

    const minuteChart = chartHarness.charts[1];
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
    expect(onActiveDateChange).not.toHaveBeenCalledWith(1_786_325_520);

    await act(async () => root.unmount());
  });

  it('shows minute loading, empty, market, delayed, closed and one-candle states', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const render = async (
      intradayData: RealtimeStocksResponse | null,
      intradayLoading = false,
      intradayDelayed = false,
    ) => act(async () => root.render(
      <ProfessionalCandlestickChart
        stock={stock}
        intradayData={intradayData}
        intradayLoading={intradayLoading}
        intradayDelayed={intradayDelayed}
      />,
    ));

    await render(null, true);
    const minuteButton = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '分钟线');
    if (!minuteButton) throw new Error('Missing minute mode button');
    await act(async () => minuteButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(host.textContent).toContain('分钟行情加载中');

    await render({ ...intradayResponse, items: [] });
    expect(host.textContent).toContain('暂无当日分钟行情');

    const oneItemResponse = { ...intradayResponse, items: [earlierIntradayQuote] };
    await render(oneItemResponse);
    expect(host.textContent).toContain('交易中');
    expect(host.textContent).toContain('当前仅有 1 根分钟 K 线');

    await render(oneItemResponse, false, true);
    expect(host.textContent).toContain('数据可能延迟');

    await render({ ...oneItemResponse, marketStatus: 'closed' });
    expect(host.textContent).toContain('已闭市 · 最后行情');

    await act(async () => root.unmount());
  });

  it('replaces same-day minute data without creating another chart and restores daily controls', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <ProfessionalCandlestickChart stock={stock} intradayData={intradayResponse} />,
    ));
    const modeButton = (label: string) => {
      const button = [...host.querySelectorAll('button')]
        .find((item) => item.textContent?.trim() === label);
      if (!button) throw new Error(`Missing mode button: ${label}`);
      return button;
    };
    await act(async () => modeButton('分钟线').dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const minuteChart = chartHarness.charts[1];
    const candleSeries = minuteChart.addSeries.mock.results[0]?.value;
    expect(chartHarness.createChart).toHaveBeenCalledTimes(2);
    expect(chartHarness.timeScale.fitContent).toHaveBeenCalledTimes(1);

    const nextQuote: RealtimeStockQuote = {
      ...latestIntradayQuote,
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
        intradayData={{ ...intradayResponse, items: [nextQuote, latestIntradayQuote, earlierIntradayQuote] }}
      />,
    ));

    expect(chartHarness.createChart).toHaveBeenCalledTimes(2);
    expect(chartHarness.timeScale.fitContent).toHaveBeenCalledTimes(1);
    expect(candleSeries.setData).toHaveBeenLastCalledWith([
      expect.objectContaining({ time: 1_786_325_460 }),
      expect.objectContaining({ time: 1_786_325_520 }),
      expect.objectContaining({ time: 1_786_325_580, close: 10.98 }),
    ]);

    await act(async () => modeButton('日线').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(modeButton('日线').className).toContain('is-active');
    expect(host.textContent).toContain('MA');
    expect(host.textContent).toContain('MACD');
    expect(host.querySelectorAll('.chart-navigation-controls button')).toHaveLength(4);
    expect(chartHarness.createChart).toHaveBeenCalledTimes(3);
    expect(chartHarness.charts[2].addSeries.mock.calls.some(
      (call) => typeof call[2] === 'number' && call[2] > 0,
    )).toBe(true);

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

    const chartOptions = chartHarness.createChart.mock.calls[0]?.[1];
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

    const chartOptions = chartHarness.createChart.mock.calls[0]?.[1];
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

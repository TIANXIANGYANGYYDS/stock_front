// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SectorStock } from '../../lib/api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const chartHarness = vi.hoisted(() => {
  const remove = vi.fn();
  const removeSeries = vi.fn();
  const series: Array<{
    setData: ReturnType<typeof vi.fn>;
    applyOptions: ReturnType<typeof vi.fn>;
    moveToPane: ReturnType<typeof vi.fn>;
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
  const createChart = vi.fn(() => ({
    addSeries: vi.fn(() => {
      const api = {
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
  }));
  return {
    createChart,
    remove,
    removeSeries,
    panes,
    series,
    getCrosshairMove: () => crosshairMove,
    getVisibleRange: () => visibleRange,
    setVisibleRange: (range: { from: number; to: number }) => { visibleRange = range; },
    reset: () => {
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
  CandlestickSeries: Symbol('CandlestickSeries'),
  ColorType: { Solid: 'Solid' },
  createChart: chartHarness.createChart,
  CrosshairMode: { Normal: 0 },
  HistogramSeries: Symbol('HistogramSeries'),
  LineSeries: Symbol('LineSeries'),
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

afterEach(() => {
  document.body.innerHTML = '';
  chartHarness.createChart.mockClear();
  chartHarness.remove.mockClear();
  chartHarness.reset();
});

describe('ProfessionalCandlestickChart interactions', () => {
  it('resets a manually navigated chart to the latest 60 trading days when switching stocks', async () => {
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
    const sixtyDayButton = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '近60日');
    expect(sixtyDayButton?.className).toContain('is-active');

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
      button('近10日').dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

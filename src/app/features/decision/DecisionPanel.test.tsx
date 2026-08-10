// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { SectorStock, StockKlineBar } from '../../lib/api';
import { DecisionPanel } from './DecisionPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const stock: SectorStock = {
  code: '600000', name: '浦发银行', tradeDate: '2026-08-08',
  open: 14, high: 15, low: 13.8, close: 14.5,
  changeAmount: 0.5, changePercent: 4.55, amplitudePercent: 10.91,
  amount: 900_000_000, volume: 80_000_000, turnoverPercent: 2.8,
  ma: null, volumeMa: null, macd: null, boll: null, kdj: null,
  rsi: null, cci: null, wr: null, atr: null, chip: null,
  kline: [],
};

const historicalBar: StockKlineBar = {
  date: '2026-08-07',
  open: 9.8, high: 10.8, low: 9.4, close: 10.5,
  changeAmount: 0.7, changePercent: 7.14,
  amplitudePercent: 14.29, turnoverPercent: 3.25,
  amount: 620_000_000, volume: 58_000_000,
  ma: { ma5: 10.1, ma10: 9.9, ma20: null, ma30: null, ma60: null },
  volumeMa: { volMa5: 52_000_000, volMa10: null, volMa20: null, volMa60: null },
  macd: { dif: 0.31, dea: 0.22, hist: 0.18 },
  boll: { upper: 11.2, mid: 10, lower: 8.8 },
  kdj: { k: 61, d: 55, j: 73 },
  rsi: { rsi6: 68, rsi12: 62, rsi24: 57 },
  cci: { cci14: 112 },
  wr: { wr6: 18, wr10: 22, wr14: 25 },
  atr: { atr14: 0.66 },
  chip: {
    profitRatio: 0.62,
    avgCost: 10.08,
    cost90: { low: 8.6, high: 11.5, concentration: 0.1234 },
    cost70: { low: 9.2, high: 10.6, concentration: 0.0789 },
    chart: { x: [1, 4, 8, 5], y: [8.6, 9.8, 10.5, 11.5] },
  },
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('DecisionPanel synchronized snapshot', () => {
  it('keeps the sidebar as a daily snapshot without a realtime section', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <DecisionPanel stock={stock} bar={historicalBar} />,
    ));

    expect(host.querySelector('.realtime-stock-snapshot')).toBeNull();
    expect(host.textContent).toContain('日线行情');
    expect(host.textContent).toContain('收盘10.50');
    expect(host.textContent).toContain('70%成本区间');
    expect(host.textContent).toContain('KDJ');

    await act(async () => root.unmount());
  });

  it('renders the selected K-line day and its complete chip distribution instead of latest fields', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<DecisionPanel stock={stock} bar={historicalBar} />);
    });

    expect(host.textContent).toContain('行情快照');
    expect(host.textContent).not.toContain('最新行情快照');
    expect(host.textContent).toContain('交易日 2026-08-07');
    expect(host.textContent).toContain('10.50');
    expect(host.textContent).not.toContain('14.50');
    expect(host.textContent).toContain('70%成本区间');
    expect(host.textContent).toContain('9.20 - 10.60');
    expect(host.textContent).toContain('90%成本区间');
    expect(host.textContent).toContain('集中度 12.34%');
    expect(host.textContent).toContain('KDJ');
    expect(host.textContent).toContain('ATR');
    expect(host.querySelector('[aria-label="2026-08-07 筹码分布图"]')).not.toBeNull();

    await act(async () => root.unmount());
  });
});

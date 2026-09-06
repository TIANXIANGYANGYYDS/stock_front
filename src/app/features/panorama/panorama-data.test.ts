import { expect, it } from 'vitest';
import { amountLabel, barHeight, changeLabel, changeTone, filterPanoramaStocks, panoramaStocks, stockComparison, summarizePanorama } from './panorama-data';
import type { StockListItem } from '../../lib/api';

it('distinguishes missing change data from a genuine flat session', () => {
  expect(changeLabel(null)).toBe('--');
  expect(changeLabel(Number.NaN)).toBe('--');
  expect(changeTone(null)).toBe('unknown');
  expect(changeLabel(0)).toBe('0.00%');
  expect(changeTone(0)).toBe('flat');
  expect(changeLabel(-2.15)).toBe('-2.15%');
  expect(changeLabel(2.15)).toBe('+2.15%');
});

it('encodes equal absolute moves with equal heights and keeps values unchanged', () => {
  expect(barHeight(-10, 20)).toBe(barHeight(10, 20));
  expect(barHeight(20, 20)).toBeGreaterThan(barHeight(10, 20));
  expect(barHeight(null, 20)).toBeLessThan(barHeight(.1, 20));
  expect(Number.isFinite(barHeight(0, 0))).toBe(true);
});

it('keeps the backend order and complete quotes while limiting the scene to 50 unique stocks', () => {
  const stocks: StockListItem[] = Array.from({ length: 52 }, (_, index) => ({ code: String(index), name: `股票${index}`, tradeDate: '2026-09-04', close: index + 1.23, changePercent: index % 2 ? null : -index, amount: 100 - index }));
  const result = panoramaStocks([stocks[0], ...stocks]);
  expect(result).toEqual(stocks.slice(0, 50));
  expect(result[1].changePercent).toBeNull();
  expect(stocks).toHaveLength(52);
});

function quote(code: string, changePercent: number | null, amount: number | null): StockListItem {
  return { code, name: `股票${code}`, tradeDate: '2026-09-04', close: 10, changePercent, amount };
}

it('sorts gains, losses and absolute moves with missing values last without changing the source', () => {
  const stocks = [quote('a', null, null), quote('b', 5, 200), quote('c', -8, 300), quote('d', 0, 0), quote('e', Number.NaN, -1)];
  expect(filterPanoramaStocks(stocks, '', 'all', 'gain').map((stock) => stock.code)).toEqual(['b', 'd', 'c', 'a', 'e']);
  expect(filterPanoramaStocks(stocks, '', 'all', 'loss').map((stock) => stock.code)).toEqual(['c', 'd', 'b', 'a', 'e']);
  expect(filterPanoramaStocks(stocks, '', 'all', 'move').map((stock) => stock.code)).toEqual(['c', 'b', 'd', 'a', 'e']);
  expect(filterPanoramaStocks(stocks, '', 'all', 'amount').map((stock) => stock.code)).toEqual(['c', 'b', 'd', 'a', 'e']);
  expect(stocks.map((stock) => stock.code)).toEqual(['a', 'b', 'c', 'd', 'e']);
});

it('combines sample search with direction and the inclusive 5 percent threshold', () => {
  const stocks = [quote('a', 5, 1), quote('b', -5, 2), quote('c', 4.99, 3), quote('d', null, 4)];
  expect(filterPanoramaStocks(stocks, '', 'large', 'move').map((stock) => stock.code)).toEqual(['a', 'b']);
  expect(filterPanoramaStocks(stocks, '  股票B ', 'fall', 'amount')).toEqual([stocks[1]]);
  expect(filterPanoramaStocks(stocks, 'b', 'rise', 'amount')).toEqual([]);
  expect(filterPanoramaStocks(stocks, '不在样本', 'all', 'amount')).toEqual([]);
});

it('excludes missing values from medians and distinguishes flat, unknown and absent direction leaders', () => {
  const summary = summarizePanorama([quote('a', -8, 300), quote('b', 0, 0), quote('c', 5, 100), quote('d', 9, null), quote('e', null, -1), quote('f', Number.NaN, Number.NaN)]);
  expect(summary).toMatchObject({ rise: 2, fall: 1, flat: 1, unknown: 2, median: 2.5, totalAmount: 400, amountCount: 3, maxMove: 9 });
  expect(summary.gainLeader?.code).toBe('d');
  expect(summary.lossLeader?.code).toBe('a');
  expect(summarizePanorama([quote('a', 2, 0)]).lossLeader).toBeUndefined();
  expect(summarizePanorama([quote('a', -2, null)]).gainLeader).toBeUndefined();
  expect(summarizePanorama([])).toMatchObject({ median: null, totalAmount: null, unknown: 0 });
  expect(summarizePanorama([quote('a', 0, 0)]).median).toBe(0);
});

it('keeps ranking and share anchored to the full sample after filtering and handles ties', () => {
  const stocks = [quote('a', -8, 200), quote('b', 6, 100), quote('c', 4, 100), quote('d', 10, 50)];
  const summary = summarizePanorama(stocks);
  const selected = filterPanoramaStocks(stocks, 'b', 'rise', 'gain')[0];
  const result = stockComparison(selected, stocks, summary);
  expect(result.amountRank).toBe(2);
  expect(result.amountShare).toBeCloseTo(100 / 450 * 100);
  expect(result.medianDifference).toBe(1);
  expect(stockComparison(stocks[2], stocks, summary).amountRank).toBe(2);
  expect(stockComparison(stocks[3], stocks, summary).amountRank).toBe(4);
  expect(stockComparison(quote('unknown', null, null), stocks, summary)).toEqual({ amountRank: null, amountShare: null, medianDifference: null });
  expect(stockComparison(quote('zero', 0, 0), [], summarizePanorama([])).amountShare).toBeNull();
});

it('formats yuan without silently replacing missing amounts with zero', () => {
  expect(amountLabel(17378000000)).toBe('173.78 亿');
  expect(amountLabel(15000)).toBe('1.50 万');
  expect(amountLabel(0)).toBe('0.00 万');
  expect(amountLabel(null)).toBe('--');
  expect(amountLabel(Number.NaN)).toBe('--');
});

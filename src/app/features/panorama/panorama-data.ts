import type { StockListItem } from '../../lib/api';

export function panoramaStocks(items: StockListItem[]): StockListItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.code || seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  }).slice(0, 50);
}

export function changeTone(value: number | null) {
  return value === null || !Number.isFinite(value) ? 'unknown' : value > 0 ? 'rise' : value < 0 ? 'fall' : 'flat';
}

export function changeLabel(value: number | null) {
  return value === null || !Number.isFinite(value) ? '--' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function barHeight(value: number | null, maximum: number) {
  return value === null || !Number.isFinite(value) ? .045 : .045 + Math.abs(value) / Math.max(maximum, .01) * 3.8;
}

export type PanoramaFilter = 'all' | 'rise' | 'fall' | 'large';
export type PanoramaSort = 'amount' | 'gain' | 'loss' | 'move';

export function finiteValue(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

export function amountLabel(value: number | null) {
  if (!finiteValue(value) || value < 0) return '--';
  return value >= 1e8 ? `${(value / 1e8).toFixed(2)} 亿` : `${(value / 1e4).toFixed(2)} 万`;
}

export function filterPanoramaStocks(stocks: StockListItem[], query: string, filter: PanoramaFilter, sort: PanoramaSort) {
  const keyword = query.trim().toLowerCase();
  // Sort a copy; missing values always follow valid values, including zero.
  return stocks.filter((stock) => {
    const tone = changeTone(stock.changePercent);
    return (!keyword || `${stock.code} ${stock.name}`.toLowerCase().includes(keyword))
      && (filter === 'all' || filter === tone || (filter === 'large' && finiteValue(stock.changePercent) && Math.abs(stock.changePercent) >= 5));
  }).sort((a, b) => {
    const aValue = sort === 'amount' ? a.amount : a.changePercent;
    const bValue = sort === 'amount' ? b.amount : b.changePercent;
    const aValid = finiteValue(aValue) && (sort !== 'amount' || aValue >= 0);
    const bValid = finiteValue(bValue) && (sort !== 'amount' || bValue >= 0);
    if (!aValid || !bValid) return Number(bValid) - Number(aValid);
    return sort === 'loss' ? aValue - bValue : sort === 'move' ? Math.abs(bValue) - Math.abs(aValue) : bValue - aValue;
  });
}

export function summarizePanorama(stocks: StockListItem[]) {
  const changes = stocks.map((stock) => stock.changePercent).filter(finiteValue).sort((a, b) => a - b);
  const amounts = stocks.map((stock) => stock.amount).filter((value): value is number => finiteValue(value) && value >= 0);
  const median = changes.length ? (changes[Math.floor((changes.length - 1) / 2)] + changes[Math.floor(changes.length / 2)]) / 2 : null;
  return {
    rise: changes.filter((value) => value > 0).length,
    fall: changes.filter((value) => value < 0).length,
    flat: changes.filter((value) => value === 0).length,
    unknown: stocks.length - changes.length,
    median,
    maxMove: Math.max(.01, ...changes.map(Math.abs)),
    totalAmount: amounts.length ? amounts.reduce((total, value) => total + value, 0) : null,
    amountCount: amounts.length,
    gainLeader: filterPanoramaStocks(stocks, '', 'rise', 'gain')[0],
    lossLeader: filterPanoramaStocks(stocks, '', 'fall', 'loss')[0],
  };
}

export function stockComparison(stock: StockListItem, stocks: StockListItem[], summary: ReturnType<typeof summarizePanorama>) {
  const hasAmount = finiteValue(stock.amount) && stock.amount >= 0;
  return {
    amountRank: hasAmount ? 1 + stocks.filter((item) => finiteValue(item.amount) && item.amount > stock.amount!).length : null,
    amountShare: hasAmount && summary.totalAmount && summary.totalAmount > 0 ? stock.amount! / summary.totalAmount * 100 : null,
    medianDifference: finiteValue(stock.changePercent) && summary.median !== null ? stock.changePercent - summary.median : null,
  };
}

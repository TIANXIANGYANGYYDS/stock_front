import { LATEST_MARKET_POOL_NAME } from '../../lib/constants';

export function pickDefaultSector(
  investmentPreference: Array<{ name: string; rank?: number }>,
  marketHeat: Array<{ name: string; rank?: number }>,
): string {
  return investmentPreference[0]?.name || marketHeat[0]?.name || LATEST_MARKET_POOL_NAME;
}

export function pickDefaultStock(
  stocks: Array<{ code: string; kline?: Array<unknown> }>,
): string {
  return stocks.find((stock) => (stock.kline?.length ?? 0) > 0)?.code || stocks[0]?.code || '';
}

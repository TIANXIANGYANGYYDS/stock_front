import type { SentimentStock, StockPopularity } from './sentiment-contract';
export const popularityRank = (stock: SentimentStock) => stock.popularity?.status === 'ranked' && Number.isFinite(stock.popularity.rank) ? stock.popularity.rank : null;
export function popularityText(popularity?: StockPopularity) {
  if (!popularity) return '热度未提供';
  if (popularity.status === 'ranked') return popularity.rank == null ? '热度排名未知' : `同花顺 #${popularity.rank}`;
  return { not_ranked: '未入热度前 100', missing: '热度缺失', stale: '热度已过期' }[popularity.status] ?? '热度未知';
}

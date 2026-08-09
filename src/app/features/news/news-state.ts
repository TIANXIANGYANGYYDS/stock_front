import type { NewsItem } from '../../lib/api';

export type NewsSortField = 'time' | 'score';
export type SortDirection = 'asc' | 'desc';

export function sortNews(
  items: NewsItem[],
  field: NewsSortField,
  direction: SortDirection,
): NewsItem[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftValue = field === 'score' ? left.impact : left.publishTs ?? 0;
    const rightValue = field === 'score' ? right.impact : right.publishTs ?? 0;
    return (leftValue - rightValue) * multiplier;
  });
}

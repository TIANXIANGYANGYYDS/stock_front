import { describe, expect, it } from 'vitest';
import type { NewsItem } from '../../lib/api';
import { sortNews } from './news-state';

const items = [
  { id: 'a', publishTs: 300, impact: -20 },
  { id: 'b', publishTs: 100, impact: 80 },
  { id: 'c', publishTs: 200, impact: 10 },
] as NewsItem[];

describe('sortNews', () => {
  it('sorts time independently in ascending and descending order', () => {
    expect(sortNews(items, 'time', 'asc').map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(sortNews(items, 'time', 'desc').map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts impact score independently in ascending and descending order', () => {
    expect(sortNews(items, 'score', 'asc').map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(sortNews(items, 'score', 'desc').map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the API response order', () => {
    sortNews(items, 'score', 'desc');
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});

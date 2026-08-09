import { describe, expect, it } from 'vitest';
import { analysisAdviceText, resolveMainLines } from './market-analysis-state';

describe('market analysis empty states', () => {
  it('never invents main lines when the API has no analysis', () => {
    expect(resolveMainLines(null)).toEqual([]);
    expect(analysisAdviceText(null)).toBeNull();
  });

  it('only exposes main lines and advice returned by the API', () => {
    const analysis = {
      tradeDate: '2026-08-08',
      date: '2026-08-08',
      mainLines: [{ rank: 1, title: '半导体', priority: 'high' as const, reason: '资金回流' }],
      analysisText: '关注量价确认',
    };

    expect(resolveMainLines(analysis)).toEqual(analysis.mainLines);
    expect(analysisAdviceText(analysis)).toBe('关注量价确认');
  });
});

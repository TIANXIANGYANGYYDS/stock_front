import { describe, expect, it } from 'vitest';
import type { ChipIndicators } from '../../lib/api';
import { normalizeChipDistribution } from './chip-distribution';

function chipWithChart(x: number[], y: number[]): ChipIndicators {
  return {
    profitRatio: 0.6,
    avgCost: 10,
    cost90: null,
    cost70: null,
    chart: { x, y },
  };
}

describe('normalizeChipDistribution', () => {
  it('keeps x/y pairs aligned, filters invalid points, and sorts by price', () => {
    const result = normalizeChipDistribution(
      chipWithChart([5, Number.NaN, 3, 9], [10, 11, 9]),
    );

    expect(result).toEqual([
      { density: 3, price: 9, ratio: 0.6 },
      { density: 5, price: 10, ratio: 1 },
    ]);
  });

  it('rejects negative density and non-positive prices', () => {
    expect(normalizeChipDistribution(chipWithChart([-1, 2, 4], [10, 0, 12]))).toEqual([
      { density: 4, price: 12, ratio: 1 },
    ]);
  });

  it('returns an empty distribution when the backend has no chart points', () => {
    expect(normalizeChipDistribution(null)).toEqual([]);
  });
});

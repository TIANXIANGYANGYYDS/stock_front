import type { ChipIndicators } from '../../lib/api';

export interface ChipDistributionPoint {
  density: number;
  price: number;
  ratio: number;
}

export function normalizeChipDistribution(
  chip: ChipIndicators | null | undefined,
): ChipDistributionPoint[] {
  const x = chip?.chart?.x ?? [];
  const y = chip?.chart?.y ?? [];
  const pairs: Array<{ density: number; price: number }> = [];
  const pairCount = Math.min(x.length, y.length);

  for (let index = 0; index < pairCount; index += 1) {
    const density = x[index];
    const price = y[index];
    if (!Number.isFinite(density) || density < 0 || !Number.isFinite(price) || price <= 0) continue;
    pairs.push({ density, price });
  }

  const maxDensity = Math.max(0, ...pairs.map((point) => point.density));
  if (maxDensity <= 0) return [];

  return pairs
    .sort((left, right) => left.price - right.price)
    .map((point) => ({ ...point, ratio: point.density / maxDensity }));
}

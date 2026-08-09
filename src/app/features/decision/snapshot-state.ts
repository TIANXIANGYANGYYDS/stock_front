import type { SectorStock, StockKlineBar } from '../../lib/api';

export function selectSnapshotBar(
  stock: SectorStock | null,
  activeDate: string | null,
): StockKlineBar | null {
  const bars = stock?.kline ?? [];
  if (!bars.length) return null;
  if (activeDate) {
    return bars.find((bar) => bar.date === activeDate) ?? null;
  }
  return [...bars].sort((left, right) => left.date.localeCompare(right.date)).at(-1) ?? null;
}

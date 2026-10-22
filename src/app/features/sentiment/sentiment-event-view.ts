import type { SentimentSecondEvent } from './sentiment-seconds';
import type { ComparisonStock } from './SentimentStockComparison';

export interface ChartBehavior { event: SentimentSecondEvent; name: string; color: string }
export type BehaviorFilter = 'all' | SentimentSecondEvent['kind'];

export function chartBehaviors(stocks: ComparisonStock[], from: number, to: number, code: string | null, kind: BehaviorFilter): ChartBehavior[] {
  const unique = new Map<string, ChartBehavior>();
  for (const stock of stocks) if (!code || code === stock.stock.code) for (const event of stock.series.events) {
    if (event.time >= from && event.time <= to && (kind === 'all' || event.kind === kind)) unique.set(event.id, { event, name: stock.stock.name, color: stock.color });
  }
  return [...unique.values()].sort((a, b) => a.event.time - b.event.time || a.event.id.localeCompare(b.event.id));
}

/** Group only neighboring pixels on the rail. Every underlying event remains selectable. */
export function groupBehaviorMarkers(items: ChartBehavior[], position: (time: number) => number, width: number, spacing = 26) {
  const groups: { items: ChartBehavior[]; first: number; last: number; position: number }[] = [];
  for (const item of items) {
    const next = Math.max(0, Math.min(1, position(item.event.time)));
    const previous = groups.at(-1);
    if (previous && (next - previous.first) * width < spacing) {
      previous.items.push(item); previous.last = next; previous.position = (previous.first + next) / 2;
    } else groups.push({ items: [item], first: next, last: next, position: next });
  }
  return groups;
}

export function behaviorSelection(items: ChartBehavior[], pinnedId: string | null) {
  const index = pinnedId === null ? items.length - 1 : items.findIndex(item => item.event.id === pinnedId);
  const activeIndex = index < 0 ? items.length - 1 : index;
  return { active: items[activeIndex] ?? null, index: activeIndex, following: pinnedId === null || index < 0, newerCount: index < 0 || pinnedId === null ? 0 : items.length - index - 1 };
}

export type QuoteChartRow = Record<string, number | null> & { time: number; x: number };
export function closestQuoteRow(rows: QuoteChartRow[], x: number): QuoteChartRow | undefined {
  let low = 0, high = rows.length;
  while (low < high) { const mid = Math.floor((low + high) / 2); if (rows[mid].x < x) low = mid + 1; else high = mid; }
  const a = rows[low - 1], b = rows[low];
  const closest = !a ? b : !b ? a : x - a.x <= b.x - x ? a : b;
  return closest && Math.abs(closest.x - x) <= 15000 ? closest : undefined;
}

import type { SeriesMarker, Time } from 'lightweight-charts';
import type { QuantExecutionRangeItem } from '../quant/quant-execution-range-types';

export function buildExecutionMarkers(items: QuantExecutionRangeItem[], dates: readonly string[]) {
  const available = new Set(dates);
  const filled = items.filter(item => item.status === 'filled');
  const groups = new Map<string, { id: string; date: string; action: 'buy' | 'sell'; items: QuantExecutionRangeItem[] }>();
  const unlocated: QuantExecutionRangeItem[] = [];
  for (const item of filled) {
    // trade_date is a Shanghai calendar date. Never map execution/compute timestamps onto another bar.
    if (!item.trade_date || !available.has(item.trade_date) || (item.action !== 'buy' && item.action !== 'sell')) {
      unlocated.push(item); continue;
    }
    const id = `execution:${item.trade_date}:${item.action}`;
    const group = groups.get(id) ?? { id, date: item.trade_date, action: item.action, items: [] };
    group.items.push(item);
    groups.set(id, group);
  }
  const ordered = [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.action.localeCompare(b.action));
  const markers: SeriesMarker<Time>[] = ordered.map(group => ({
    id: group.id, time: group.date, position: group.action === 'buy' ? 'belowBar' : 'aboveBar',
    shape: group.action === 'buy' ? 'arrowUp' : 'arrowDown', color: group.action === 'buy' ? '#e55769' : '#189c80',
    text: `${group.action === 'buy' ? '买入' : '卖出'}${group.items.length > 1 ? ` ×${group.items.length}` : ` · ¥${formatRecordedExecutionPrice(group.items[0].execution_price)}`}`,
  }));
  // Point to the matching volume column's top, never to a manufactured execution-price coordinate.
  const volumeMarkers: SeriesMarker<Time>[] = markers.map((marker, index) => ({ ...marker, position: 'aboveBar', shape: 'arrowDown',
    text: `${ordered[index].action === 'buy' ? '买入' : '卖出'}${ordered[index].items.length > 1 ? ` ×${ordered[index].items.length}` : ''}`,
  }));
  return { groups: ordered, markers, volumeMarkers, filled, unlocated };
}

/** Preserve the parsed backend price, rather than rounding it to the chart's two-decimal scale. */
export const formatRecordedExecutionPrice = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';

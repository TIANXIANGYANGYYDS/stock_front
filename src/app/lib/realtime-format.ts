import type {
  MarketIndexQuote,
  RealtimeStockQuote,
  StockListItem,
} from './api';

export type QuoteTone = 'rise' | 'fall' | 'flat';

export interface OrderedMarketIndex {
  symbol: string;
  name: string;
  quote: MarketIndexQuote | null;
}

const CANONICAL_INDICES: Array<{ symbol: string; name: string }> = [
  { symbol: '000001.SH', name: '上证指数' },
  { symbol: '399001.SZ', name: '深证成指' },
  { symbol: '399006.SZ', name: '创业板指' },
  { symbol: '000688.SH', name: '科创50' },
  { symbol: '000300.SH', name: '沪深300' },
];

const SHANGHAI_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatShanghaiTime(value: string): string {
  if (!value) return '--:--:--';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '--:--:--';
  const parts = Object.fromEntries(
    SHANGHAI_TIME_FORMATTER
      .formatToParts(date)
      .filter((part) => part.type === 'hour' || part.type === 'minute' || part.type === 'second')
      .map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return hour && parts.minute && parts.second
    ? `${hour}:${parts.minute}:${parts.second}`
    : '--:--:--';
}

export function marketStatusLabel(status: string): string {
  if (status === 'open') return '交易中';
  if (status === 'closed') return '已闭市';
  return '状态未知';
}

export function quoteTone(
  change: number | null,
  changePercent: number | null,
): QuoteTone {
  const direction = typeof change === 'number' && Number.isFinite(change)
    ? change
    : changePercent;
  if (typeof direction !== 'number' || !Number.isFinite(direction) || direction === 0) {
    return 'flat';
  }
  return direction > 0 ? 'rise' : 'fall';
}

export function orderMarketIndices(items: MarketIndexQuote[]): OrderedMarketIndex[] {
  const bySymbol = new Map(items.map((item) => [item.symbol, item]));
  return CANONICAL_INDICES.map((identity) => ({
    ...identity,
    quote: bySymbol.get(identity.symbol) ?? null,
  }));
}

export function mergeRealtimeStockItems(
  dailyItems: StockListItem[],
  realtimeItems: RealtimeStockQuote[],
): StockListItem[] {
  const byCode = new Map(realtimeItems.map((item) => [item.code, item]));
  return dailyItems.map((item) => {
    const realtime = byCode.get(item.code);
    if (!realtime) return item;
    return {
      ...item,
      close: typeof realtime.close === 'number' && Number.isFinite(realtime.close)
        ? realtime.close
        : item.close,
      amount: typeof realtime.amount === 'number' && Number.isFinite(realtime.amount)
        ? realtime.amount
        : item.amount,
    };
  });
}

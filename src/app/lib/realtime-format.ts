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

const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatShanghaiDate(date: Date): string {
  const parts = Object.fromEntries(
    SHANGHAI_DATE_FORMATTER
      .formatToParts(date)
      .filter((part) => part.type === 'year' || part.type === 'month' || part.type === 'day')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isValidIntradayQuote(item: RealtimeStockQuote): boolean {
  return typeof item.open === 'number'
    && Number.isFinite(item.open)
    && typeof item.high === 'number'
    && Number.isFinite(item.high)
    && typeof item.low === 'number'
    && Number.isFinite(item.low)
    && typeof item.close === 'number'
    && Number.isFinite(item.close);
}

function isValidTradingDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

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
  const byCode = new Map<string, {
    close: number | null;
    snapshotPrice: number | null;
    amount: number | null;
  }>();
  for (const item of realtimeItems) {
    const current = byCode.get(item.code) ?? {
      close: null,
      snapshotPrice: null,
      amount: null,
    };
    byCode.set(item.code, {
      close: typeof item.close === 'number' && Number.isFinite(item.close)
        ? item.close
        : current.close,
      snapshotPrice: typeof item.snapshotPrice === 'number' && Number.isFinite(item.snapshotPrice)
        ? item.snapshotPrice
        : current.snapshotPrice,
      amount: typeof item.amount === 'number' && Number.isFinite(item.amount)
        ? item.amount
        : current.amount,
    });
  }
  return dailyItems.map((item) => {
    const realtime = byCode.get(item.code);
    if (!realtime) return item;
    return {
      ...item,
      close: typeof realtime.close === 'number' && Number.isFinite(realtime.close)
        ? realtime.close
        : typeof realtime.snapshotPrice === 'number' && Number.isFinite(realtime.snapshotPrice)
          ? realtime.snapshotPrice
          : item.close,
      amount: typeof realtime.amount === 'number' && Number.isFinite(realtime.amount)
        ? realtime.amount
        : item.amount,
    };
  });
}

export function selectLatestStockSnapshot(
  items: RealtimeStockQuote[],
  code: string,
): RealtimeStockQuote | null {
  return items.reduce<RealtimeStockQuote | null>((latest, item) => {
    if (item.code !== code
      || typeof item.snapshotPrice !== 'number'
      || !Number.isFinite(item.snapshotPrice)) {
      return latest;
    }
    if (!latest) return item;
    const itemTime = Date.parse(item.sourceTime) || Date.parse(item.receivedAt) || 0;
    const latestTime = Date.parse(latest.sourceTime) || Date.parse(latest.receivedAt) || 0;
    return itemTime >= latestTime ? item : latest;
  }, null);
}

export function selectIntradayQuotes(
  items: RealtimeStockQuote[],
  code: string,
  tradingDate?: string,
): RealtimeStockQuote[] {
  const validQuotes = items
    .filter((item) => item.code === code && isValidIntradayQuote(item))
    .flatMap((item) => {
      const timestamp = new Date(item.timestamp).getTime();
      return Number.isFinite(timestamp) ? [{ item, timestamp }] : [];
    });
  const latestTimestamp = validQuotes.reduce<number | null>(
    (latest, quote) => latest === null || quote.timestamp > latest ? quote.timestamp : latest,
    null,
  );
  const targetDate = isValidTradingDate(tradingDate)
    ? tradingDate
    : latestTimestamp === null ? null : formatShanghaiDate(new Date(latestTimestamp));

  if (!targetDate) return [];

  const quotesByTimestamp = new Map<number, RealtimeStockQuote>();
  for (const quote of validQuotes) {
    if (formatShanghaiDate(new Date(quote.timestamp)) === targetDate) {
      quotesByTimestamp.set(quote.timestamp, quote.item);
    }
  }
  return [...quotesByTimestamp.entries()]
    .sort(([firstTimestamp], [secondTimestamp]) => firstTimestamp - secondTimestamp)
    .map(([, quote]) => quote);
}

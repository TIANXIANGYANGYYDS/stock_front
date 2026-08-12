import type {
  IntradayInterval,
  MarketIndexQuote,
  StockIntradayBar,
  StockListItem,
  StockRealtimeQuote,
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

function isValidIntradayBar(item: StockIntradayBar): boolean {
  return typeof item.open === 'number'
    && Number.isFinite(item.open)
    && typeof item.high === 'number'
    && Number.isFinite(item.high)
    && typeof item.low === 'number'
    && Number.isFinite(item.low)
    && typeof item.close === 'number'
    && Number.isFinite(item.close);
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
  if (status === 'stale') return '行情延迟';
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
  realtimeItems: StockRealtimeQuote[],
  realtimeTradingDate = '',
  selected?: { quote: StockRealtimeQuote; tradingDate: string },
): StockListItem[] {
  const byCode = new Map<string, {
    price: number | null;
    amount: number | null;
  }>();
  for (const item of realtimeItems) {
    const current = byCode.get(item.code) ?? {
      price: null,
      amount: null,
    };
    byCode.set(item.code, {
      price: typeof item.price === 'number' && Number.isFinite(item.price)
        ? item.price
        : current.price,
      amount: typeof item.amount === 'number' && Number.isFinite(item.amount)
        ? item.amount
        : current.amount,
    });
  }
  if (selected) {
    const { quote } = selected;
    byCode.set(quote.code, {
      price: typeof quote.price === 'number' && Number.isFinite(quote.price)
        ? quote.price
        : null,
      amount: typeof quote.amount === 'number' && Number.isFinite(quote.amount)
        ? quote.amount
        : null,
    });
  }
  return dailyItems.map((item) => {
    const realtime = byCode.get(item.code);
    if (!realtime) return item;
    const itemRealtimeDate = selected?.quote.code === item.code
      ? selected.tradingDate
      : realtimeTradingDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(itemRealtimeDate)
      && /^\d{4}-\d{2}-\d{2}$/.test(item.tradeDate)
      && itemRealtimeDate < item.tradeDate) {
      return item;
    }
    const realtimePrice = typeof realtime.price === 'number' && Number.isFinite(realtime.price)
      ? realtime.price
      : null;
    const isNewTradingDate = Boolean(
      realtimePrice !== null
      && /^\d{4}-\d{2}-\d{2}$/.test(itemRealtimeDate)
      && itemRealtimeDate > item.tradeDate,
    );
    const realtimeChangePercent = isNewTradingDate
      && typeof item.close === 'number'
      && Number.isFinite(item.close)
      && item.close > 0
      && realtimePrice !== null
      ? ((realtimePrice - item.close) / item.close) * 100
      : item.changePercent;
    return {
      ...item,
      ...(realtimePrice !== null ? { isRealtime: true } : {}),
      tradeDate: isNewTradingDate ? itemRealtimeDate : item.tradeDate,
      close: realtimePrice !== null
        ? realtimePrice
        : item.close,
      changePercent: realtimeChangePercent,
      amount: typeof realtime.amount === 'number' && Number.isFinite(realtime.amount)
        ? realtime.amount
        : item.amount,
    };
  });
}

export function selectRealtimeStockQuote(
  items: StockRealtimeQuote[],
  code: string,
): StockRealtimeQuote | null {
  return items.reduce<StockRealtimeQuote | null>((latest, item) => {
    if (item.code !== code
      || typeof item.price !== 'number'
      || !Number.isFinite(item.price)) {
      return latest;
    }
    if (!latest) return item;
    const itemTime = Date.parse(item.sourceTime) || Date.parse(item.receivedAt) || 0;
    const latestTime = Date.parse(latest.sourceTime) || Date.parse(latest.receivedAt) || 0;
    return itemTime >= latestTime ? item : latest;
  }, null);
}

export function selectIntradayBars(
  items: StockIntradayBar[],
  code: string,
  tradeDate: string,
  interval: IntradayInterval,
): StockIntradayBar[] {
  const validBars = items
    .filter((item) => item.code === code && item.interval === interval && isValidIntradayBar(item))
    .flatMap((item) => {
      const timestamp = new Date(item.timestamp).getTime();
      return Number.isFinite(timestamp) ? [{ item, timestamp }] : [];
    });
  const barsByTimestamp = new Map<number, StockIntradayBar>();
  for (const bar of validBars) {
    if (formatShanghaiDate(new Date(bar.timestamp)) === tradeDate) {
      barsByTimestamp.set(bar.timestamp, bar.item);
    }
  }
  return [...barsByTimestamp.entries()]
    .sort(([firstTimestamp], [secondTimestamp]) => firstTimestamp - secondTimestamp)
    .map(([, bar]) => bar);
}

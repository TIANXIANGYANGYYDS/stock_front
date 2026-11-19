import { requestJson } from './api';

export type ChartMode = 'daily' | 'intraday' | 'seconds';
type SnapshotView = 'chart' | 'series';
export type SnapshotKind = 'auctions' | 'snapshots';
export interface QuoteSnapshot {
  code: string;
  observedAt: string;
  sourceTime: string;
  provider: string;
  phase: string;
  qualityIssue: string | null;
  auctionSemantics: string | null;
  price: number | null;
  previousClose: number | null;
  volume: number | null;
  amount: number | null;
  bids: Array<[number | null, number | null]>;
  asks: Array<[number | null, number | null]>;
}
export interface QuoteSnapshotResponse {
  code: string;
  tradeDate: string;
  startTime: string;
  endTime: string;
  items: QuoteSnapshot[];
  possiblyTruncated: boolean;
  lastObservedAt: string;
}
export interface SnapshotWindow { start: string; end: string; label: string }

const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
export const SNAPSHOT_WINDOWS: SnapshotWindow[] = [570, 780].flatMap(start => (
  Array.from({ length: 8 }, (_, index) => {
    const from = clock(start + index * 15);
    const to = clock(start + (index + 1) * 15);
    return { start: from, end: to, label: `${from.slice(0, 5)}–${to.slice(0, 5)}` };
  })
));
export const AUCTION_WINDOW: SnapshotWindow = { start: '09:15:00', end: '09:30:00', label: '09:15–09:30' };
export const TRADING_DAY_WINDOW: SnapshotWindow = { start: '09:30:00', end: '15:00:01', label: '全天走势' };

export function shanghaiDateTime(now = new Date()) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 19) };
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}
function book(value: unknown): QuoteSnapshot['bids'] {
  return Array.isArray(value) ? value.slice(0, 5).map(level => (
    Array.isArray(level) ? [numeric(level[0]), numeric(level[1])] : [null, null]
  )) : [];
}

export function mapQuoteSnapshot(raw: Record<string, unknown>): QuoteSnapshot {
  return {
    code: text(raw.code), observedAt: text(raw.observed_at), sourceTime: text(raw.market_data_time),
    provider: text(raw.provider), phase: text(raw.phase), qualityIssue: text(raw.quality_issue) || null,
    auctionSemantics: text(raw.auction_semantics) || null,
    price: numeric(raw.price), previousClose: numeric(raw.previous_close),
    volume: numeric(raw.volume), amount: numeric(raw.amount), bids: book(raw.bids), asks: book(raw.asks),
  };
}

export async function getQuoteSnapshots(
  kind: SnapshotKind, code: string, tradeDate: string, window: SnapshotWindow, signal?: AbortSignal, view: SnapshotView = 'chart',
): Promise<QuoteSnapshotResponse> {
  const start = Date.parse(`${tradeDate}T${window.start}+08:00`);
  const end = Date.parse(`${tradeDate}T${window.end}+08:00`);
  const wide = view === 'series' && end - start > 15 * 60 * 1000;
  const response = await requestJson<{ data?: Array<Record<string, unknown>>; possibly_truncated?: boolean; last_observed_at?: string }>(
    `/api/v1/stocks/${encodeURIComponent(code.trim())}/${kind}`,
    { trade_date: tradeDate, start_time: window.start, end_time: window.end, limit: wide ? 4000 : 1000, view },
    { signal, cache: 'no-store' },
  );
  // 极密行情触及长窗口上限时，按原有十五分钟边界回读，保留每段覆盖范围。
  if (wide && response.possibly_truncated) {
    const parts: QuoteSnapshotResponse[] = [];
    for (const slice of SNAPSHOT_WINDOWS) {
      if (slice.end <= window.start || slice.start >= window.end) continue;
      parts.push(await getQuoteSnapshots(kind, code, tradeDate, {
        ...slice, start: slice.start < window.start ? window.start : slice.start,
        end: slice.end > window.end ? window.end : slice.end,
      }, signal, view));
    }
    return { code, tradeDate, startTime: window.start, endTime: window.end,
      items: parts.flatMap(part => part.items), possiblyTruncated: parts.some(part => part.possiblyTruncated),
      lastObservedAt: parts.map(part => part.lastObservedAt).filter(Boolean).at(-1) ?? '' };
  }
  return {
    code: code.trim(), tradeDate, startTime: window.start, endTime: window.end,
    possiblyTruncated: response.possibly_truncated === true,
    lastObservedAt: text(response.last_observed_at),
    items: (Array.isArray(response.data) ? response.data : []).map(mapQuoteSnapshot).filter(row => {
      const time = Date.parse(row.observedAt);
      return row.code === code.trim() && time >= start && time < end;
    }),
  };
}

export async function getSecondSnapshots(code: string, tradeDate: string, window: SnapshotWindow, signal?: AbortSignal, asOf = Date.now(), view: SnapshotView = 'chart') {
  const snapshots = await getQuoteSnapshots('snapshots', code, tradeDate, window, signal, view);
  if (window.end !== '15:00:00' || asOf < Date.parse(`${tradeDate}T14:57:00+08:00`)) return snapshots;
  // The backend archives the final three minutes and the 15:00 uncross separately.
  const closing = await getQuoteSnapshots('auctions', code, tradeDate,
    { start: window.start > '14:57:00' ? window.start : '14:57:00', end: '15:00:01', label: '收盘竞价' }, signal, view);
  return {
    ...snapshots, items: [...snapshots.items, ...closing.items],
    possiblyTruncated: snapshots.possiblyTruncated || closing.possiblyTruncated,
    lastObservedAt: Date.parse(closing.lastObservedAt) > (Date.parse(snapshots.lastObservedAt) || 0)
      ? closing.lastObservedAt : snapshots.lastObservedAt,
  };
}

/** Fetch API-sized batches while exposing one continuous trading-day dataset. */
export function createTradingDaySnapshotLoader(code: string, tradeDate: string, options: {
  now?: () => number; onProgress?: (data: QuoteSnapshotResponse) => void;
  concurrency?: 1 | 2; request?: typeof getSecondSnapshots; view?: SnapshotView;
} = {}) {
  const now = options.now ?? Date.now;
  const request = options.request ?? getSecondSnapshots;
  const cache = new Map<string, { data: QuoteSnapshotResponse; final: boolean }>();
  let merged: QuoteSnapshotResponse | undefined;
  // 单独包含上午收盘时刻，保留午休两端的原始报价。
  const windows = [...SNAPSHOT_WINDOWS, { start: '11:30:00', end: '11:30:01', label: '午间收盘' }]
    .sort((a, b) => a.start.localeCompare(b.start));
  const timestamp = (time: string) => Date.parse(`${tradeDate}T${time}+08:00`);
  const readCache = (): QuoteSnapshotResponse => {
    if (merged) return merged;
    const batches = [...cache.values()].map(entry => entry.data);
    const items = [...new Map(batches.flatMap(batch => batch.items).map(row => [`${row.observedAt}:${row.provider}`, row])).values()]
      .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const latest = batches.map(batch => batch.lastObservedAt).filter(time => Number.isFinite(Date.parse(time)))
      .sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? '';
    return merged = { code, tradeDate, startTime: TRADING_DAY_WINDOW.start, endTime: TRADING_DAY_WINDOW.end,
      items, lastObservedAt: latest, possiblyTruncated: batches.some(batch => batch.possiblyTruncated) };
  };
  let planned = false;
  return async (signal: AbortSignal): Promise<QuoteSnapshotResponse> => {
    if (!planned && options.view === 'series') {
      // 首段优先展示；已结束的历史区间合并读取，盘中尾段仍按原窗口增量更新。
      for (const [start, end] of [['09:45:00', '10:45:00'], ['10:45:00', '11:30:00'],
        ['13:00:00', '14:00:00'], ['14:00:00', '15:00:00']]) {
        if (timestamp(end) > now()) continue;
        const first = windows.findIndex(w => w.start === start);
        const last = windows.findIndex(w => w.end === end);
        windows.splice(first, last - first + 1, { start, end, label: `${start}–${end}` });
      }
      planned = true;
    }
    const pending = windows.filter(window => timestamp(window.start) <= now() && !cache.get(window.start)?.final);
    // A single-stock chart uses two readers; multi-stock callers supply a shared slice queue.
    let index = 0;
    const worker = async () => {
      while (index < pending.length) {
        signal.throwIfAborted();
        const window = pending[index++];
        const previous = cache.get(window.start)?.data;
        let start = window.start;
        if (previous && !previous.possiblyTruncated && Number.isFinite(Date.parse(previous.lastObservedAt))) {
          const cursor = shanghaiDateTime(new Date(previous.lastObservedAt));
          if (cursor.date === tradeDate && cursor.time > start && cursor.time < window.end) start = cursor.time;
        }
        const requestedAt = now();
        const next = await request(code, tradeDate, { ...window, start }, signal, requestedAt, options.view);
        signal.throwIfAborted();
        const incremental = start !== window.start;
        const items = new Map((incremental ? previous?.items ?? [] : []).map(row => [`${row.observedAt}:${row.provider}`, row]));
        next.items.forEach(row => items.set(`${row.observedAt}:${row.provider}`, row));
        cache.set(window.start, {
          data: { ...next, startTime: window.start, items: [...items.values()],
            lastObservedAt: next.lastObservedAt || (incremental ? previous?.lastObservedAt ?? '' : '') },
          final: !next.possiblyTruncated && requestedAt >= timestamp(window.end) + 30000,
        });
        merged = undefined;
        options.onProgress?.(readCache());
      }
    };
    const results = await Promise.allSettled(Array.from({ length: options.concurrency ?? 2 }, worker));
    signal.throwIfAborted();
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw failure.reason;
    return readCache();
  };
}

/** One usable observation per second. Never substitute a stale primary for a fresh backup. */
export function selectQuoteSnapshots(rows: QuoteSnapshot[], kind: SnapshotKind): QuoteSnapshot[] {
  const bySecond = new Map<number, QuoteSnapshot>();
  for (const row of rows) {
    const time = Math.floor(Date.parse(row.observedAt) / 1000);
    if (!Number.isFinite(time) || !Number.isFinite(Date.parse(row.sourceTime)) || row.qualityIssue) continue;
    if (kind === 'auctions') {
      if (!['opening_auction_cancelable', 'opening_auction_locked', 'opening_result'].includes(row.phase)) continue;
      if (!(Number(row.bids[0]?.[0]) > 0 || Number(row.asks[0]?.[0]) > 0)) continue;
    } else if (!(Number(row.price) > 0) || !['continuous', 'closing_auction', 'session_close'].includes(row.phase)) continue;
    const previous = bySecond.get(time);
    if (!previous || Date.parse(row.sourceTime) >= Date.parse(previous.sourceTime)) bySecond.set(time, row);
  }
  return [...bySecond.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}

export function snapshotPhaseLabel(phase: string): string {
  return ({ opening_auction_cancelable: '可撤单', opening_auction_locked: '不可撤单', opening_result: '开盘结果',
    continuous: '连续交易', closing_auction: '收盘竞价', session_close: '收盘' } as Record<string, string>)[phase] ?? '行情快照';
}

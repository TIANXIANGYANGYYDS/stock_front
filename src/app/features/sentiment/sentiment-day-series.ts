import { createTradingDaySnapshotLoader, getSecondSnapshots, selectQuoteSnapshots, type QuoteSnapshotResponse } from '../../lib/quote-snapshots';
import { ApiRequestError } from '../../lib/api';
import { atConsistentSnapshot, snapshotQuery, retryable, sentimentApi, sentimentError } from './sentiment-api';
import type { SentimentEvent, SentimentScope } from './sentiment-contract';
import type { SentimentSecondEvent, SentimentSecondSeries } from './sentiment-seconds';
import { createSentimentReadQueue } from './sentiment-read-queue';

import { PRICE_EVENT_KINDS as EVENT_KIND } from './sentiment-contract';
export const SESSION_HALF = 2 * 60 * 60 * 1000;
export function sessionAxisTime(tradeDate: string, time: number) {
  const open = Date.parse(`${tradeDate}T09:30:00+08:00`);
  const afternoon = Date.parse(`${tradeDate}T13:00:00+08:00`);
  return time < afternoon ? Math.min(SESSION_HALF, time - open) : SESSION_HALF + time - afternoon;
}
export function sessionAxisLabel(time: number) {
  if (time === SESSION_HALF) return '11:30 / 13:00';
  const minutes = time / 60000 + (time < SESSION_HALF ? 570 : 660);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
}

/** The same archived observations as the single-stock seconds chart, expressed as returns. */
export function dayQuoteSeries(data: QuoteSnapshotResponse, events: SentimentEvent[]): SentimentSecondSeries {
  const samples = new Map<number, SentimentSecondSeries['points'][number]>();
  for (const row of selectQuoteSnapshots(data.items, 'snapshots')) {
    const time = Date.parse(row.observedAt);
    samples.set(Math.floor(time / 1000), { time, sourceTime: Date.parse(row.sourceTime), change_ratio: row.previousClose != null && row.previousClose > 0 && row.price != null ? row.price / row.previousClose - 1 : null });
  }
  // An invalid primary does not hide a valid backup from the same second.
  for (const row of data.items) {
    const time = Date.parse(row.observedAt), second = Math.floor(time / 1000);
    if (Number.isFinite(time) && !samples.has(second) && ['continuous', 'closing_auction', 'session_close'].includes(row.phase)) samples.set(second, { time, change_ratio: null });
  }
  const points: SentimentSecondSeries['points'] = [];
  for (const point of [...samples.values()].sort((a, b) => a.time - b.time)) {
    const time = point.time, last = points.at(-1);
    // A null marker records an absence of samples; it is never a fabricated quote.
    if (last && time - last.time > 15000) points.push({ time: last.time + 1, change_ratio: null });
    points.push(point);
  }
  return { code: data.code, points, events: quoteEventMarkers(data.code, points, events), limit_ratio: null };
}
function quoteEventMarkers(code: string, points: SentimentSecondSeries['points'], events: SentimentEvent[]) {
  const bySource = new Map<number, typeof points>();
  for (const point of points) {
    if (point.sourceTime === undefined) continue;
    const group = bySource.get(point.sourceTime) ?? [];
    group.push(point); bySource.set(point.sourceTime, group);
  }
  return events.flatMap(event => {
    if (event.code !== code || !(event.type in EVENT_KIND)) return [];
    const observed = Date.parse(event.observed_at);
    const candidates = event.source_time ? bySource.get(Date.parse(event.source_time)) ?? [] : points.filter(point => point.time === observed);
    const point = candidates.reduce<(typeof points)[number] | undefined>((best, next) => !best || Math.abs(next.time - observed) < Math.abs(best.time - observed) ? next : best, undefined);
    // Anchor only to a received quote with the event's actual source timestamp.
    return point && point.change_ratio !== null ? [{ id: event.event_id, code, time: point.time, change_ratio: point.change_ratio, observedTime: observed, sourceTime: event.source_time ? Date.parse(event.source_time) : undefined,
      kind: EVENT_KIND[event.type as keyof typeof EVENT_KIND], evidence: event.evidence, rule_version: event.rule_version, cooldown_seconds: event.cooldown_seconds } satisfies SentimentSecondEvent] : [];
  });
}

export interface DaySeriesState {
  series: SentimentSecondSeries; loaded: boolean; loading: boolean; error: string | null; eventError: string | null; truncated: boolean;
}
type Listener = () => void;
interface Entry {
  publication?: string; snapshotId?: string; revision: number; loadedRevision: number;
  code: string; day: string; scope: SentimentScope; eventBlocked: boolean; asOf: number; loadedThrough: number; state: DaySeriesState; listeners: Set<Listener>;
  load: (signal: AbortSignal) => Promise<QuoteSnapshotResponse>; controller?: AbortController; quoteData?: QuoteSnapshotResponse;
  cursor?: string; events: Map<string, SentimentEvent>; retryAt: number; permanentError: boolean;
}
type Dependencies = {
  quotes?: typeof createTradingDaySnapshotLoader;
  events?: typeof sentimentApi.events;
};

/** Every stock gets a turn: four archive time slices globally, with event reads in a separate queue. */
export function createDaySeriesStore(dependencies: Dependencies = {}) {
  const entries = new Map<string, Entry>();
  const readQuote = createSentimentReadQueue(4), readEvent = createSentimentReadQueue(2);
  const quoteLoader = dependencies.quotes ?? createTradingDaySnapshotLoader;
  const eventLoader = dependencies.events ?? sentimentApi.events;
  const notify = (entry: Entry, change: Partial<DaySeriesState>) => {
    entry.state = { ...entry.state, ...change }; entry.listeners.forEach(listener => listener());
  };
  const publishQuotes = (entry: Entry, data: QuoteSnapshotResponse) => {
    if (entry.quoteData === data) return;
    entry.quoteData = data;
    notify(entry, { series: dayQuoteSeries(data, [...entry.events.values()]), truncated: data.possiblyTruncated });
  };
  const get = (code: string, day: string, scope: SentimentScope = 'all_a') => {
    const key = `v1.1:${scope}:${day}:${code}`;
    let entry = entries.get(key);
    if (!entry) {
      entry = { code, day, scope, revision: 0, loadedRevision: -1, eventBlocked: false, asOf: 0, loadedThrough: -1, listeners: new Set(), events: new Map(), retryAt: 0, permanentError: false,
        load: undefined!, state: { series: { code, points: [], events: [], limit_ratio: null }, loaded: false, loading: false, error: null, eventError: null, truncated: false } };
      const current = entry;
      entry.load = quoteLoader(code, day, { now: () => current.asOf, concurrency: 1, view: 'series',
        request: (symbol, date, window, signal, asOf) => readQuote(signal!, () => getSecondSnapshots(symbol, date, window, signal, asOf, 'series')),
        onProgress: data => {
          if (current.controller && !current.controller.signal.aborted) publishQuotes(current, data);
        } });
      entries.set(key, entry);
    }
    return entry;
  };
  const enqueue = (entry: Entry) => {
    if (!entry.listeners.size || entry.controller || entry.permanentError || Date.now() < entry.retryAt || entry.loadedThrough >= entry.asOf && entry.loadedRevision >= entry.revision) return;
    void run(entry);
  };
  const loadEvents = async (entry: Entry, signal: AbortSignal) => {
    if (entry.eventBlocked) return;
    let rebased = false;
    for (let page = 0; page < 50; page++) {
      let result;
      try { result = await readEvent(signal, () => eventLoader({ scope: entry.scope, trade_date: entry.day, snapshot_id: entry.snapshotId, code: entry.code, after: entry.cursor, limit: 200 }, signal)); }
      catch (error) {
        if (error instanceof ApiRequestError && error.status === 409 && !rebased) {
          rebased = true;
          entry.cursor = undefined; entry.events.clear();
          result = (await atConsistentSnapshot(entry.day, meta => readEvent(signal, () => eventLoader({ ...snapshotQuery(meta), code: entry.code, limit: 200 }, signal)), signal, entry.scope)).response;
          entry.snapshotId = result.meta.snapshot_id;
        } else {
          if (!retryable(error)) { entry.eventBlocked = true; entry.cursor = undefined; }
          throw error;
        }
      }
      signal.throwIfAborted();
      for (const event of result.data.items) entry.events.set(event.event_id, event);
      if (result.data.has_more && (!result.data.next_cursor || result.data.next_cursor === entry.cursor)) throw new Error('事件分页游标未前进');
      entry.cursor = result.data.next_cursor ?? entry.cursor;
      if (!result.data.has_more) return;
    }
    throw new Error('事件记录较多，下一次更新继续加载');
  };
  const refreshEvents = async (entry: Entry, signal: AbortSignal) => {
    let eventError: string | null = entry.eventBlocked ? entry.state.eventError : null;
    try { await loadEvents(entry, signal); } catch (error) {
      if (signal.aborted) return;
      if (!retryable(error)) { entry.eventBlocked = true; entry.cursor = undefined; }
      eventError = sentimentError(error, '事件');
    }
    if (signal.aborted) return;
    const series = entry.state.series;
    notify(entry, { series: { ...series, events: quoteEventMarkers(entry.code, series.points, [...entry.events.values()]) }, eventError });
  };
  const run = async (entry: Entry) => {
    const controller = new AbortController(); entry.controller = controller;
    notify(entry, { loading: true });
    const through = entry.asOf;
    const revision = entry.revision;
    // Events can annotate already loaded slices without holding up any quote queue slot.
    const eventsTask = refreshEvents(entry, controller.signal);
    try {
      const data = await entry.load(controller.signal);
      controller.signal.throwIfAborted();
      publishQuotes(entry, data);
      notify(entry, { loaded: true, error: null });
      entry.loadedThrough = through; entry.loadedRevision = revision; entry.retryAt = 0;
    } catch (error) {
      if (!controller.signal.aborted) {
        entry.retryAt = Date.now() + 10000; entry.permanentError = !retryable(error);
        notify(entry, { error: sentimentError(error, '秒级行情') });
      }
    } finally {
      await eventsTask;
      entry.controller = undefined; notify(entry, { loading: false });
      enqueue(entry);
    }
  };
  return {
    clear() {
      for (const entry of entries.values()) { entry.listeners.clear(); entry.controller?.abort(); }
      entries.clear();
    },
    get: (code: string, day: string, scope: SentimentScope = 'all_a') => get(code, day, scope).state,
    advance(code: string, day: string, asOf: number, scope: SentimentScope = 'all_a', publication?: string, snapshotId?: string) {
      const entry = get(code, day, scope);
      if (publication && entry.publication && publication !== entry.publication) entry.revision++;
      entry.publication = publication; entry.snapshotId = snapshotId;
      entry.asOf = Math.max(entry.asOf, asOf); enqueue(entry);
    },
    subscribe(code: string, day: string, asOf: number, listener: Listener, scope: SentimentScope = 'all_a', publication?: string, snapshotId?: string) {
      const entry = get(code, day, scope); entry.listeners.add(listener);
      this.advance(code, day, asOf, scope, publication, snapshotId);
      return () => {
        entry.listeners.delete(listener);
        if (!entry.listeners.size) entry.controller?.abort();
        // Bound inactive cached days while retaining data shared by visible cards.
        if (entries.size > 48) for (const [key, old] of entries) {
          if (!old.listeners.size && !old.controller) entries.delete(key);
          if (entries.size <= 48) break;
        }
      };
    },
    reload(code: string, day: string, scope: SentimentScope = 'all_a') {
      const entry = get(code, day, scope); entry.eventBlocked = false; entry.retryAt = 0; entry.permanentError = false; entry.revision++; enqueue(entry);
    },
  };
}

export const sentimentDaySeries = createDaySeriesStore();

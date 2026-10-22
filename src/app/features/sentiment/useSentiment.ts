import { useCallback, useEffect, useRef, useState } from 'react';
import type { SentimentScope } from './sentiment-contract';
import { ApiRequestError } from '../../lib/api';
import { connectSentimentStream, loadSentimentSnapshot, retryable, sentimentError } from './sentiment-api';
import { applyStreamMessage, mergeSnapshot, type LiveSnapshot } from './sentiment-live-model';

const delay = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => {
  const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
  const timer = setTimeout(done, ms); signal.addEventListener('abort', done, { once: true });
  if (signal.aborted) done();
});
export type ConnectionState = 'loading' | 'connecting' | 'live' | 'polling' | 'historical' | 'error';
export function useSentiment(tradeDate: string | undefined, scope: SentimentScope = 'all_a') {
  const [revision, setRevision] = useState(0);
  const key = `v1.2:${scope}:${tradeDate ?? 'latest'}:${revision}`;
  const resyncRef = useRef<() => void>(() => {});
  const resync = useCallback(() => resyncRef.current(), []);
  const [store, setStore] = useState<{ key: string; snapshot: LiveSnapshot | null; connection: ConnectionState; error: string | null }>({ key: '', snapshot: null, connection: 'loading', error: null });
  useEffect(() => {
    const controller = new AbortController(), { signal } = controller;
    let lastId: string | undefined;
    const status = (connection: ConnectionState, error: string | null = null) => { if (!signal.aborted) setStore(current => ({ ...current, connection, error })); };
    setStore({ key, snapshot: null, connection: 'loading', error: null });
    let pendingLoad: Promise<void> | undefined;
    const read = async () => {
      const result = await loadSentimentSnapshot(tradeDate, signal, scope);
      if (signal.aborted) return;
      const stocks = result.response.data.groups.flatMap(group => group.levels.flatMap(level => level.stocks));
      setStore(current => ({ ...current, snapshot: mergeSnapshot(current.snapshot, { meta: result.dashboard.meta, data: { dashboard: result.dashboard.data, stocks_upsert: stocks, removed_codes: [], replace_all: true } }, tradeDate, scope), error: null }));
    };
    const load = () => pendingLoad ?? (pendingLoad = read().finally(() => { pendingLoad = undefined; }));
    resyncRef.current = () => { void load().catch(error => { if (!signal.aborted) setStore(current => ({ ...current, error: sentimentError(error) })); }); };
    const run = async () => {
      let attempts = 0;
      while (!signal.aborted) {
        try { await load(); break; }
        catch (error) {
          if (signal.aborted) return;
          // Fast publication can exhaust the bounded REST retry. A full SSE snapshot is
          // another internally consistent source for the latest day, without retry loops.
          if (!tradeDate && error instanceof ApiRequestError && error.status === 409) break;
          status('error', sentimentError(error, tradeDate ? `${tradeDate} 历史快照` : '最新情绪总览'));
          if (!retryable(error)) return;
          await delay(Math.min(30000, 5000 * 2 ** attempts++), signal);
        }
      }
      if (signal.aborted) return;
      if (tradeDate) { status('historical'); return; }
      while (!signal.aborted) {
        status('connecting');
        let retryAfter = 5000, allowReconnect = true;
        try {
          await connectSentimentStream(signal, lastId, message => {
            if (signal.aborted) return;
            if (message.type === 'unavailable') {
              retryAfter = Math.max(5000, Math.min(60000, message.payload.retry_after_seconds * 1000 || 5000));
              throw new Error('实时服务暂不可用，正在轮询已发布快照。');
            }
            if (message.id) lastId = message.id;
            setStore(current => ({ ...current, snapshot: applyStreamMessage(current.snapshot, message, undefined, scope), connection: 'live', error: null }));
          }, scope);
        } catch (error) {
          if (signal.aborted) return;
          if (error instanceof ApiRequestError && (error.status === 409 || error.status === 422)) lastId = undefined;
          allowReconnect = retryable(error) || error instanceof ApiRequestError && error.status === 409;
          status('polling', `实时连接不可用，已切换快照轮询。${sentimentError(error)}`);
        }
        // One transport at a time: stream is closed before polling; retry SSE after three polls.
        let polls = 0;
        while (!signal.aborted && (!allowReconnect || polls < 3)) {
          await delay(retryAfter, signal); if (signal.aborted) return;
          try { await load(); status('polling'); retryAfter = 5000; }
          catch (error) {
            if (signal.aborted) return;
            status('error', sentimentError(error));
            if (!retryable(error)) return;
            retryAfter = Math.min(30000, retryAfter * 2);
          }
          polls++;
        }
      }
    };
    void run();
    return () => { controller.abort(); resyncRef.current = () => {}; };
  }, [key, tradeDate, scope]);
  return { ...(store.key === key ? store : { snapshot: null, connection: 'loading' as const, error: null }), refresh: () => setRevision(value => value + 1), resync };
}

/** Request keys isolate dates, filters and pages; aborted/late responses never replace new selections. */
export function useSentimentResource<T>(key: string, loader: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const loadRef = useRef(loader); loadRef.current = loader;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null; errorStatus?: number; loading: boolean }>({ key: '', data: null, error: null, loading: false });
  useEffect(() => {
    const controller = new AbortController();
    if (!enabled) return;
    setState({ key, data: null, error: null, loading: true });
    void loadRef.current(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ key, data, error: null, loading: false });
    }).catch(error => { if (!controller.signal.aborted) setState({ key, data: null, error: sentimentError(error), errorStatus: error instanceof ApiRequestError ? error.status : undefined, loading: false }); });
    return () => controller.abort();
  }, [key, enabled, revision]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  return { ...(state.key === key && enabled ? state : { data: null, error: null, errorStatus: undefined, loading: enabled }), reload };
}

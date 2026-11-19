import { useCallback, useMemo, useRef, useState } from 'react';
import { createTradingDaySnapshotLoader, getQuoteSnapshots, getSecondSnapshots, shanghaiDateTime, TRADING_DAY_WINDOW, type QuoteSnapshotResponse, type SnapshotKind, type SnapshotWindow } from '../lib/quote-snapshots';
import { useRealtimePolling } from './useRealtimePolling';

// 已结束的竞价在页签间复用；设置有效期，让迟到补档也能重新读到。
const auctions = new Map<string, { data: QuoteSnapshotResponse; final: boolean; savedAt: number }>();
const auctionTtlMs = 30 * 60 * 1000;

const pendingAuctions = new Map<string, Promise<QuoteSnapshotResponse>>();

function saveAuction(key: string, data: QuoteSnapshotResponse, savedAt: number, final: boolean) {
  auctions.delete(key);
  auctions.set(key, { data, savedAt, final });
  if (auctions.size > 32) auctions.delete(auctions.keys().next().value!);
}

export function useQuoteSnapshots({ kind, code, tradeDate, window, enabled = true }: {
  kind: SnapshotKind;
  code: string;
  tradeDate: string;
  window: SnapshotWindow;
  enabled?: boolean;
}) {
  const queryKey = `quote-snapshots:${kind}:${code}:${tradeDate}:${window.start}:${window.end}`;
  const cache = useRef<{ key: string; data: QuoteSnapshotResponse } | null>(null);
  const request = useCallback(async (signal: AbortSignal) => {
    const startedAt = Date.now();
    const ended = startedAt >= Date.parse(`${tradeDate}T${window.end}+08:00`) + 30000;
    const saved = kind === 'auctions' ? auctions.get(queryKey) : undefined;
    const recent = saved && saved.savedAt <= startedAt && startedAt - saved.savedAt < auctionTtlMs ? saved : undefined;
    if (kind === 'auctions' && ended) {
      // 已结束时始终核对整个窗口；短暂空档稍后重查，切换页面共享正在返回的请求。
      if (recent?.final && (recent.data.items.length || startedAt - recent.savedAt < 15000)) return recent.data;
      let pending = pendingAuctions.get(queryKey);
      if (!pending) {
        pending = getQuoteSnapshots(kind, code, tradeDate, window).then(data => {
          saveAuction(queryKey, data, startedAt, !data.possiblyTruncated);
          return data;
        }).finally(() => pendingAuctions.delete(queryKey));
        pendingAuctions.set(queryKey, pending);
      }
      const completed = await pending;
      signal.throwIfAborted();
      return completed;
    }
    const previous = kind === 'auctions' ? recent?.data : cache.current?.key === queryKey ? cache.current.data : null;
    let requestedWindow = window;
    if (previous && !previous.possiblyTruncated && Number.isFinite(Date.parse(previous.lastObservedAt))) {
      const cursor = shanghaiDateTime(new Date(previous.lastObservedAt));
      // Overlap the cursor second to retain all providers and subsecond observations.
      if (cursor.date === tradeDate && cursor.time > window.start && cursor.time < window.end) {
        requestedWindow = { ...window, start: cursor.time };
      }
    }
    const next = kind === 'snapshots'
      ? await getSecondSnapshots(code, tradeDate, requestedWindow, signal)
      : await getQuoteSnapshots(kind, code, tradeDate, requestedWindow, signal);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const incremental = requestedWindow.start !== window.start;
    const merged = new Map((incremental ? previous?.items ?? [] : []).map(row => [`${row.observedAt}:${row.provider}`, row]));
    next.items.forEach(row => merged.set(`${row.observedAt}:${row.provider}`, row));
    const data = { ...next, startTime: window.start, items: [...merged.values()],
      lastObservedAt: next.lastObservedAt || (incremental ? previous?.lastObservedAt ?? '' : '') };
    cache.current = { key: queryKey, data };
    if (kind === 'auctions') saveAuction(queryKey, data, startedAt, false);
    return data;
  }, [kind, code, tradeDate, window.start, window.end, queryKey]);
  const state = useRealtimePolling({
    enabled: enabled && /^\d{6}$/.test(code) && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate),
    queryKey,
    request,
    intervalMs: kind === 'auctions' ? 2000 : 5000,
    getMarketStatus: () => {
      const current = shanghaiDateTime();
      // Keep a short grace period for the final persisted batch.
      const end = Date.parse(`${tradeDate}T${window.end}+08:00`) + 30000;
      // The realtime endpoint reports "closed" during opening auctions; use this window's own clock.
      return tradeDate < current.date || Date.now() > end ? 'closed' : 'open';
    },
  });
  // A changed query must never render the previous stock, date, or window for one frame.
  const data = enabled && state.data?.code === code && state.data.tradeDate === tradeDate
    && state.data.startTime === window.start && state.data.endTime === window.end ? state.data : null;
  return { ...state, data };
}

export function useTradingDaySnapshots({ code, tradeDate, enabled }: { code: string; tradeDate: string; enabled: boolean }) {
  const [progress, setProgress] = useState<QuoteSnapshotResponse | null>(null);
  const request = useMemo(() => createTradingDaySnapshotLoader(code, tradeDate, { onProgress: setProgress }), [code, tradeDate]);
  const state = useRealtimePolling({
    enabled: enabled && /^\d{6}$/.test(code) && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate),
    queryKey: `trading-day-snapshots:${code}:${tradeDate}`,
    request,
    intervalMs: 5000,
    getMarketStatus: () => Date.now() >= Date.parse(`${tradeDate}T${TRADING_DAY_WINDOW.end}+08:00`) + 30000 ? 'closed' : 'open',
  });
  const latest = progress?.code === code && progress.tradeDate === tradeDate ? progress : state.data;
  const data = enabled && latest?.code === code && latest.tradeDate === tradeDate ? latest : null;
  return { ...state, data };
}

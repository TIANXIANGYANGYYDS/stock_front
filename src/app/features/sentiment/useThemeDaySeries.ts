import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SentimentScope } from './sentiment-contract';
import { sentimentDaySeries } from './sentiment-day-series';

export function useThemeDaySeries(codes: string[], tradeDate: string, asOf: string, scope: SentimentScope = 'all_a', publication?: string, snapshotId?: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(document.visibilityState !== 'hidden');
  const [version, changed] = useState(0);
  const subscriptions = useRef(new Map<string, () => void>());
  const scheduledPublication = useRef<{ timer?: ReturnType<typeof setTimeout>; frame?: number }>({});
  const notify = useCallback(() => {
    const pending = scheduledPublication.current;
    // Publish responses that arrive a few frames apart in one chart update.
    if (pending.timer === undefined && pending.frame === undefined) pending.timer = setTimeout(() => {
      pending.timer = undefined; pending.frame = requestAnimationFrame(() => { pending.frame = undefined; changed(value => value + 1); });
    }, 100);
  }, []);
  const key = [...new Set(codes)].sort().join(',');
  const time = Date.parse(asOf);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '180px 0px' });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const change = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  const enabled = visible && pageVisible;
  useEffect(() => {
    const requested = new Map((enabled ? codes : []).map(code => [`${scope}:${tradeDate}:${code}`, code]));
    // A rank change must not abort the six stocks which are still on screen.
    for (const [id, stop] of subscriptions.current) if (!requested.has(id)) { stop(); subscriptions.current.delete(id); }
    for (const [id, code] of requested) if (!subscriptions.current.has(id)) {
      subscriptions.current.set(id, sentimentDaySeries.subscribe(code, tradeDate, time, notify, scope, publication, snapshotId));
    }
    changed(value => value + 1);
  }, [key, tradeDate, scope, enabled, notify]);
  useEffect(() => () => {
    subscriptions.current.forEach(stop => stop()); subscriptions.current.clear();
    const pending = scheduledPublication.current;
    if (pending.timer !== undefined) clearTimeout(pending.timer);
    if (pending.frame !== undefined) cancelAnimationFrame(pending.frame);
    pending.timer = undefined; pending.frame = undefined;
  }, []);
  useEffect(() => {
    if (enabled && Number.isFinite(time)) for (const code of codes) sentimentDaySeries.advance(code, tradeDate, time, scope, publication, snapshotId);
  }, [key, tradeDate, scope, time, enabled, publication, snapshotId]);
  const orderedCodes = codes.join(',');
  const states = useMemo(() => codes.map(code => sentimentDaySeries.get(code, tradeDate, scope)), [orderedCodes, tradeDate, scope, version]);
  const curves = useRef(states.map(state => state.series));
  if (curves.current.length !== states.length || states.some((state, index) => state.series.code !== curves.current[index]?.code || state.series.points !== curves.current[index]?.points)) {
    curves.current = states.map(state => state.series);
  }
  return { containerRef, states, curves: curves.current, started: states.filter(state => state.series.points.length > 0).length,
    loading: states.some(state => state.loading), loaded: states.filter(state => state.loaded).length,
    error: states.find(state => state.error)?.error ?? null, eventError: states.find(state => state.eventError)?.eventError ?? null,
    truncated: states.some(state => state.truncated),
    retry: () => codes.forEach(code => sentimentDaySeries.reload(code, tradeDate, scope)) };
}

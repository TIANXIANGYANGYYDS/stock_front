import { useEffect, useRef, useState } from 'react';
import type { SentimentMeta, SentimentStock, ThemeStats } from './sentiment-contract';
import { retryable, sentimentError } from './sentiment-api';
import { loadThemeMembers } from './sentiment-members';
import { observationKey, publicationKey } from './sentiment-publication';
import { ApiRequestError } from '../../lib/api';

// Bound requests across visible cards; each job reads a single theme's pages in sequence.
const pending: (() => void)[] = [];
let active = 0;
const drain = () => { while (active < 3 && pending.length) pending.shift()!(); };
function schedule<T>(signal: AbortSignal, task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { const index = pending.indexOf(start); if (index >= 0) pending.splice(index, 1); reject(signal.reason); };
    const start = () => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) { reject(signal.reason); return; }
      active++;
      void task().then(resolve, reject).finally(() => { active--; drain(); });
    };
    if (signal.aborted) { reject(signal.reason); return; }
    signal.addEventListener('abort', abort, { once: true }); pending.push(start); drain();
  });
}

type MemberState = { key: string; items: SentimentStock[] | null; meta: SentimentMeta | null; total: number; loading: boolean; error: string | null; theme?: ThemeStats; complete?: boolean };
export function useThemeMembers(themeId: string, meta: SentimentMeta, mode: 'top' | 'all' = 'top', onConflict?: () => void) {
  const containerRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false), [pageVisible, setPageVisible] = useState(document.visibilityState !== 'hidden');
  const [revision, setRevision] = useState(0);
  const key = `${observationKey(meta)}:${themeId}:${mode}`;
  const publication = publicationKey(meta);
  const [state, setState] = useState<MemberState>({ key: '', items: null, meta: null, total: 0, loading: true, error: null });
  const latest = useRef(meta); latest.current = meta;
  const conflict = useRef(onConflict); conflict.current = onConflict;
  const requested = useRef<() => void>(() => {});
  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '180px 0px' });
    observer.observe(containerRef.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const change = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!visible || !pageVisible) return;
    const controller = new AbortController(), { signal } = controller;
    let busy = false, rerun = false, blocked = false, conflictAt: string | undefined, retryAt = 0, completedId: string | undefined;
    const load = async () => {
      const basis = latest.current, version = publicationKey(basis);
      if (conflictAt && conflictAt !== version) { blocked = false; conflictAt = undefined; retryAt = 0; }
      if (signal.aborted || busy || blocked || Date.now() < retryAt || version === completedId) return;
      busy = true;
      setState(current => current.key === key ? { ...current, loading: true }
        : { key, items: null, meta: null, total: 0, loading: true, error: null });
      try {
        const result = await schedule(signal, () => loadThemeMembers(themeId, basis, signal, mode));
        signal.throwIfAborted(); completedId = publicationKey(result.meta);
        if (version !== publicationKey(latest.current)) { rerun = true; return; }
        setState({ key, items: result.data.items, meta: result.meta, total: result.data.total, theme: result.data.theme, complete: result.data.complete, loading: false, error: null });
      } catch (error) {
        if (!signal.aborted) {
          blocked = !retryable(error); retryAt = Date.now() + 10000;
          setState(current => ({ ...current, loading: false, error: sentimentError(error, '题材成员') }));
          if (error instanceof ApiRequestError && error.status === 409) { conflictAt = version; conflict.current?.(); }
        }
      } finally { busy = false; if (rerun) { rerun = false; void load(); } }
    };
    // Snapshot changes coalesce while a page sequence is in flight, instead of aborting it every 5 s.
    requested.current = () => { if (busy) rerun = true; else void load(); };
    void load();
    return () => { controller.abort(); requested.current = () => {}; };
  }, [key, themeId, mode, visible, pageVisible, revision]);
  useEffect(() => { requested.current(); }, [publication]);
  const current: MemberState = state.key === key ? state : { key, items: null, meta: null, total: 0, loading: true, error: null };
  return { ...current, containerRef, retry: () => setRevision(value => value + 1) };
}

import { useCallback, useEffect, useRef, useState } from 'react';

export interface RealtimePollingOptions<T> {
  enabled?: boolean;
  queryKey: string;
  request: (signal: AbortSignal) => Promise<T>;
  getMarketStatus: (data: T) => string;
  intervalMs?: number;
}

export interface RealtimePollingState<T> {
  data: T | null;
  initialLoading: boolean;
  refreshing: boolean;
  delayed: boolean;
  error: string | null;
  marketStatus: string;
  lastSuccessAt: number | null;
  refresh: () => void;
}

export function useRealtimePolling<T>({
  enabled = true,
  queryKey,
  request,
  getMarketStatus,
  intervalMs = 5000,
}: RealtimePollingOptions<T>): RealtimePollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [initialLoading, setInitialLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [delayed, setDelayed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketStatus, setMarketStatus] = useState('');
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const requestRef = useRef(request);
  const statusRef = useRef(getMarketStatus);
  const executeRef = useRef<() => void>(() => undefined);
  requestRef.current = request;
  statusRef.current = getMarketStatus;

  const refresh = useCallback(() => executeRef.current(), []);

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    let inFlight = false;
    let refreshQueued = false;
    let hasData = false;
    let lastMarketStatus = '';

    const clearTimer = () => {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
    };

    const schedule = () => {
      clearTimer();
      if (disposed || !enabled || document.visibilityState === 'hidden') return;
      timer = window.setTimeout(execute, intervalMs);
    };

    const execute = () => {
      clearTimer();
      if (disposed || !enabled || document.visibilityState === 'hidden') return;
      if (inFlight) {
        refreshQueued = true;
        return;
      }
      inFlight = true;
      controller = new AbortController();
      if (hasData) setRefreshing(true);
      else setInitialLoading(true);
      let outcome: 'success' | 'failure' | 'abort' = 'success';
      void Promise.resolve()
        .then(() => requestRef.current(controller!.signal))
        .then((nextData) => {
          if (disposed) return;
          const nextStatus = statusRef.current(nextData);
          hasData = true;
          lastMarketStatus = nextStatus;
          setData(nextData);
          setMarketStatus(nextStatus);
          setLastSuccessAt(Date.now());
          setDelayed(false);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (disposed) return;
          if (caught instanceof DOMException && caught.name === 'AbortError') {
            outcome = 'abort';
            return;
          }
          outcome = 'failure';
          setDelayed(true);
          setError(hasData ? '数据可能延迟' : '行情暂不可用');
        })
        .finally(() => {
          if (disposed) return;
          inFlight = false;
          controller = null;
          setInitialLoading(false);
          setRefreshing(false);
          if (refreshQueued && document.visibilityState !== 'hidden') {
            refreshQueued = false;
            execute();
            return;
          }
          refreshQueued = false;
          if (outcome !== 'abort' && lastMarketStatus !== 'closed') {
            schedule();
          }
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        refreshQueued = false;
        clearTimer();
        controller?.abort();
        return;
      }
      execute();
    };
    const handleFocus = () => execute();

    setData(null);
    setMarketStatus('');
    setLastSuccessAt(null);
    setDelayed(false);
    setError(null);
    setInitialLoading(enabled);
    setRefreshing(false);
    executeRef.current = execute;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    execute();

    return () => {
      disposed = true;
      refreshQueued = false;
      clearTimer();
      controller?.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      executeRef.current = () => undefined;
    };
  }, [enabled, intervalMs, queryKey]);

  return {
    data,
    initialLoading,
    refreshing,
    delayed,
    error,
    marketStatus,
    lastSuccessAt,
    refresh,
  };
}

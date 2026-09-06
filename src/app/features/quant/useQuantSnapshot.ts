import { useCallback, useEffect, useRef, useState } from 'react';
import { getQuantOverview } from './quant-api';
import { quantErrorMessage } from './quant-format';
import type { QuantOverviewData } from './quant-types';

const QUANT_POLL_INTERVAL_MS = 60_000;
interface SnapshotResult {
  key: string;
  data: QuantOverviewData | null;
  loading: boolean;
  error: string | null;
}

export function useQuantSnapshot(strategyId: string, enabled: boolean, tradeDate = '', pollLatest = true, revision = '') {
  const key = JSON.stringify([strategyId, tradeDate, pollLatest, revision]);
  const [result, setResult] = useState<SnapshotResult>({ key: '', data: null, loading: true, error: null });
  const [resetCount, setResetCount] = useState(0);
  const actions = useRef({ refresh: () => {}, recover: () => {} });
  const refresh = useCallback(() => actions.current.refresh(), []);
  const recoverSnapshot = useCallback(() => actions.current.recover(), []);

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let sequence = 0;
    let recoveryUsed = false;
    let halted = false;
    let completed = false;

    const clearTimer = () => { window.clearTimeout(timer); timer = undefined; };
    const run = (clearData: boolean) => {
      clearTimer();
      controller?.abort();
      if (!enabled || !strategyId || disposed || halted) return;
      if (clearData) setResetCount(value => value + 1);
      const requestId = ++sequence;
      completed = false;
      const current = new AbortController();
      controller = current;
      setResult(previous => ({
        key, data: !clearData && previous.key === key ? previous.data : null, loading: true, error: null,
      }));
      void getQuantOverview(strategyId, tradeDate || undefined, { signal: current.signal })
        .then(data => {
          if (disposed || current.signal.aborted || requestId !== sequence) return;
          completed = true;
          setResult({ key, data, loading: false, error: null });
        })
        .catch(error => {
          if (disposed || current.signal.aborted || requestId !== sequence) return;
          completed = true;
          // Keep no successful-looking account figures on a failed refresh.
          setResult({ key, data: null, loading: false, error: quantErrorMessage(error) });
        })
        .finally(() => {
          if (disposed || current.signal.aborted || requestId !== sequence || halted) return;
          if (pollLatest && !tradeDate && document.visibilityState !== 'hidden') timer = window.setTimeout(() => run(false), QUANT_POLL_INTERVAL_MS);
        });
    };

    actions.current = {
      refresh: () => { recoveryUsed = false; halted = false; run(true); },
      recover: () => {
        if (disposed || halted) return;
        clearTimer();
        controller?.abort();
        if (recoveryUsed) {
          halted = true;
          ++sequence;
          setResult({ key, data: null, loading: false, error: '快照持续变化，已暂停自动重试。请手动刷新后继续。' });
          return;
        }
        recoveryUsed = true;
        run(true);
      },
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { clearTimer(); controller?.abort(); }
      else if (!halted && ((pollLatest && !tradeDate) || !completed)) run(false);
    };
    setResult({ key, data: null, loading: enabled, error: null });
    if (enabled) run(true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
      actions.current = { refresh: () => {}, recover: () => {} };
    };
  }, [key, enabled, strategyId, tradeDate, pollLatest]);

  const matches = enabled && result.key === key;
  const data = matches ? result.data : null;
  return {
    data,
    initialLoading: enabled && (!matches || (result.loading && !data)),
    refreshing: matches && result.loading && !!data,
    error: matches ? result.error : null,
    refresh, recoverSnapshot, resetCount,
  };
}


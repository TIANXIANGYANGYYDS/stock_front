import { useEffect, useRef, useState } from 'react';
import { executionRangeKey, loadQuantExecutionRange } from './quant-execution-range';
import { quantExecutionRangeErrorMessage } from './quant-format';
import type { QuantExecutionRange, QuantExecutionRangeQuery } from './quant-execution-range-types';

export function useQuantExecutionRange(query: QuantExecutionRangeQuery | null) {
  const key = query ? executionRangeKey(query) : '';
  const [revision, setRevision] = useState(0);
  const active = useRef({ key, generation: 0 });
  if (active.current.key !== key) active.current = { key, generation: active.current.generation + 1 };
  const requestKey = JSON.stringify([key, active.current.generation, revision]);
  const [result, setResult] = useState<{ key: string; data: QuantExecutionRange | null; error: string | null } | null>(null);
  const cache = useRef(new Map<string, QuantExecutionRange>());
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    let poll: number | undefined;
    const timer = window.setTimeout(() => {
      void loadQuantExecutionRange(query, { signal: controller.signal, cached: cache.current.get(key), onConflict: () => cache.current.delete(key) })
        .then(data => {
          if (controller.signal.aborted) return;
          cache.current.delete(key);
          cache.current.set(key, data);
          if (cache.current.size > 20) cache.current.delete(cache.current.keys().next().value!);
          setResult({ key: requestKey, data, error: null });
          poll = window.setTimeout(() => { if (document.visibilityState !== 'hidden') setRevision(value => value + 1); }, 60_000);
        }).catch(error => {
          if (controller.signal.aborted) return;
          cache.current.delete(key);
          setResult({ key: requestKey, data: null, error: quantExecutionRangeErrorMessage(error) });
        });
    }, 250);
    const onVisible = () => { if (document.visibilityState === 'visible') setRevision(value => value + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { controller.abort(); window.clearTimeout(timer); window.clearTimeout(poll); document.removeEventListener('visibilitychange', onVisible); };
  }, [requestKey]);
  const current = key && result?.key === requestKey ? result : null;
  return { key: requestKey, data: current?.data ?? null, error: current?.error ?? null, loading: !!key && !current, refresh: () => setRevision(value => value + 1) };
}

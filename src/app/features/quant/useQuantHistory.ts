import { useEffect, useState } from 'react';
import { ApiRequestError } from '../../lib/api';
import { quantErrorMessage } from './quant-format';
import { loadQuantPerformance } from './quant-records';
import type { QuantOverviewData, QuantPerformancePoint } from './quant-types';

/** One in-memory history supplies both date choices and the chart, tied to the latest snapshot. */
export function useQuantHistory(snapshot: QuantOverviewData | null, refreshRevision: number, onSnapshotConflict: () => void) {
  const key = JSON.stringify([snapshot?.strategy_id, snapshot?.trade_date, snapshot?.snapshot_id,
    snapshot?.recording.start_date, snapshot?.recording.history_rebased_at, refreshRevision]);
  const [result, setResult] = useState<{ key: string; points: QuantPerformancePoint[] | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    const controller = new AbortController();
    void loadQuantPerformance(snapshot, { signal: controller.signal }).then(points => {
      if (!controller.signal.aborted) setResult({ key, points, error: null });
    }).catch(error => {
      if (controller.signal.aborted) return;
      setResult({ key, points: null, error: quantErrorMessage(error) });
      if (error instanceof ApiRequestError && error.status === 409) onSnapshotConflict();
    });
    return () => controller.abort();
  }, [key, onSnapshotConflict]);
  const current = snapshot && result?.key === key ? result : null;
  return { key, points: current?.points ?? null, error: current?.error ?? null };
}

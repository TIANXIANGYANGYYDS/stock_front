import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceState } from '../../hooks/useWorkspaceState';
import { getQuantStrategies } from '../quant/quant-api';
import { useQuantExecutionRange } from '../quant/useQuantExecutionRange';
import { quantErrorMessage } from '../quant/quant-format';
import type { QuantStrategy } from '../quant/quant-types';
import { buildExecutionMarkers } from './execution-markers';
import type { ChartBar } from './chart-data';

export function useChartExecutions(code: string, bars: ChartBar[], daily: boolean) {
  const [enabled, setEnabled] = useWorkspaceState('chart.executions.enabled', true);
  const [selectedId, setSelectedId] = useWorkspaceState('chart.executions.strategy', '');
  const [action, setAction] = useWorkspaceState<'' | 'buy' | 'sell'>('chart.executions.action', '');
  const [catalog, setCatalog] = useState<QuantStrategy[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  useEffect(() => {
    if (!enabled || !daily) return;
    const controller = new AbortController();
    setCatalog(null); setCatalogError(null);
    void getQuantStrategies({ signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setCatalog(response.items);
    }).catch(error => { if (!controller.signal.aborted) setCatalogError(quantErrorMessage(error)); });
    return () => controller.abort();
  }, [enabled, daily, catalogRevision]);
  const strategy = catalog?.find(item => item.id === selectedId) ?? catalog?.[0];
  const [custom, setCustom] = useState<{ code: string; start: string; end: string } | null>(null);
  // Query the loaded daily-bar span once; panning and zooming reuse its execution markers locally.
  const startDate = custom?.code === code ? custom.start : bars[0]?.time ?? '';
  const endDate = custom?.code === code ? custom.end : bars.at(-1)?.time ?? '';
  const query = enabled && daily && strategy && /^\d{6}$/.test(code) && startDate && endDate
    ? { strategyId: strategy.id, code, startDate, endDate, action } : null;
  const result = useQuantExecutionRange(query);
  const model = useMemo(() => buildExecutionMarkers(result.data?.items ?? [], bars.map(bar => bar.time)), [result.data, bars]);
  const [selection, setSelection] = useState<{ key: string; date: string | null } | null>(null);
  const open = !!result.data && enabled && daily && selection?.key === result.key;
  const showDetails = (date: string | null = null) => setSelection({ key: result.key, date });
  const openMarker = (id: string | undefined, date: string | null) => {
    const group = model.groups.find(item => item.id === id || item.date === date);
    if (group) showDetails(group.date);
  };
  return { enabled, setEnabled, catalog, strategy, setSelectedId, action, setAction, code, startDate, endDate,
    setRange: (start: string, end: string) => setCustom({ code, start, end }), resetRange: () => setCustom(null), custom: custom?.code === code,
    result, model, catalogError, open, selectedDate: selection?.date ?? null, showDetails, openMarker,
    close: () => setSelection(null), retry: () => { if (catalogError || !catalog) setCatalogRevision(value => value + 1); else result.refresh(); },
  };
}
export type ChartExecutionState = ReturnType<typeof useChartExecutions>;

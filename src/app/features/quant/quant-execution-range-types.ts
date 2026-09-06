import type { QuantExecution, QuantRecording } from './quant-types';

/** v1.2 range identity is separate from each execution's source-day snapshot. */
export interface QuantExecutionRangeItem extends Omit<QuantExecution, 'event_id' | 'status'> {
  event_id: string;
  status?: string | null;
  trade_date?: string | null;
  snapshot_id?: string | null;
  recording?: QuantRecording | null;
  execution_kind?: 'shadow_simulation' | null;
  marker_type?: 'simulated_execution' | null;
  price_basis?: 'recorded_execution_price' | null;
}

export interface QuantExecutionHistory {
  covered_start_date?: string | null;
  covered_end_date?: string | null;
  trade_day_count?: number | null;
  recording_start_dates?: string[] | null;
  recording_modes?: string[] | null;
  strategy_versions?: string[] | null;
  computed_at?: string | null;
  history_rebased_at?: string | null;
  accounting_rebased_at?: string | null;
  incomplete_trade_dates?: string[] | null;
}

export interface QuantExecutionRangePage {
  schema_version: string;
  strategy_id: string;
  strategy_name: string;
  query_mode: 'date_range';
  code: string;
  action: 'buy' | 'sell' | null;
  start_date: string;
  end_date: string;
  trade_date: null;
  history_version: string;
  snapshot_id: string;
  execution_kind: 'shadow_simulation';
  history: QuantExecutionHistory;
  items: QuantExecutionRangeItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface QuantExecutionRangeQuery {
  strategyId: string;
  code: string;
  startDate: string;
  endDate: string;
  action?: 'buy' | 'sell' | '';
}
export type QuantExecutionRange = Omit<QuantExecutionRangePage, 'page' | 'page_size'>;

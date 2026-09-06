// v1.1 public-identity contract, verified against the configured backend OpenAPI.

export interface QuantStrategy {
  id: string;
  name: string;
  execution_kind?: "shadow_simulation";
}

export interface QuantStrategyList {
  items: Array<QuantStrategy>;
  total: number;
}

export interface QuantStrategyDetail {
  id: string;
  name: string;
  execution_kind?: "shadow_simulation";
  version?: string | null;
  macd_parameters?: Array<number>;
  intraday_interval?: string | null;
  minimum_shrink_ratio?: number | null;
  confirmation_bars?: number | null;
  buy_filter?: Record<string, unknown>;
  exit_policy?: string | null;
  recording_start_date?: string | null;
}

export interface QuantExecutionRule {
  mode?: string | null;
  initial_cash_per_stock?: number | null;
  slippage_rate?: number | null;
  commission_rate?: number | null;
  stamp_duty_rate?: number | null;
  lot_size?: number | null;
  settlement?: string | null;
  price_limit?: string | null;
}

export interface QuantTimelineEntry {
  stage: string;
  status: string;
  at?: string | null;
}

export interface QuantRecording {
  start_date?: string | null;
  mode?: "historical_replay" | "live" | "unknown";
  market_data_trade_date?: string | null;
  computed_at?: string | null;
  data_kind?: string | null;
  strategy_version?: string | null;
  reference_price_method?: string | null;
  historical_bar_policy?: string | null;
  history_rebased_at?: string | null;
  accounting_rebased_at?: string | null;
  execution_kind?: "shadow_simulation";
}

export interface QuantPreparationQuality extends Record<string, unknown> {
  historical_bar_source_counts?: Record<string, number>;
  historical_reference_counts?: Record<string, number>;
}

export interface QuantRuntime {
  data_status_detail?: string | null;
  schema_version?: string | null;
  mode?: string | null;
  last_complete_bar_at?: string | null;
  next_evaluation_at?: string | null;
  expected_complete_bar_count?: number | null;
  bars_per_complete_day?: number | null;
  observation_count?: number | null;
  complete_observation_count?: number | null;
  incomplete_observation_count?: number | null;
  tracked_code_count?: number | null;
  source?: Record<string, unknown>;
  preparation_quality?: QuantPreparationQuality;
  resource_limits?: Record<string, unknown>;
  observation_state_counts?: Record<string, number>;
  last_error?: string | null;
  last_error_at?: string | null;
  version?: number | null;
  evaluated_at?: string | null;
  last_valuation_at?: string | null;
  data_status?: "waiting_open" | "waiting_data" | "fresh" | "partial" | "closed" | "closed_partial" | "error" | "unknown";
  incomplete_code_count?: number | null;
  incomplete_codes?: Array<string>;
}

export interface QuantSummary {
  watching_count?: number | null;
  not_triggered_count?: number | null;
  sell_candidate_count?: number | null;
  realized_return?: number | null;
  gross_unrealized_pnl?: number | null;
  gross_unrealized_return?: number | null;
  unrealized_return?: number | null;
  holding_market_day_pnl?: number | null;
  holding_market_day_return?: number | null;
  open_position_account_day_pnl?: number | null;
  open_position_account_day_return?: number | null;
  closed_position_account_day_pnl?: number | null;
  closed_position_account_day_return?: number | null;
  return_basis?: string | null;
  account_count?: number | null;
  initial_capital?: number | null;
  capital_inflow?: number | null;
  cash_balance?: number | null;
  market_value?: number | null;
  total_assets?: number | null;
  total_pnl?: number | null;
  total_return?: number | null;
  realized_pnl?: number | null;
  unrealized_pnl?: number | null;
  account_day_pnl?: number | null;
  account_day_return?: number | null;
  observation_count?: number | null;
  preselection_count?: number | null;
  buy_count?: number | null;
  sell_count?: number | null;
  holding_count?: number | null;
  t1_locked_holding_count?: number | null;
  closed_trade_count?: number | null;
  signal_count?: number | null;
  pending_signal_count?: number | null;
  rejected_signal_count?: number | null;
  buy_notional?: number | null;
  sell_notional?: number | null;
  turnover?: number | null;
  total_fees?: number | null;
  net_cash_flow?: number | null;
}

export interface QuantObservationSummary {
  count?: number | null;
  state_counts?: Partial<Record<"watching" | "holding" | "signal_confirmed" | "pending_execution" | "filled" | "rejected" | "not_triggered" | "unknown", number>>;
  detail_state_counts?: Record<string, number>;
}

export interface QuantExecutionAttempt {
  attempt_at?: string | null;
  execution_bar_end_at?: string | null;
  reference_open?: number | null;
  daily_price_limit?: number | null;
  status?: string | null;
  reason?: string | null;
}

export interface QuantSignal {
  code: string;
  name?: string | null;
  reason?: string | null;
  observation_before_date?: string | null;
  observation_date?: string | null;
  reference_histogram?: number | null;
  provisional_dif?: number | null;
  provisional_dea?: number | null;
  provisional_histogram?: number | null;
  shrink_ratio?: number | null;
  adx_14?: number | null;
  adx_14_3_days_ago?: number | null;
  factor_completed_date?: string | null;
  factor_comparison_date?: string | null;
  status_detail?: string | null;
  minimum_shrink_ratio?: number | null;
  confirmation_count?: number | null;
  execution_reference_price?: number | null;
  attempt_count?: number | null;
  attempts?: Array<QuantExecutionAttempt>;
  exit_reason?: string | null;
  deferred_from?: string | null;
  estimated_net_return?: number | null;
  signal_id?: string | null;
  action?: "buy" | "sell" | null;
  status?: "pending_execution" | "filled" | "rejected" | "cancelled" | "unknown";
  signal_at?: string | null;
  signal_price?: number | null;
  execution_at?: string | null;
  execution_price?: number | null;
  shares?: number | null;
}

export interface QuantSignalSummary {
  count?: number | null;
  recent_items?: Array<QuantSignal>;
}

export interface QuantOverviewData {
  schema_version?: "1.1";
  source_schema_version?: string | null;
  strategy_id: string;
  strategy_name: string;
  trade_date: string;
  snapshot_id: string;
  updated_at?: string | null;
  currency?: "CNY";
  timezone?: "Asia/Shanghai";
  execution_kind?: "shadow_simulation";
  strategy: QuantStrategyDetail;
  selection_date?: string | null;
  generated_at?: string | null;
  execution_rule: QuantExecutionRule;
  timeline?: Array<QuantTimelineEntry>;
  status?: "waiting_open" | "monitoring" | "closed" | "error" | "unknown";
  recording: QuantRecording;
  runtime: QuantRuntime;
  summary: QuantSummary;
  observation_summary: QuantObservationSummary;
  signal_summary: QuantSignalSummary;
}

export interface QuantCandidate {
  code: string;
  name?: string | null;
  reason?: string | null;
  reference_price?: number | null;
  status?: string | null;
}

export interface QuantCandidatePool {
  count: number;
  items: Array<QuantCandidate>;
}

export interface QuantExitDecision {
  code: string;
  name?: string | null;
  at?: string | null;
  entry_at?: string | null;
  state_before?: string | null;
  state_after?: string | null;
  action?: string | null;
  reason?: string | null;
  original_sell?: boolean | null;
  deferred_from?: string | null;
  adx_state?: string | null;
  adx?: number | null;
  adx_3_days_ago?: number | null;
  factor_completed_date?: string | null;
  provisional_dif?: number | null;
  provisional_histogram?: number | null;
  allow_delay?: boolean | null;
  data_anomaly?: boolean | null;
  quote_price?: number | null;
  quote_net_proceeds?: number | null;
  entry_cost?: number | null;
  estimated_net_return?: number | null;
}

export interface QuantExitDecisionPool {
  count: number;
  items: Array<QuantExitDecision>;
}

export interface QuantAccount {
  code: string;
  name?: string | null;
  initial_capital?: number | null;
  cash_balance?: number | null;
  market_value?: number | null;
  total_assets?: number | null;
  realized_pnl?: number | null;
  unrealized_pnl?: number | null;
  total_pnl?: number | null;
  total_return?: number | null;
  has_position?: boolean | null;
  shares?: number | null;
  marked_at?: string | null;
}

export interface QuantAccountPool {
  available: boolean;
  count: number;
  items: Array<QuantAccount>;
}

export interface QuantObservation {
  code: string;
  name?: string | null;
  reason?: string | null;
  observation_before_date?: string | null;
  observation_date?: string | null;
  reference_histogram?: number | null;
  provisional_dif?: number | null;
  provisional_dea?: number | null;
  provisional_histogram?: number | null;
  shrink_ratio?: number | null;
  adx_14?: number | null;
  adx_14_3_days_ago?: number | null;
  factor_completed_date?: string | null;
  factor_comparison_date?: string | null;
  data_status_detail?: string | null;
  state_detail?: string | null;
  condition_met?: boolean | null;
  consecutive_confirmations?: number | null;
  required_confirmations?: number | null;
  last_complete_bar_at?: string | null;
  adx_buy_allowed?: boolean | null;
  adjustment_factor?: number | null;
  exit_state?: string | null;
  action?: "buy" | "sell" | "hold" | null;
  state?: "watching" | "holding" | "signal_confirmed" | "pending_execution" | "filled" | "rejected" | "not_triggered" | "unknown";
  data_status?: "waiting_open" | "waiting_data" | "fresh" | "partial" | "closed" | "closed_partial" | "error" | "unknown";
  signal_id?: string | null;
}

export interface QuantObservationPool {
  count: number;
  items: Array<QuantObservation>;
}

export interface QuantSignalPool {
  count: number;
  items: Array<QuantSignal>;
}

export interface QuantExecution {
  code: string;
  name?: string | null;
  reason?: string | null;
  execution_reference_price?: number | null;
  execution_price_source?: string | null;
  previous_close?: number | null;
  daily_price_limit?: number | null;
  execution_bar_low?: number | null;
  execution_bar_high?: number | null;
  slippage_rate?: number | null;
  event_id?: string | null;
  action?: "buy" | "sell" | null;
  status?: "filled" | "unknown";
  signal_at?: string | null;
  signal_price?: number | null;
  execution_at?: string | null;
  execution_price?: number | null;
  shares?: number | null;
  notional?: number | null;
  commission?: number | null;
  stamp_duty?: number | null;
  total_fees?: number | null;
  cash_flow?: number | null;
}

export interface QuantExecutionPool {
  interval?: string | null;
  count: number;
  items: Array<QuantExecution>;
}

export interface QuantHolding {
  code: string;
  name?: string | null;
  entry_signal_at?: string | null;
  entry_signal_price?: number | null;
  entry_reference_price?: number | null;
  gross_total_pnl?: number | null;
  gross_total_return?: number | null;
  shares?: number | null;
  entry_event_id?: string | null;
  entry_execution_at?: string | null;
  entry_execution_price?: number | null;
  entry_notional?: number | null;
  buy_commission?: number | null;
  cost_basis?: number | null;
  marked_at?: string | null;
  mark_price?: number | null;
  previous_close?: number | null;
  market_value?: number | null;
  unrealized_pnl?: number | null;
  unrealized_return?: number | null;
  total_pnl?: number | null;
  total_return?: number | null;
  market_day_pnl?: number | null;
  market_day_return?: number | null;
  account_day_pnl?: number | null;
  account_day_return?: number | null;
  sellable_today?: boolean | null;
  t1_locked?: boolean | null;
}

export interface QuantHoldingPool {
  count: number;
  items: Array<QuantHolding>;
}

export interface QuantClosedTrade {
  code: string;
  name?: string | null;
  entry_signal_at?: string | null;
  exit_signal_at?: string | null;
  entry_signal_price?: number | null;
  exit_signal_price?: number | null;
  entry_reference_price?: number | null;
  exit_reference_price?: number | null;
  shares?: number | null;
  entry_event_id?: string | null;
  exit_event_id?: string | null;
  entry_execution_at?: string | null;
  exit_execution_at?: string | null;
  entry_execution_price?: number | null;
  exit_execution_price?: number | null;
  entry_notional?: number | null;
  exit_notional?: number | null;
  buy_commission?: number | null;
  sell_commission?: number | null;
  stamp_duty?: number | null;
  total_fees?: number | null;
  gross_pnl?: number | null;
  net_pnl?: number | null;
  net_return?: number | null;
}

export interface QuantClosedTradePool {
  count: number;
  items: Array<QuantClosedTrade>;
}

export interface QuantDailyResult {
  schema_version?: "1.1";
  source_schema_version?: string | null;
  strategy_id: string;
  strategy_name: string;
  trade_date: string;
  snapshot_id: string;
  updated_at?: string | null;
  currency?: "CNY";
  timezone?: "Asia/Shanghai";
  execution_kind?: "shadow_simulation";
  strategy: QuantStrategyDetail;
  selection_date?: string | null;
  generated_at?: string | null;
  execution_rule: QuantExecutionRule;
  timeline?: Array<QuantTimelineEntry>;
  status?: "waiting_open" | "monitoring" | "closed" | "error" | "unknown";
  recording: QuantRecording;
  runtime: QuantRuntime;
  summary: QuantSummary;
  observation_summary: QuantObservationSummary;
  signal_summary: QuantSignalSummary;
  preselection_pool: QuantCandidatePool;
  sell_candidate_pool: QuantCandidatePool;
  exit_decisions: QuantExitDecisionPool;
  accounts: QuantAccountPool;
  observation_pool: QuantObservationPool;
  signals: QuantSignalPool;
  intraday_trading: QuantExecutionPool;
  holding_pool: QuantHoldingPool;
  closed_trades: QuantClosedTradePool;
}

export interface QuantPerformancePoint {
  schema_version?: "1.1";
  source_schema_version?: string | null;
  strategy_id: string;
  strategy_name: string;
  trade_date: string;
  snapshot_id: string;
  updated_at?: string | null;
  currency?: "CNY";
  timezone?: "Asia/Shanghai";
  execution_kind?: "shadow_simulation";
  recording: QuantRecording;
  runtime: QuantRuntime;
  summary: QuantSummary;
}

export interface QuantPerformancePage {
  strategy_id: string;
  strategy_name: string;
  items: Array<QuantPerformancePoint>;
  total: number;
  page: number;
  page_size: number;
}

export interface QuantAccountPage {
  schema_version?: "1.1";
  source_schema_version?: string | null;
  strategy_id: string;
  strategy_name: string;
  trade_date: string;
  snapshot_id: string;
  updated_at?: string | null;
  currency?: "CNY";
  timezone?: "Asia/Shanghai";
  execution_kind?: "shadow_simulation";
  total: number;
  page: number;
  page_size: number;
  available: boolean;
  items: Array<QuantAccount>;
}

export interface QuantPaginatedResponse<T> {
  schema_version?: '1.1';
  source_schema_version?: string | null;
  strategy_id: string;
  strategy_name: string;
  trade_date: string;
  snapshot_id: string;
  updated_at?: string | null;
  currency?: 'CNY';
  timezone?: 'Asia/Shanghai';
  execution_kind?: 'shadow_simulation';
  available?: boolean;
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type QuantObservationState = NonNullable<QuantObservation['state']>;
export type QuantSignalStatus = NonNullable<QuantSignal['status']>;
export type QuantDataStatus = NonNullable<QuantRuntime['data_status']>;
export interface QuantResourceItems {
  accounts: QuantAccount;
  observations: QuantObservation;
  signals: QuantSignal;
  executions: QuantExecution;
  holdings: QuantHolding;
  'closed-trades': QuantClosedTrade;
  preselections: QuantCandidate;
  'sell-candidates': QuantCandidate;
  'exit-decisions': QuantExitDecision;
}
export type QuantListResource = keyof QuantResourceItems;
export type QuantSnapshotIdentity = Pick<QuantOverviewData, 'strategy_id' | 'trade_date' | 'snapshot_id'>;

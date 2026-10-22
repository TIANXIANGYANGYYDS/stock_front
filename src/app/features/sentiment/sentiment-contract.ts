export type SentimentScope = 'all_a' | 'hs_mainboard';
export const SCOPE_NAMES = { all_a: '全 A 股', hs_mainboard: '沪深主板' } as const;
export const BOARD_NAMES = { sh_mainboard: '沪市主板', sz_mainboard: '深市主板', chinext: '创业板', star: '科创板', bse: '北交所' } as const;
export type BoardType = keyof typeof BOARD_NAMES;
export const scopeBoards = (scope: SentimentScope): BoardType[] => scope === 'all_a' ? Object.keys(BOARD_NAMES) as BoardType[] : ['sh_mainboard', 'sz_mainboard'];
export const boardName = (board: string) => BOARD_NAMES[board as BoardType] ?? board;

export interface PopularitySource {
  provider: string; snapshot_id?: string | null; observed_at?: string | null;
  age_seconds?: number | null; max_age_seconds?: number | null;
}
export interface StockPopularity extends PopularitySource {
  status: 'ranked' | 'not_ranked' | 'missing' | 'stale';
  rank: number | null; heat: number | null; rank_change?: unknown;
}
/** Backend contract 2026-10-22. Ratios are decimals except emotion.facts. */
export interface SentimentMeta {
  trade_date: string; scope: SentimentScope; snapshot_id: string; as_of: string; generated_at: string;
  session: string; is_final: boolean; is_stale: boolean; coverage: number | null;
  classification_version: string; rule_version: string; age_seconds: number;
  included_boards?: BoardType[]; history_available_sessions?: string[]; clock_offset_seconds?: number; clock_basis?: string;
  sample_interval_seconds?: number; data_mode?: 'observed_snapshots' | 'retained_observation' | 'daily_final';
  is_retained?: boolean; retention_reason?: string | null; retained_from_snapshot_id?: string | null;
  processed_as_of?: string | null;
  environment_interval_seconds?: number; event_rule_version?: string;
  popularity?: PopularitySource & { status: 'available' | 'missing' | 'stale' };
  finalization?: { status: 'not_due' | 'pending' | 'finalized'; pending_reasons: string[] };
  universe_basis?: string; classification_basis?: string; price_basis?: string; exclusions?: string[];
}
export interface Envelope<T> { meta: SentimentMeta; data: T }
export interface Emotion {
  state: string | null; candidate_state: string | null;
  status: 'confirmed' | 'pending_confirmation' | 'insufficient_data' | 'unclassified';
  state_since: string | null; previous_state: string | null;
  intraday_change: 'unknown' | 'improving' | 'deteriorating' | 'stable';
  extreme_tag: string | null; evidence: Record<string, unknown>[]; counter_evidence: Record<string, unknown>[];
  evaluated_at: string; rule_version: string; method: string; validated_for_trading: boolean; missing_reason?: string | null;
  evaluation_interval_seconds?: number; support?: boolean | null; support_status?: string | null;
  last_supported_at?: string | null; support_unknown_reasons?: string[];
  entry?: Record<string, boolean | null>; hold?: Record<string, boolean | null>; facts?: Record<string, unknown>;
  candidates?: Record<string, unknown>[]; data_quality?: Record<string, unknown>; structure?: Record<string, unknown>;
  cycle_id?: string | number | null; startup_cohort?: unknown[]; high_cohort?: unknown[]; exit_evidence?: Record<string, unknown>;
  is_carried_to_close?: boolean;
}
export interface StatsValues {
  expected?: number | null; eligible?: number | null; missing?: number | null; excluded?: number | null; coverage?: number | null;
  limit_up?: number | null; limit_down?: number | null; limit_up_ratio?: number | null;
  touch_up?: number | null; broken?: number | null; seal_rate?: number | null; currently_open_ratio?: number | null; ever_open_ratio?: number | null;
  advancing?: number | null; declining?: number | null; flat?: number | null; advancing_ratio?: number | null;
  return_median?: number | null; amount_yuan?: number | null; height?: number | null; chain_count?: number | null; unknown_streak?: number | null;
  board_counts?: Record<string, number | null> | null; one_to_two?: number | null; two_to_three?: number | null;
  up_over_5?: number | null; down_over_5?: number | null; drawdown_8?: number | null;
}
export interface FeedbackCohort {
  sample_count?: number | null; observed_count?: number | null; coverage?: number | null; return_median?: number | null;
  open_return_median?: number | null; advancing_count?: number | null; loss_over_5_count?: number | null;
  limit_down_count?: number | null; promotion?: number | null; missing_reason?: string | null;
}
export const COHORTS = { yesterday_limit_up: '昨涨停', yesterday_first_board: '昨首板', yesterday_chain: '昨连板', yesterday_high_board: '昨高板', yesterday_broken: '昨炸板' } as const;
export interface SentimentStats {
  values: StatsValues; feedback: Partial<Record<keyof typeof COHORTS, FeedbackCohort>>; emotion: Emotion;
  missing_reasons: Record<string, string>;
  recent_activity?: { window_seconds: number; basis: string } & Partial<Record<keyof typeof EVENT_NAMES, number>>;
  count_basis?: string; touch_basis?: string;
}
export interface BoardStats extends SentimentStats { board_type: BoardType; name: string; member_count: number }
export interface ThemeStats extends SentimentStats {
  theme_id: string; name: string; member_count: number; scope_member_count: number;
  membership_basis: string; historical_membership_verified: boolean;
  top_stocks?: SentimentStock[];
}
export interface SentimentStock {
  code: string; name: string | null; market: string; board_type: string;
  price: number | null; change_ratio: number | null; amount_yuan: number | null; turnover_ratio: number | null;
  previous_close?: number | null; popularity?: StockPopularity;
  open_change_ratio: number | null; drawdown_from_high_ratio: number | null;
  limit_up_price: number | null; limit_down_price: number | null; limit_rule: string;
  limit_status: 'sealed' | 'at_limit' | 'opened' | 'not_touched' | 'unknown';
  is_limit_up: boolean | null; is_limit_down: boolean | null; is_sealed: boolean | null; touched_up: boolean;
  seal_amount_yuan: number | null; seal_volume_shares: number | null; observed_open_count: number;
  first_touch_at: string | null; first_seal_at: string | null; last_reseal_at: string | null; last_open_at: string | null;
  confirmed_streak_before_today: number | null; intraday_streak: number | null; target_streak: number | null;
  board_run: { window_days: number | null; limit_up_days: number | null; label: string | null; is_final: boolean; rule?: string };
  theme_ids: string[]; attributed_theme_id: string | null; attribution_basis: string;
  source_time: string | null; received_at: string | null; provider: string | null;
  valid: boolean; eligible: boolean; excluded_reason: string | null; is_stale: boolean; missing_reasons: Record<string, string>;
  timing_basis: string; path_complete: boolean; status_basis: string; is_final: boolean;
}
export const PRICE_EVENT_KINDS = { first_touch: '触板', first_seal: '封板', open: '开板', reseal: '回封', limit_down: '跌停', open_limit_down: '打开跌停板', rapid_rise: '暴力拉升', rapid_fall: '急速下跌', quick_rebound: '快速反弹', high_dive: '高台跳水', volume_surge: '放量异动' } as const;
export const EVENT_NAMES = { ...PRICE_EVENT_KINDS, first_touch: '首次触板', first_seal: '首次封板', emotion_changed: '环境切换' } as const;
export interface SentimentEvent {
  event_id: string; snapshot_id: string; type: keyof typeof EVENT_NAMES; code?: string | null; theme_ids?: string[];
  observed_at: string; source_time?: string | null; timing_basis: string;
  name?: string | null; label?: string; rule_version?: string | null; evidence?: Record<string, unknown>; cooldown_seconds?: number | null;
  [field: string]: unknown;
}
export interface EventPage { items: SentimentEvent[]; next_cursor: string | null; has_more: boolean }
export interface DashboardData { market: SentimentStats; boards: BoardStats[]; themes: ThemeStats[]; recent_events: SentimentEvent[]; unique_stock_count: number }
export interface LadderLevel { height: number | null; height_basis: string; count: number; stocks: SentimentStock[] }
export interface LadderData {
  groups: { theme_id: string | null; name: string; levels: LadderLevel[] }[];
  unique_count: number; membership_count: number; status: string;
}
export interface ThemeDetail extends ThemeStats {
  ladder: LadderData; members: { total: number; page: number; page_size: number; items: SentimentStock[]; sort?: 'board_strength' | 'change_ratio'; sort_fields?: string[] };
}
export interface StockDetail extends SentimentStock {
  board_history: { trade_date?: string; is_limit_up?: boolean | null; is_final?: boolean; [field: string]: unknown }[];
  themes: { theme_id: string; name: string }[]; events: EventPage;
}
export interface TimeseriesPoint {
  timestamp: string; as_of: string; snapshot_id: string; is_final: boolean;
  classification_version?: string; rule_version?: string; market?: SentimentStats | null; theme?: ThemeStats | null;
}
export interface TimeseriesData {
  interval: '1m' | '5m' | '1d'; theme_id: string | null; start_date: string; end_date: string; items: TimeseriesPoint[]; count: number;
}
export interface StreamData {
  dashboard: DashboardData; stocks_upsert: SentimentStock[]; removed_codes: string[]; replace_all: boolean; events?: EventPage;
}
export type StreamMessage = { type: 'snapshot' | 'resync' | 'update'; id?: string; payload: Envelope<StreamData> }
  | { type: 'heartbeat'; id?: string; payload: { meta: SentimentMeta } }
  | { type: 'unavailable'; id?: string; payload: { retry_after_seconds: number } };

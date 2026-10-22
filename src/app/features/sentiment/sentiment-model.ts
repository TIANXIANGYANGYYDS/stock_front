import type { SentimentSecondSeries, SentimentSecondEvent } from './sentiment-seconds';
/** Display contract for the proposed /api/v1/sentiment endpoints. Ratios are decimals. */
export type EmotionState = '试错整理' | '扩散发酵' | '主升' | '主升中分歧' | '震荡分化' | '情绪低迷' | '退潮' | '退潮中修复';
export type EmotionTone = 'hot' | 'warm' | 'cool' | 'neutral';
export interface Emotion {
  state: EmotionState;
  intraday_change: '改善' | '恶化' | '平稳';
  status: '已确认' | '待确认' | '数据不足';
  extreme_tag: '冰点' | '高潮' | null;
  state_since: string;
  previous_state: EmotionState;
  evidence: string[];
  counter_evidence: string[];
}
export interface SentimentStock {
  code: string;
  name: string;
  theme_ids: string[];
  price: number;
  change_ratio: number;
  limit_status: 'sealed' | 'opened' | 'untouched' | 'unknown';
  confirmed_streak_before_today: number | null;
  intraday_streak: number | null;
  first_seal_at: string | null;
  time_source: 'observed' | 'exchange';
  last_reseal_at: string | null;
  observed_open_count: number;
  window_days: number;
  limit_up_days: number;
  board_history: boolean[];
  seal_amount_yuan: number | null;
  amount_yuan: number;
  turnover_ratio: number;
  source_time: string;
  is_stale: boolean;
}
export interface SentimentTheme {
  theme_id: string;
  name: string;
  subtitle: string;
  emotion: Emotion;
  member_count: number;
  coverage: number;
  yesterday_premium: number | null;
  trend: number[];
}
export interface SentimentEvent {
  id: string;
  time: string;
  kind: SentimentSecondEvent['kind'] | '首次封板' | '情绪变化';
  text: string;
  stock_code?: string;
  theme_id: string;
}
export interface SentimentSnapshot {
  meta: {
    trade_date: string;
    session: 'continuous';
    scope: 'all_a' | 'hs_mainboard';
    snapshot_id: string;
    as_of: string;
    is_final: boolean;
    is_stale: boolean;
    coverage: number;
    rule_version: string;
  };
  emotion: Emotion;
  themes: SentimentTheme[];
  stocks: SentimentStock[];
  seconds: SentimentSecondSeries[];
  events: SentimentEvent[];
  limit_down_count: number;
}
export const emotionTone = (state: EmotionState): EmotionTone => {
  if (state === '主升' || state === '扩散发酵') return 'hot';
  if (state === '主升中分歧' || state === '震荡分化') return 'warm';
  if (state === '退潮' || state === '情绪低迷') return 'cool';
  return 'neutral';
};
export const percentage = (value: number | null, digits = 1, signed = false) => value === null || !Number.isFinite(value)
  ? '—' : `${signed && value > 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`;
export const money = (value: number | null) => value === null ? '—' : value >= 1e8 ? `${(value / 1e8).toFixed(2)} 亿` : `${(value / 1e4).toFixed(0)} 万`;
export const clockTime = (value: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(11, 19) : '—';
/** Opened stocks retain yesterday's confirmed streak, without claiming a new sealed board. */
export const ladderHeight = (stock: SentimentStock): number | null => stock.limit_status === 'sealed'
  ? stock.intraday_streak
  : stock.limit_status === 'opened' && stock.confirmed_streak_before_today !== null ? stock.confirmed_streak_before_today + 1 : null;
export function compareStocks(a: SentimentStock, b: SentimentStock) {
  const height = (ladderHeight(b) ?? -1) - (ladderHeight(a) ?? -1);
  const sealTime = (value: string | null) => { const timestamp = value ? Date.parse(value) : NaN; return Number.isFinite(timestamp) ? timestamp : Infinity; };
  const at = sealTime(a.first_seal_at);
  const bt = sealTime(b.first_seal_at);
  return height || (at === bt ? 0 : at < bt ? -1 : 1) || b.change_ratio - a.change_ratio || a.code.localeCompare(b.code);
}
export interface LadderFilters { query: string; status: 'sealed' | 'all' | 'opened'; height: number | null }
export function selectStocks(stocks: SentimentStock[], filters: LadderFilters, theme?: SentimentTheme) {
  const query = filters.query.trim().toLowerCase();
  return stocks.filter(stock => (!theme || stock.theme_ids.includes(theme.theme_id))
    && (filters.status === 'all' ? stock.limit_status === 'sealed' || stock.limit_status === 'opened' : stock.limit_status === filters.status)
    && (filters.height === null || ladderHeight(stock) === filters.height)
    && (!query || `${stock.code} ${stock.name} ${theme?.name ?? ''}`.toLowerCase().includes(query)))
    .sort(compareStocks);
}
export function marketStats(stocks: SentimentStock[]) {
  // A code can belong to multiple themes. Market counts must always be deduplicated.
  const unique = [...new Map(stocks.map(stock => [stock.code, stock])).values()];
  const sealed = unique.filter(stock => stock.limit_status === 'sealed');
  const opened = unique.filter(stock => stock.limit_status === 'opened');
  const touched = sealed.length + opened.length;
  const highest = sealed.reduce((max, stock) => Math.max(max, stock.intraday_streak ?? 0), 0);
  return {
    sealed: sealed.length, opened: opened.length,
    seal_ratio: touched ? sealed.length / touched : null,
    open_ratio: touched ? opened.length / touched : null,
    consecutive: sealed.filter(stock => (stock.intraday_streak ?? 0) > 1).length,
    highest,
    ladder: Array.from({ length: Math.max(7, highest) }, (_, index) => Math.max(7, highest) - index)
      .map(height => ({ height, count: sealed.filter(stock => stock.intraday_streak === height).length })),
  };
}

import type { SentimentScope, BoardType, DashboardData, Envelope, SentimentEvent, SentimentMeta, SentimentStock, StreamData, StreamMessage, Emotion, ThemeStats } from './sentiment-contract';
import type { SentimentSecondSeries } from './sentiment-seconds';
import { PRICE_EVENT_KINDS } from './sentiment-contract';

export const displayNumber = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : String(value);
export const pct = (value: number | null | undefined, digits = 1, signed = false) => value == null || !Number.isFinite(value) ? '—' : `${signed && value > 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`;
export const stockHeight = (stock: SentimentStock) => stock.is_limit_up === true ? stock.intraday_streak : stock.limit_status === 'opened' ? stock.target_streak : null;
export const stockStatus = (stock: SentimentStock) => stock.limit_status === 'opened' ? '已开板' : stock.is_limit_up === true ? stock.is_sealed === true ? '已封板' : '涨停价 · 封单未知' : stock.limit_status === 'not_touched' ? '未触板' : '状态未知';
export const emotionStatus = { confirmed: '已确认', pending_confirmation: '候选待确认', insufficient_data: '数据不足', unclassified: '未分类' };
export const emotionChange = { unknown: '变化未知', improving: '改善', deteriorating: '恶化', stable: '平稳' };
export const missingReason = (reason?: string | null) => reason ? ({ empty_cohort: '昨日群体为空', incomplete_current_cohort: '当前群体观测不完整', insufficient_coverage_or_sample: '覆盖或样本不足', coverage_below_98_percent: '行情覆盖低于 98%', missing_previous_streak: '缺少昨日确认连板记录' } as Record<string, string>)[reason] ?? reason : null;
export const emotionTitle = (emotion: Emotion) => emotion.state ?? (emotion.status === 'confirmed' ? '状态未知' : emotionStatus[emotion.status]);
export const emotionColor = (emotion: Emotion) => ['沸点', '过热', '主升', '高潮', '扩散发酵'].includes(emotion.state ?? '') ? 'hot' : ['微热', '启动', '分歧', '主升中分歧', '震荡分化'].includes(emotion.state ?? '') ? 'warm' : ['微冷', '过冷', '冰点', '退潮', '情绪低迷'].includes(emotion.state ?? '') ? 'cool' : 'neutral';
export interface LiveFilters { query: string; status: 'all' | 'touched' | 'limit_up' | 'opened'; height: number | null; board: '' | BoardType }
export function compareLiveStocks(a: SentimentStock, b: SentimentStock) {
  const time = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Infinity;
  const at = time(a.first_touch_at), bt = time(b.first_touch_at);
  return (stockHeight(b) ?? -1) - (stockHeight(a) ?? -1) || (at === bt ? 0 : at < bt ? -1 : 1)
    || a.code.localeCompare(b.code);
}
export function selectLiveStocks(stocks: SentimentStock[], filters: LiveFilters, theme?: ThemeStats) {
  const query = filters.query.trim().toLowerCase();
  return stocks.filter(stock => (!theme || stock.theme_ids.includes(theme.theme_id))
    && (filters.status === 'limit_up' ? stock.is_limit_up === true : filters.status === 'opened' ? stock.limit_status === 'opened' : stock.touched_up)
    && (!filters.board || stock.board_type === filters.board)
    && (filters.height === null || (filters.height === 10 ? (stockHeight(stock) ?? -1) >= 10 : stockHeight(stock) === filters.height))
    && (!query || `${stock.code} ${stock.name ?? ''} ${theme?.name ?? ''}`.toLowerCase().includes(query))).sort(compareLiveStocks);
}
export function mergeEvents(previous: SentimentEvent[], incoming: SentimentEvent[]) {
  return [...new Map([...previous, ...incoming].map(event => [event.event_id, event])).values()].sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
}
export interface LiveSnapshot {
  meta: SentimentMeta; dashboard: DashboardData; stocks: Record<string, SentimentStock>;
  events: SentimentEvent[]; series: Record<string, SentimentSecondSeries>;
}
/** A limit percentage is computed from the supplied prices/return, never rounded to identify limit-up. */
function limitRatio(stock: SentimentStock) {
  return stock.price != null && stock.price > 0 && stock.change_ratio != null && stock.limit_up_price != null
    ? stock.limit_up_price / (stock.price / (1 + stock.change_ratio)) - 1 : null;
}
export function mergeSnapshot(previous: LiveSnapshot | null, incoming: Envelope<StreamData>, requestedDate?: string, requestedScope?: SentimentScope): LiveSnapshot | null {
  const { meta, data } = incoming;
  if (requestedScope && meta.scope !== requestedScope) return previous;
  if (requestedDate && meta.trade_date !== requestedDate) return previous;
  if (previous?.meta.scope === meta.scope && meta.trade_date < previous.meta.trade_date) return previous;
  const sameDate = previous?.meta.scope === meta.scope && previous.meta.trade_date === meta.trade_date;
  // Same snapshot IDs may carry new events; only reject genuinely older versions.
  if (sameDate && Date.parse(meta.generated_at) < Date.parse(previous!.meta.generated_at)) return previous;
  const stocks = data.replace_all || !sameDate ? {} : { ...previous!.stocks };
  for (const stock of data.stocks_upsert) stocks[stock.code] = stock;
  for (const code of data.removed_codes) delete stocks[code];
  const events = mergeEvents(sameDate && !data.replace_all ? previous!.events : [], [...data.dashboard.recent_events, ...(data.events?.items ?? [])]).slice(-2000);
  const series: Record<string, SentimentSecondSeries> = sameDate ? { ...previous!.series } : {};
  const cutoff = Date.parse(meta.as_of) - 5 * 60000;
  for (const code of Object.keys(series)) if (!stocks[code]) delete series[code];
  for (const stock of Object.values(stocks)) {
    const old = series[stock.code];
    const points = (old?.points ?? []).filter(point => point.time >= cutoff);
    const time = stock.source_time ? Date.parse(stock.source_time) : NaN;
    const last = points.at(-1);
    if (!requestedDate && meta.data_mode !== 'daily_final' && Number.isFinite(time) && time <= Date.parse(meta.as_of) && time >= cutoff && (!last || time > last.time)) {
      if (last && time - last.time > 15000) points.push({ time: last.time + 1, change_ratio: null });
      points.push({ time, change_ratio: stock.valid && !stock.is_stale ? stock.change_ratio : null });
    }
    const markers = events.flatMap(event => {
      if (event.code !== stock.code || !(event.type in PRICE_EVENT_KINDS)) return [];
      const eventTime = Date.parse(event.source_time ?? event.observed_at);
      const point = points.find(item => item.time === eventTime);
      // Events have no price field. Only anchor when we received the exact matching quote.
      if (point?.change_ratio == null) return [];
      return [{ id: event.event_id, code: stock.code, time: eventTime, change_ratio: point.change_ratio,
        kind: PRICE_EVENT_KINDS[event.type as keyof typeof PRICE_EVENT_KINDS], evidence: event.evidence, rule_version: event.rule_version, cooldown_seconds: event.cooldown_seconds }];
    });
    series[stock.code] = { code: stock.code, limit_ratio: limitRatio(stock), points, events: markers };
  }
  return { meta, dashboard: data.dashboard, stocks, events, series };
}
export function applyStreamMessage(previous: LiveSnapshot | null, message: StreamMessage, requestedDate?: string, requestedScope?: SentimentScope) {
  if (requestedDate) return previous; // SSE always follows the latest day, never a historical selection.
  if (message.type === 'unavailable') return previous;
  if (requestedScope && message.payload.meta.scope !== requestedScope) return previous;
  if (message.type === 'heartbeat') {
    if (!previous || message.payload.meta.scope !== previous.meta.scope || message.payload.meta.trade_date !== previous.meta.trade_date || message.payload.meta.snapshot_id !== previous.meta.snapshot_id) return previous;
    return { ...previous, meta: message.payload.meta };
  }
  return mergeSnapshot(previous, message.payload, undefined, requestedScope);
}

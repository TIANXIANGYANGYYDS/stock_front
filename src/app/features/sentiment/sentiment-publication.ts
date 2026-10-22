import type { SentimentMeta, SentimentStock } from './sentiment-contract';

export const isFinal = (meta: SentimentMeta) => meta.is_final && (!meta.finalization || meta.finalization.status === 'finalized');
export const isRetained = (meta: SentimentMeta) => !isFinal(meta) && (meta.is_retained === true || meta.data_mode === 'retained_observation');
export const awaitingClose = (meta: SentimentMeta) => !isFinal(meta)
  && (meta.finalization?.status === 'pending' || ['closing_auction', 'closed_pending_final', 'closed'].includes(meta.session));
// IDs stay opaque. A same-ID finalization notification also invalidates associated reads.
export const publicationKey = (meta: SentimentMeta) => JSON.stringify([meta.scope, meta.trade_date, meta.snapshot_id,
  meta.classification_version, meta.rule_version, meta.is_final, meta.finalization?.status, meta.data_mode]);
export const observationKey = (meta: SentimentMeta) => JSON.stringify([meta.scope, meta.trade_date, meta.classification_version, meta.rule_version]);
export const retentionReason = (code?: string | null) => code ? ({
  nontrading_invalid_observation: '非连续交易期间的新观察无效，保留同日最后有效观察',
  session_ended_without_new_observation: '交易时段结束后暂无新观察，保留已有有效观察',
  no_same_day_usable_observation: '当天没有可保留的有效观察',
} as Record<string, string>)[code] ?? `保留状态：${code}` : null;
export const finalizationReason = (code: string) => ({
  daily_summary_missing: '每日汇总尚未就绪', daily_raw_missing: '每日原始事实尚未就绪',
  daily_archive_missing: '全量日线归档缺失', bse_close_archive_missing: '北交所收盘归档缺失',
  daily_source_invalid: '日级来源校验未通过', archive_backlog: '盘中归档尚未处理完成',
  final_coverage_below_threshold: '最终市场覆盖率不足', final_board_coverage_below_threshold: '部分板块最终覆盖率不足',
  replay_in_progress: '正在回放已有归档',
} as Record<string, string>)[code] ?? `待定稿原因：${code}`;
export function memberQuality(stock: SentimentStock) {
  if (stock.excluded_reason) return `不参与统计：${({ st: 'ST', suspended: '停牌', delisting: '退市', no_price_limit: '无限价' } as Record<string, string>)[stock.excluded_reason] ?? stock.excluded_reason}`;
  if (!stock.valid) return '行情缺失';
  if (stock.is_stale) return '该观察报价过期';
  return !stock.eligible ? '不参与统计' : null;
}

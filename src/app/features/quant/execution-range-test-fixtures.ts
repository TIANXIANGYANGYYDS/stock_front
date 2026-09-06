import type { QuantExecutionRangeItem, QuantExecutionRangePage, QuantExecutionRangeQuery } from './quant-execution-range-types';
export const rangeQuery: QuantExecutionRangeQuery = { strategyId: 'strategy_1', code: '000036', startDate: '2026-08-20', endDate: '2026-09-04' };
export const rangeItem = (patch: Partial<QuantExecutionRangeItem> = {}): QuantExecutionRangeItem => ({
  event_id: 'buy-1', code: '000036', name: '测试股票', trade_date: '2026-08-20', action: 'buy', status: 'filled',
  execution_at: '2026-08-20T01:30:00Z', execution_price: 4.002001, shares: 100, notional: 400.20,
  commission: 0, stamp_duty: 0, total_fees: null, snapshot_id: 'source-day-version', recording: { mode: 'historical_replay' }, ...patch,
});
export const rangeResponse = (items: QuantExecutionRangeItem[], page = 1, pageSize = 200, version = 'history-a', query = rangeQuery): QuantExecutionRangePage => ({
  schema_version: '1.2', strategy_id: query.strategyId, strategy_name: '策略1', query_mode: 'date_range', code: query.code,
  action: query.action || null, start_date: query.startDate, end_date: query.endDate, trade_date: null,
  snapshot_id: version, history_version: version, execution_kind: 'shadow_simulation', history: { covered_start_date: query.startDate, covered_end_date: query.endDate, recording_modes: ['historical_replay'] },
  total: items.length, page, page_size: pageSize, items: items.slice((page - 1) * pageSize, page * pageSize),
});
export const rangeJson = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

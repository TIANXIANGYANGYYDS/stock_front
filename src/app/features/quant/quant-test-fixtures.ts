// Test-only public contract fixtures. No application module imports this file.
import type { QuantDailyResult, QuantOverviewData, QuantPaginatedResponse, QuantPerformancePage, QuantPerformancePoint } from './quant-types';

export const overviewFixture = (patch: Partial<QuantOverviewData> = {}): QuantOverviewData => ({
  strategy_id: 'strategy_1', strategy_name: '策略1', trade_date: '2026-09-04', snapshot_id: 'snapshot-a',
  execution_kind: 'shadow_simulation', updated_at: '2026-09-04T15:00:00+08:00',
  strategy: { id: 'strategy_1', name: '策略1', execution_kind: 'shadow_simulation' }, status: 'closed',
  execution_rule: {},
  runtime: { version: 1, data_status: 'closed', incomplete_codes: [] },
  recording: { mode: 'historical_replay', start_date: '2026-09-03', computed_at: '2026-09-06T14:00:00+08:00' },
  summary: { initial_capital: 100000, cash_balance: 90000, market_value: 11230, total_assets: 101230,
    total_pnl: 1230, total_return: 0.0123, realized_pnl: 0, unrealized_pnl: 1230,
    account_day_pnl: -100, account_day_return: -0.001, buy_notional: 10000, sell_notional: 0,
    turnover: 10000, total_fees: 0, buy_count: 1, sell_count: 0, holding_count: 1 },
  observation_summary: { count: 0, state_counts: {} }, signal_summary: { count: 0, recent_items: [] }, ...patch,
});

export const pageFixture = <T>(items: T[], page = 1, pageSize = 50, snapshot = overviewFixture()): QuantPaginatedResponse<T> => ({
  strategy_id: snapshot.strategy_id, strategy_name: snapshot.strategy_name, trade_date: snapshot.trade_date, snapshot_id: snapshot.snapshot_id,
  total: items.length, page, page_size: pageSize, items: items.slice((page - 1) * pageSize, page * pageSize),
});

export const dailyFixture = (patch: Partial<QuantDailyResult> = {}): QuantDailyResult => ({
  ...overviewFixture(), observation_pool: { count: 0, items: [] }, signals: { count: 0, items: [] },
  intraday_trading: { count: 0, items: [] }, holding_pool: { count: 0, items: [] }, closed_trades: { count: 0, items: [] },
  accounts: { available: true, count: 0, items: [] }, preselection_pool: { count: 0, items: [] }, sell_candidate_pool: { count: 0, items: [] }, exit_decisions: { count: 0, items: [] }, ...patch,
});

export const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const performanceFixture = (points: QuantPerformancePoint[] = [overviewFixture()], page = 1, pageSize = 200): QuantPerformancePage => ({
  strategy_id: points[0]?.strategy_id ?? 'strategy_1', strategy_name: points[0]?.strategy_name ?? '策略1',
  items: points.slice((page - 1) * pageSize, page * pageSize), total: points.length, page, page_size: pageSize,
});

// Regression samples only; application dates and financial figures come from live responses.
export const REBASED_TEST_DATES = ['2026-08-20', '2026-08-21', '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
export function rebasedSnapshotFixture(date = REBASED_TEST_DATES.at(-1)!, revision = 'rebased') {
  return overviewFixture({ trade_date: date, snapshot_id: `${revision}:${date}`, recording: { mode: 'historical_replay', start_date: REBASED_TEST_DATES[0], history_rebased_at: '2026-09-06T17:21:00+08:00' } });
}

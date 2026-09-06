import { ApiRequestError, requestJson, type QueryValue, type RequestOptions } from '../../lib/api';
import type { QuantExecutionRangePage, QuantExecutionRangeQuery } from './quant-execution-range-types';
import type {
  QuantDailyResult, QuantListResource, QuantObservation, QuantOverviewData,
  QuantPaginatedResponse, QuantPerformancePage, QuantResourceItems,
  QuantSnapshotIdentity, QuantStrategyList,
} from './quant-types';

export interface QuantListParams {
  tradeDate?: string;
  snapshotId?: string;
  code?: string;
  action?: string;
  status?: string;
  state?: NonNullable<QuantObservation['state']> | '';
  stateDetail?: string;
  statusDetail?: string;
  hasPosition?: boolean | '';
  page?: number;
  pageSize?: number;
}

export interface QuantPerformanceParams {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export class QuantContractError extends Error {}

export function quantHttpMessage(status: number): string {
  if (status === 409) return '数据快照已变化，需要重新加载账户与列表。';
  if (status === 404) return '所选策略或交易日暂无正式记录（404）。';
  if (status === 503) return '量化服务暂不可用（503），请稍后重试。';
  if (status === 422) return '查询条件无效，请检查日期和六位股票代码（422）。';
  return `量化数据请求失败（${status}），请重试。`;
}

async function request<T>(path: string, params?: Record<string, QueryValue>, options: RequestOptions = {}): Promise<T> {
  try {
    return await requestJson<T>(path, params, { ...options, cache: 'no-store' });
  } catch (error) {
    // Transport diagnostics may contain private strategy identities. Business reasons are rendered from typed responses.
    if (error instanceof ApiRequestError) throw new ApiRequestError(error.status, quantHttpMessage(error.status));
    throw error;
  }
}

function strategyPath(strategyId: string, resource: string): string {
  return `/api/v1/quant/strategies/${encodeURIComponent(strategyId)}/${resource}`;
}

function identity(payload: { strategy_id?: string }, strategyId: string) {
  if (payload?.strategy_id !== strategyId) throw new QuantContractError('策略数据不匹配，已停止展示。');
}

export function assertSnapshot(payload: QuantSnapshotIdentity, expected: QuantSnapshotIdentity) {
  identity(payload, expected.strategy_id);
  if (payload.trade_date !== expected.trade_date || payload.snapshot_id !== expected.snapshot_id) {
    throw new ApiRequestError(409, quantHttpMessage(409));
  }
}

function checkSnapshotMetadata(payload: QuantSnapshotIdentity) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload?.trade_date ?? '') || !payload?.snapshot_id) {
    throw new QuantContractError('快照信息缺失，无法展示量化数据。');
  }
}

function checkPage<T extends { items: unknown[]; total: number; page: number; page_size: number; strategy_id: string }>(
  payload: T, strategyId: string, page: number, pageSize: number,
): T {
  identity(payload, strategyId);
  if (!Array.isArray(payload.items) || !Number.isInteger(payload.total) || payload.total < 0
    || payload.page !== page || payload.page_size !== pageSize
    || payload.items.length !== Math.min(pageSize, Math.max(0, payload.total - (page - 1) * pageSize))) {
    throw new QuantContractError('分页数据不完整，请重试。');
  }
  return payload;
}

function paging(params: { page?: number; pageSize?: number }) {
  return {
    page: Math.max(1, Math.trunc(params.page ?? 1) || 1),
    page_size: Math.min(200, Math.max(1, Math.trunc(params.pageSize ?? 50) || 50)),
  };
}

export async function getQuantStrategies(options: RequestOptions = {}): Promise<QuantStrategyList> {
  const result = await request<QuantStrategyList>('/api/v1/quant/strategies', undefined, options);
  if (!Array.isArray(result?.items) || result.total !== result.items.length
    || result.items.some(item => !item.id || !item.name || item.execution_kind !== 'shadow_simulation')
    || new Set(result.items.map(item => item.id)).size !== result.items.length) {
    throw new QuantContractError('策略目录不完整，请重试。');
  }
  return result;
}

export async function getQuantOverview(strategyId: string, tradeDate?: string, options: RequestOptions = {}): Promise<QuantOverviewData> {
  const response = await request<{ data: QuantOverviewData }>(strategyPath(strategyId, 'overview'), { trade_date: tradeDate }, options);
  const data = response?.data;
  identity(data, strategyId);
  checkSnapshotMetadata(data);
  if (!data.summary || !data.strategy || !data.execution_rule || !data.runtime || !data.recording || !data.observation_summary || !data.signal_summary) {
    throw new QuantContractError('账户总览不完整，请重试。');
  }
  if (tradeDate && data.trade_date !== tradeDate) throw new QuantContractError('交易日期不匹配，已停止展示。');
  return data;
}

export async function getQuantPage<R extends QuantListResource>(
  strategyId: string, resource: R, params: QuantListParams = {}, options: RequestOptions = {},
): Promise<QuantPaginatedResponse<QuantResourceItems[R]>> {
  const query: Record<string, QueryValue> = {
    ...paging(params), trade_date: params.tradeDate, snapshot_id: params.snapshotId, code: params.code,
  };
  if (resource === 'observations') { query.action = params.action; query.state = params.state; query.state_detail = params.stateDetail; }
  if (resource === 'signals') { query.action = params.action; query.status = params.status; query.status_detail = params.statusDetail; }
  if (resource === 'executions') query.action = params.action;
  if (resource === 'accounts') query.has_position = params.hasPosition;
  if (resource === 'preselections') query.status = params.status;
  if (resource === 'exit-decisions') query.action = params.action;
  const response = await request<QuantPaginatedResponse<QuantResourceItems[R]>>(strategyPath(strategyId, resource), query, options);
  checkPage(response, strategyId, query.page as number, query.page_size as number);
  if (resource === 'accounts' && typeof response.available !== 'boolean') throw new QuantContractError('逐股账户可用状态缺失，请重试。');
  checkSnapshotMetadata(response);
  if ((params.tradeDate && response.trade_date !== params.tradeDate) || (params.snapshotId && response.snapshot_id !== params.snapshotId)) {
    throw new ApiRequestError(409, quantHttpMessage(409));
  }
  return response;
}

export const getQuantObservations = (id: string, params: QuantListParams = {}, options: RequestOptions = {}) => getQuantPage(id, 'observations', params, options);
export const getQuantSignals = (id: string, params: QuantListParams = {}, options: RequestOptions = {}) => getQuantPage(id, 'signals', params, options);
export const getQuantExecutions = (id: string, params: QuantListParams = {}, options: RequestOptions = {}) => getQuantPage(id, 'executions', params, options);

export async function getQuantExecutionRangePage(
  query: QuantExecutionRangeQuery,
  params: { page?: number; pageSize?: number; historyVersion?: string } = {},
  options: RequestOptions = {},
): Promise<QuantExecutionRangePage> {
  const pagingParams = paging(params);
  const response = await request<QuantExecutionRangePage>(strategyPath(query.strategyId, 'executions'), {
    ...pagingParams, code: query.code, start_date: query.startDate, end_date: query.endDate,
    action: query.action || undefined, history_version: params.historyVersion,
  }, options);
  checkPage(response, query.strategyId, pagingParams.page, pagingParams.page_size);
  if (response.query_mode !== 'date_range' || response.trade_date !== null
    || !response.history_version || response.snapshot_id !== response.history_version
    || !response.history || response.execution_kind !== 'shadow_simulation'
    || response.code !== query.code || response.start_date !== query.startDate || response.end_date !== query.endDate
    || (response.action ?? null) !== (query.action || null) || !response.strategy_name) {
    throw new QuantContractError('成交区间响应与查询不一致，已停止展示。');
  }
  if (params.historyVersion && response.history_version !== params.historyVersion) throw new ApiRequestError(409, quantHttpMessage(409));
  if (response.items.some(item => !item.event_id || item.code !== query.code)) throw new QuantContractError('成交标识或股票代码不完整，已停止展示。');
  return response;
}
export const getQuantHoldings = (id: string, params: QuantListParams = {}, options: RequestOptions = {}) => getQuantPage(id, 'holdings', params, options);
export const getQuantClosedTrades = (id: string, params: QuantListParams = {}, options: RequestOptions = {}) => getQuantPage(id, 'closed-trades', params, options);
export const getQuantAccounts = (id: string, params: QuantListParams = {}, options: RequestOptions = {}) => getQuantPage(id, 'accounts', params, options);
export const getQuantPreselections = (id: string, params: QuantListParams = {}, options: RequestOptions = {}) => getQuantPage(id, 'preselections', params, options);
export const getQuantSellCandidates = (id: string, params: QuantListParams = {}, options: RequestOptions = {}) => getQuantPage(id, 'sell-candidates', params, options);
export const getQuantExitDecisions = (id: string, params: QuantListParams = {}, options: RequestOptions = {}) => getQuantPage(id, 'exit-decisions', params, options);

export async function getQuantPerformance(id: string, params: QuantPerformanceParams = {}, options: RequestOptions = {}): Promise<QuantPerformancePage> {
  const query = { ...paging(params), start_date: params.startDate, end_date: params.endDate };
  const response = await request<QuantPerformancePage>(strategyPath(id, 'performance'), query, options);
  checkPage(response, id, query.page, query.page_size);
  response.items.forEach(item => { identity(item, id); checkSnapshotMetadata(item); });
  return response;
}

export async function getQuantDailyResult(strategyId: string, tradeDate: string, options: RequestOptions = {}): Promise<QuantDailyResult> {
  const response = await request<{ data: QuantDailyResult }>(strategyPath(strategyId, `daily-results/${encodeURIComponent(tradeDate)}`), undefined, options);
  const data = response?.data;
  identity(data, strategyId);
  checkSnapshotMetadata(data);
  if (data.trade_date !== tradeDate) throw new QuantContractError('交易日期不匹配，已停止展示。');
  for (const pool of [data.observation_pool, data.signals, data.intraday_trading, data.holding_pool, data.closed_trades, data.preselection_pool, data.sell_candidate_pool, data.exit_decisions, data.accounts]) {
    if (!pool || !Array.isArray(pool.items) || pool.count !== pool.items.length) throw new QuantContractError('完整快照的业务列表缺失，请重试。');
  }
  if (typeof data.accounts.available !== 'boolean') throw new QuantContractError('逐股账户可用状态缺失，请重试。');
  return data;
}


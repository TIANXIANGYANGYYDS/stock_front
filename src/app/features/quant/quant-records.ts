import type { RequestOptions } from '../../lib/api';
import type { QuantListParams } from './quant-api';
import type { QuantPaginatedResponse } from './quant-types';
import { assertSnapshot, getQuantPerformance, QuantContractError } from './quant-api';
import type { QuantOverviewData, QuantPerformancePoint } from './quant-types';

export type QuantRecords<T> = Pick<QuantPaginatedResponse<T>, 'strategy_id' | 'trade_date' | 'snapshot_id' | 'items' | 'total' | 'available'>;
type PageLoader<T> = (strategyId: string, params: QuantListParams, options: RequestOptions) => Promise<QuantPaginatedResponse<T>>;
type RecordFilters = Omit<QuantListParams, 'page' | 'pageSize'>;

/** The API has no sort parameters. Collect the filtered day before sorting and paginating. */
export async function loadQuantRecords<T>(
  loadPage: PageLoader<T>, strategyId: string, filters: RecordFilters, options: RequestOptions = {},
): Promise<QuantRecords<T>> {
  const checkCancelled = () => options.signal?.throwIfAborted();
  checkCancelled();
  const first = await loadPage(strategyId, { ...filters, page: 1, pageSize: 200 }, options);
  checkCancelled();
  if (first.available === false) return { ...first, items: [] };
  if (!Number.isInteger(first.total) || first.total < 0 || !Number.isInteger(first.page_size) || first.page_size < 1 || first.page !== 1) {
    throw new Error('分页信息不完整，无法完成全部记录排序，请重试。');
  }
  const items = [...first.items];
  const pinnedFilters = { ...filters, tradeDate: first.trade_date, snapshotId: first.snapshot_id };
  if (items.length !== Math.min(first.page_size, first.total)) throw new Error('记录未加载完整，请重试后再排序。');
  for (let page = 2; items.length < first.total; page += 1) {
    checkCancelled();
    const next = await loadPage(strategyId, { ...pinnedFilters, page, pageSize: first.page_size }, options);
    checkCancelled();
    assertSnapshot(next, first);
    if (next.page !== page || next.page_size !== first.page_size || next.total !== first.total
      || next.trade_date !== first.trade_date || next.strategy_id !== first.strategy_id || next.available !== first.available) {
      throw new Error('记录在加载期间发生变化，请重试以获取完整排序结果。');
    }
    if (next.items.length !== Math.min(first.page_size, first.total - items.length)) throw new Error('记录未加载完整，请重试后再排序。');
    items.push(...next.items);
  }
  if (items.length !== first.total) throw new Error('记录数量不一致，请重试以获取完整排序结果。');
  return { strategy_id: first.strategy_id, trade_date: first.trade_date, snapshot_id: first.snapshot_id, available: first.available, items, total: items.length };
}

export async function loadQuantPerformance(snapshot: QuantOverviewData, options: RequestOptions = {}): Promise<QuantPerformancePoint[]> {
  const startDate = snapshot.recording.start_date;
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate > snapshot.trade_date) {
    throw new QuantContractError('账户记录起点缺失或无效，无法确定历史统计区间。');
  }
  const params = { startDate, endDate: snapshot.trade_date, pageSize: 200 };
  options.signal?.throwIfAborted();
  const first = await getQuantPerformance(snapshot.strategy_id, { ...params, page: 1 }, options);
  const items = [...first.items];
  for (let page = 2; items.length < first.total; page += 1) {
    options.signal?.throwIfAborted();
    const next = await getQuantPerformance(snapshot.strategy_id, { ...params, page }, options);
    if (next.total !== first.total || next.items.length === 0) throw new QuantContractError('收益记录在加载期间发生变化，请重新加载。');
    items.push(...next.items);
  }
  options.signal?.throwIfAborted();
  if (items.length !== first.total || new Set(items.map(item => item.trade_date)).size !== items.length) {
    throw new QuantContractError('收益历史数据不完整，请重新加载。');
  }
  const recorded = items.filter(item => item.trade_date >= startDate && item.trade_date <= snapshot.trade_date);
  if (recorded.some(item => item.recording.start_date !== startDate)) {
    throw new QuantContractError('历史记录的账户起点不一致，请刷新以获取完整重算结果。');
  }
  const current = recorded.find(item => item.trade_date === snapshot.trade_date);
  if (recorded.length && !current) throw new QuantContractError('收益历史缺少数据截至日，请刷新后重试。');
  if (current) assertSnapshot(current, snapshot);
  return recorded.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
}

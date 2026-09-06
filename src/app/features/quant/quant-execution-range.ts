import { ApiRequestError, type RequestOptions } from '../../lib/api';
import { getQuantExecutionRangePage, QuantContractError } from './quant-api';
import { EXECUTION_HISTORY_CONFLICT_MESSAGE, parseQuantDateTime } from './quant-format';
import type { QuantExecutionRange, QuantExecutionRangeQuery } from './quant-execution-range-types';

export const executionRangeKey = (query: QuantExecutionRangeQuery) => JSON.stringify([
  query.strategyId, query.code, query.startDate, query.endDate, query.action || '',
]);

export async function loadQuantExecutionRange(query: QuantExecutionRangeQuery, options: RequestOptions & {
  pageSize?: number; cached?: QuantExecutionRange; onConflict?: () => void;
} = {}): Promise<QuantExecutionRange> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    options.signal?.throwIfAborted();
    try {
      // Every load revalidates the complete query. A latest-day timestamp cannot validate older history.
      const first = await getQuantExecutionRangePage(query, { page: 1, pageSize: options.pageSize ?? 200 }, options);
      options.signal?.throwIfAborted();
      const cached = options.cached;
      if (attempt === 0 && cached && cached.history_version === first.history_version && cached.total === first.total
        && cached.strategy_id === query.strategyId && cached.code === query.code && cached.start_date === query.startDate
        && cached.end_date === query.endDate && (cached.action ?? '') === (query.action || '')) {
        return { ...first, items: cached.items };
      }
      const items = [...first.items];
      for (let page = 2; items.length < first.total; page += 1) {
        const next = await getQuantExecutionRangePage(query, { page, pageSize: first.page_size, historyVersion: first.history_version }, options);
        options.signal?.throwIfAborted();
        if (next.total !== first.total || next.items.length === 0) throw new QuantContractError('成交分页数量发生变化，请重试。');
        items.push(...next.items);
      }
      const unique = new Map(items.map(item => [`${first.strategy_id}:${item.event_id}`, item]));
      return { ...first, items: [...unique.values()].sort((a, b) => {
        const aTime = parseQuantDateTime(a.execution_at);
        const bTime = parseQuantDateTime(b.execution_at);
        return (aTime ?? Infinity) - (bTime ?? Infinity)
          || (a.trade_date ?? '').localeCompare(b.trade_date ?? '') || a.event_id.localeCompare(b.event_id);
      }) };
    } catch (error) {
      options.signal?.throwIfAborted();
      if (!(error instanceof ApiRequestError) || error.status !== 409) throw error;
      options.onConflict?.();
      if (attempt === 1) throw new ApiRequestError(409, EXECUTION_HISTORY_CONFLICT_MESSAGE);
    }
  }
  throw new QuantContractError('成交历史加载失败。');
}

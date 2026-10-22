import { ApiRequestError } from '../../lib/api';
import { sentimentApi, snapshotQuery, SentimentContractError } from './sentiment-api';
import { scopeBoards, type SentimentMeta, type SentimentStock } from './sentiment-contract';
import type { LiveFilters } from './sentiment-live-model';
import { popularityRank } from './sentiment-popularity';

/** Rank current continuous boards, then the board count in the supplied multi-day run. */
export function compareThemeMembers(a: SentimentStock, b: SentimentStock) {
  const compare = (a: number | null, b: number | null, ascending = false) => a == null ? b == null ? 0 : 1 : b == null ? -1 : ascending ? a - b : b - a;
  return compare(a.intraday_streak, b.intraday_streak)
    || compare(a.board_run.limit_up_days, b.board_run.limit_up_days)
    || compare(popularityRank(a), popularityRank(b), true)
    || compare(a.change_ratio, b.change_ratio)
    || a.code.localeCompare(b.code);
}

export function selectThemeMembers(members: SentimentStock[], filters: LiveFilters, name: string, meta: SentimentMeta) {
  const query = filters.query.trim().toLowerCase();
  const boards: string[] = meta.included_boards ?? scopeBoards(meta.scope);
  return [...new Map(members.map(stock => [stock.code, stock])).values()]
    .filter(stock => boards.includes(stock.board_type)
      && (filters.status === 'all' || (filters.status === 'limit_up' ? stock.is_limit_up === true : filters.status === 'opened' ? stock.limit_status === 'opened' : stock.touched_up))
      && (!filters.board || stock.board_type === filters.board)
      && (filters.height === null || (filters.height === 10 ? (stock.intraday_streak ?? -1) >= 10 : stock.intraday_streak === filters.height))
      && (!query || `${name} ${stock.code} ${stock.name ?? ''}`.toLowerCase().includes(query)));
}

/** Default top seven is one server-sorted request; explicit filters need all pages first. */
export async function loadThemeMembers(themeId: string, basis: SentimentMeta, signal: AbortSignal, mode: 'top' | 'all' = 'all') {
  const read = async (meta: SentimentMeta) => {
    const members = new Map<string, SentimentStock>();
    let page = 1, total: number | undefined;
    while (true) {
      signal.throwIfAborted();
      const response = await sentimentApi.theme(themeId, { ...snapshotQuery(meta), page, page_size: mode === 'top' ? 7 : 200, sort: 'board_strength' }, signal);
      signal.throwIfAborted();
      const batch = response.data.members;
      if (!Number.isInteger(batch.total) || batch.total < 0 || batch.page !== page || batch.page_size < 1 || batch.page_size > 200 || !Array.isArray(batch.items)) {
        throw new SentimentContractError('题材成员分页结构不正确。');
      }
      if (total !== undefined && total !== batch.total) throw new ApiRequestError(409, '题材成员总数在分页期间改变。');
      if (batch.sort && batch.sort !== 'board_strength') throw new SentimentContractError('题材成员排序与请求不一致。');
      total = batch.total;
      if (mode === 'top' && batch.items.length !== Math.min(7, total)) throw new SentimentContractError('前七成员未完整返回。');
      const before = members.size;
      for (const stock of batch.items) members.set(stock.code, stock);
      if (mode === 'top' && members.size !== Math.min(7, total)) throw new SentimentContractError('前七成员存在重复或缺失。');
      if (members.size >= total || mode === 'top' && members.size === Math.min(7, total)) {
        const { members: _members, ladder: _ladder, ...theme } = response.data;
        return { meta: response.meta, data: { items: [...members.values()], total, theme, complete: members.size >= total } };
      }
      if (members.size === before || page * batch.page_size >= total) throw new SentimentContractError('题材成员未完整返回，暂不计算前七名。');
      page++;
    }
  };
  // Let the workspace rebase the whole display after 409, not just this member list.
  return read(basis);
}

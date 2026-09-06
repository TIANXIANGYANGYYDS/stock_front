import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { ApiRequestError } from '../../lib/api';
import { useWorkspaceState } from '../../hooks/useWorkspaceState';
import { getQuantPage, type QuantListParams } from './quant-api';
import { QuantAccountsUnavailable, QuantEmptyState, QuantErrorState, QuantFilterStatus, QuantLoadingState, QuantPagedResults, QuantSection } from './QuantCommon';
import { DETAIL_STATUSES, OBSERVATION_STATES, SIGNAL_STATUSES, quantErrorMessage } from './quant-format';
import { loadQuantRecords } from './quant-records';
import { QuantRecordTable, quantTableConfig, quantTableSelectors } from './QuantRecordTable';
import { sortQuantItems, type QuantSortState } from './quant-sort';
import type { QuantListResource, QuantOverviewData, QuantResourceItems } from './quant-types';

export interface QuantListPageProps { snapshot: QuantOverviewData; onSnapshotConflict: () => void }
type Filters = Pick<QuantListParams, 'action' | 'status' | 'state' | 'code' | 'stateDetail' | 'statusDetail' | 'hasPosition'>;
const EMPTY_FILTERS: Filters = { action: '', status: '', state: '', code: '', stateDetail: '', statusDetail: '', hasPosition: '' };

export function QuantRecordsPage<R extends QuantListResource>({ resource, snapshot, onSnapshotConflict }: QuantListPageProps & { resource: R }) {
  const config = quantTableConfig(resource);
  const stateKey = `quant.continuous.${snapshot.strategy_id}.${resource}`;
  const [draft, setDraft] = useWorkspaceState<Filters>(`${stateKey}.draft`, EMPTY_FILTERS);
  const [filters, setFilters] = useWorkspaceState<Filters>(`${stateKey}.filters`, EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useWorkspaceState(`${stateKey}.pageSize`, 50);
  const [sort, setSort] = useState<QuantSortState>({ key: '', direction: 'asc' });
  const [reload, setReload] = useState(0);
  const globalSort = !!sort.key;
  const requestKey = JSON.stringify([resource, snapshot.strategy_id, snapshot.trade_date, snapshot.snapshot_id, filters, globalSort, globalSort ? null : page, globalSort ? null : pageSize, reload]);
  const [result, setResult] = useState<{ key: string; items: QuantResourceItems[R][] | null; total: number; available?: boolean; error: string | null } | null>(null);
  const current = result?.key === requestKey ? result : null;
  const loading = !current;

  useEffect(() => {
    const controller = new AbortController();
    const params = { ...filters, tradeDate: snapshot.trade_date, snapshotId: snapshot.snapshot_id, page, pageSize };
    const loadPage = (id: string, query: QuantListParams, options: { signal?: AbortSignal }) => getQuantPage(id, resource, query, options);
    const request = globalSort
      ? loadQuantRecords(loadPage, snapshot.strategy_id, params, { signal: controller.signal })
      : loadPage(snapshot.strategy_id, params, { signal: controller.signal });
    void request.then(response => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil(response.total / pageSize));
      if (!globalSort && page > lastPage) { setPage(lastPage); return; }
      setResult({ key: requestKey, items: response.items, total: response.total, available: response.available, error: null });
    }).catch(error => {
      if (controller.signal.aborted) return;
      setResult({ key: requestKey, items: null, total: 0, error: quantErrorMessage(error) });
      if (error instanceof ApiRequestError && error.status === 409) onSnapshotConflict();
    });
    return () => controller.abort();
    // The key includes every query field; local pagination of a complete sorted set does not refetch.
  }, [requestKey, onSnapshotConflict]);

  const sorted = current?.items && globalSort ? sortQuantItems(current.items, sort, quantTableSelectors(resource)) : current?.items;
  const items = globalSort ? sorted?.slice((page - 1) * pageSize, page * pageSize) : sorted;
  const isApplied = (value: unknown) => value !== '' && value !== undefined && value !== null;
  const hasFilters = Object.values(draft).some(isApplied) || Object.values(filters).some(isApplied);
  const clearFilters = () => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1); };
  const updateDraft = (patch: Filters) => setDraft(value => ({ ...value, ...patch }));

  return <div className="quant-list-page"><QuantSection title={config.title} meta={`${snapshot.trade_date} · ${config.description}`}>
    <form className="quant-filter-bar" onSubmit={event => { event.preventDefault(); setFilters({ ...draft }); setPage(1); setReload(value => value + 1); }}>
      <label><span>股票代码</span><input aria-label="股票代码" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="六位代码" value={draft.code ?? ''} onChange={event => updateDraft({ code: event.target.value })} /></label>
      {(resource === 'observations' || resource === 'signals' || resource === 'executions') && <label>
        <span>{resource === 'observations' ? '观察方向' : '买卖方向'}</span>
        <select aria-label={resource === 'observations' ? '观察方向' : '买卖方向'} value={draft.action ?? ''} onChange={event => updateDraft({ action: event.target.value as Filters['action'] })}>
          <option value="">全部方向</option><option value="buy">{resource === 'observations' ? '买入观察' : '买入'}</option><option value="sell">{resource === 'observations' ? '卖出观察' : '卖出'}</option>
          {resource === 'observations' && <option value="hold">持仓观察</option>}
        </select>
      </label>}
      {resource === 'observations' && <label><span>观察状态</span><select aria-label="观察状态" value={draft.state ?? ''} onChange={event => updateDraft({ state: event.target.value as Filters['state'] })}>
        <option value="">全部状态</option>{Object.entries(OBSERVATION_STATES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
      </select></label>}
      {resource === 'signals' && <label><span>信号状态</span><select aria-label="信号状态" value={draft.status ?? ''} onChange={event => updateDraft({ status: event.target.value as Filters['status'] })}>
        <option value="">全部状态</option>{Object.entries(SIGNAL_STATUSES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
      </select></label>}
      {(resource === 'observations' || resource === 'signals') && <label><span>细分状态（与通用状态取交集）</span><input aria-label="细分状态" list={`quant-${resource}-details`} placeholder="全部 / 输入状态代码" value={(resource === 'observations' ? draft.stateDetail : draft.statusDetail) ?? ''} onChange={event => updateDraft(resource === 'observations' ? { stateDetail: event.target.value } : { statusDetail: event.target.value })} />
        <datalist id={`quant-${resource}-details`}>{Object.entries(DETAIL_STATUSES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</datalist>
      </label>}
      {resource === 'accounts' && <label><span>账户持仓</span><select aria-label="账户持仓" value={draft.hasPosition === '' || draft.hasPosition === undefined ? '' : String(draft.hasPosition)} onChange={event => updateDraft({ hasPosition: event.target.value === '' ? '' : event.target.value === 'true' })}><option value="">全部账户</option><option value="true">持仓账户</option><option value="false">空仓账户</option></select></label>}
      {resource === 'preselections' && <label><span>预选状态</span><input aria-label="预选状态" placeholder="全部 / 输入状态代码" list="quant-preselection-statuses" value={draft.status ?? ''} onChange={event => updateDraft({ status: event.target.value })} /><datalist id="quant-preselection-statuses">{Object.entries(DETAIL_STATUSES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</datalist></label>}
      {resource === 'exit-decisions' && <label><span>判断动作</span><input aria-label="判断动作" placeholder="全部 / 输入动作代码" value={draft.action ?? ''} onChange={event => updateDraft({ action: event.target.value })} /></label>}
      <div className="quant-filter-actions">
        <button type="submit" className="quant-button is-primary"><Search size={14} />查询</button>
        <button type="button" className="quant-button" onClick={clearFilters} disabled={!hasFilters}><X size={14} />清空筛选</button>
      </div>
    </form>
    <QuantFilterStatus pending={JSON.stringify(draft) !== JSON.stringify(filters)} />
    <p className="quant-list-order">{globalSort ? '已对全部筛选记录排序，再按页展示。' : '服务端分页；点击表头可对全部筛选记录排序。'}</p>
    <QuantPagedResults label={`${config.title}列表`} resetKey={JSON.stringify([page, pageSize, sort, filters, reload])} page={page} pageSize={pageSize} total={current?.items && current.available !== false ? current.total : null} loading={loading} onPageChange={setPage} onPageSizeChange={value => { setPageSize(value); setPage(1); }}>
    {loading && <QuantLoadingState label={globalSort ? '正在加载全部筛选记录并排序…' : '正在加载当前页…'} />}
    {current?.error && <QuantErrorState title={`${config.title}加载失败`} message={current.error} onRetry={() => setReload(value => value + 1)} />}
    {current?.available === false ? <QuantAccountsUnavailable /> : items && <>
      {items.length ? <QuantRecordTable resource={resource} items={items} sort={sort} onSortChange={next => { setSort(next); setPage(1); }} identity={{ id: snapshot.strategy_id, name: snapshot.strategy_name }} />
        : <QuantEmptyState title={config.empty} action={hasFilters ? <button type="button" className="quant-button" onClick={clearFilters}>清空筛选</button> : undefined} />}
    </>}
    </QuantPagedResults>
  </QuantSection></div>;
}

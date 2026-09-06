import { useEffect, useState } from 'react';
import { ApiRequestError } from '../../lib/api';
import { assertSnapshot, getQuantDailyResult } from './quant-api';
import { QuantAccountsUnavailable, QuantEmptyState, QuantErrorState, QuantLoadingState, QuantMetricGrid, QuantPagedResults, QuantSection } from './QuantCommon';
import { quantErrorMessage } from './quant-format';
import { QuantRecordTable, quantTableConfig, quantTableSelectors } from './QuantRecordTable';
import { sortQuantItems, type QuantSortState } from './quant-sort';
import type { QuantDailyResult, QuantListResource, QuantResourceItems, QuantStrategy } from './quant-types';
import type { QuantListPageProps } from './QuantRecordsPage';

function DailyCollection<R extends QuantListResource>({ resource, items, identity, available }: { resource: R; items: QuantResourceItems[R][]; identity: Pick<QuantStrategy, 'id' | 'name'>; available?: boolean }) {
  const config = quantTableConfig(resource);
  const [sort, setSort] = useState<QuantSortState>(config.defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const sorted = sortQuantItems(items, sort, quantTableSelectors(resource));
  return <QuantSection title={config.title} meta={config.description}>
    <QuantPagedResults label={`${config.title}列表`} resetKey={JSON.stringify([page, pageSize, sort])} page={page} pageSize={pageSize} total={available === false ? null : items.length} loading={false} onPageChange={setPage} onPageSizeChange={value => { setPageSize(value); setPage(1); }}>
      {available === false ? <QuantAccountsUnavailable /> : items.length ? <QuantRecordTable resource={resource} items={sorted.slice((page - 1) * pageSize, page * pageSize)} sort={sort} onSortChange={value => { setSort(value); setPage(1); }} identity={identity} /> : <QuantEmptyState title={config.empty} />}
    </QuantPagedResults>
  </QuantSection>;
}

export function QuantDailyPage({ snapshot, onSnapshotConflict }: QuantListPageProps) {
  const [collection, setCollection] = useState<QuantListResource>('observations');
  const [data, setData] = useState<QuantDailyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(null);
    void getQuantDailyResult(snapshot.strategy_id, snapshot.trade_date, { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        assertSnapshot(result, snapshot);
        setData(result);
      }).catch(caught => {
        if (controller.signal.aborted) return;
        setError(quantErrorMessage(caught));
        if (caught instanceof ApiRequestError && caught.status === 409) onSnapshotConflict();
      });
    return () => controller.abort();
  }, [snapshot.strategy_id, snapshot.trade_date, snapshot.snapshot_id, reload, onSnapshotConflict]);
  if (error) return <QuantErrorState title="当日完整记录加载失败" message={error} onRetry={() => setReload(value => value + 1)} />;
  if (!data) return <QuantLoadingState label="正在读取所选交易日的完整记录…" />;
  const pools = { accounts: data.accounts, observations: data.observation_pool, signals: data.signals, executions: data.intraday_trading,
    holdings: data.holding_pool, 'closed-trades': data.closed_trades, preselections: data.preselection_pool, 'sell-candidates': data.sell_candidate_pool, 'exit-decisions': data.exit_decisions };
  return <div className="quant-overview">
    <QuantSection title={`${data.trade_date} · 当日完整记录`} meta="所有列表属于同一份公开快照；平仓记录仅属于该交易日。"><QuantMetricGrid summary={data.summary} /></QuantSection>
    <div className="quant-daily-select"><label>查看业务列表 <select aria-label="完整记录业务列表" value={collection} onChange={event => setCollection(event.target.value as QuantListResource)}>{(Object.keys(pools) as QuantListResource[]).map(resource => <option key={resource} value={resource}>{quantTableConfig(resource).title} · {resource === 'accounts' && !data.accounts.available ? '账本不可用' : pools[resource].count}</option>)}</select></label><span>完整记录按需读取，可手动刷新。</span></div>
    <DailyCollection key={collection} resource={collection} items={pools[collection].items} identity={{ id: snapshot.strategy_id, name: snapshot.strategy_name }} available={collection === 'accounts' ? data.accounts.available : undefined} />
  </div>;
}


import { useMemo } from 'react';
import { useQuoteSnapshots } from '../../hooks/useQuoteSnapshots';
import { AUCTION_WINDOW, selectQuoteSnapshots } from '../../lib/quote-snapshots';
import { QuoteSnapshotChart } from './QuoteSnapshotChart';

export function AuctionPanel({ code, tradeDate }: { code: string; tradeDate: string }) {
  const state = useQuoteSnapshots({ kind: 'auctions', code, tradeDate, window: AUCTION_WINDOW });
  const items = useMemo(() => selectQuoteSnapshots(state.data?.items ?? [], 'auctions'), [state.data]);
  return (
    <aside className="auction-panel" aria-label="盘前集合竞价">
      <div className="auction-panel-heading"><strong>集合竞价</strong><span>09:15–09:30</span></div>
      <div className="auction-phases"><span>09:15 可撤单</span><span>09:20 不可撤单</span><span>09:25 结果</span></div>
      {state.delayed && items.length > 0 && <div className="snapshot-notice" role="status">竞价数据可能延迟</div>}
      {state.data?.possiblyTruncated && <div className="snapshot-notice" role="status">竞价数据可能未完整返回</div>}
      {items.length > 0 ? <QuoteSnapshotChart items={items} auction datasetKey={`${code}:${tradeDate}:auction`} /> : (
        <div className="terminal-empty snapshot-empty" role="status">
          {state.initialLoading ? <><span className="loading-pulse" />集合竞价加载中</>
            : state.error ? <><span>集合竞价暂不可用</span><button type="button" onClick={state.refresh}>重试</button></>
            : <><span>{state.data?.items.length ? '暂无有效竞价报价' : '暂无当日集合竞价数据'}</span><small>09:15–09:30 盘前采集</small></>}
        </div>
      )}
    </aside>
  );
}

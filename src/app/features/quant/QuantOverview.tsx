import { useState } from 'react';
import { QuantEmptyState, QuantMetricGrid, QuantSection } from './QuantCommon';
import { formatQuantNumber, quantDetailPresentation, quantObservationPresentation } from './quant-format';
import { QuantFieldList } from './QuantDetails';
import { QuantPerformance } from './QuantPerformance';
import { QuantRecordTable, quantTableSelectors } from './QuantRecordTable';
import { sortQuantItems, type QuantSortState } from './quant-sort';
import type { QuantOverviewData, QuantPerformancePoint } from './quant-types';

export function QuantOverview({ data, latest, performance, onOpenSignals }: {
  data: QuantOverviewData; latest: QuantOverviewData; performance: QuantPerformancePoint[]; onOpenSignals: () => void;
}) {
  const [sort, setSort] = useState<QuantSortState>({ key: 'signalAt', direction: 'desc' });
  const signals = sortQuantItems(data.signal_summary.recent_items ?? [], sort, quantTableSelectors('signals'));
  const states = data.observation_summary.state_counts ?? {};
  const detailStates = data.observation_summary.detail_state_counts ?? {};
  return <div className="quant-overview">
    <QuantSection title="账户总览" meta="人民币元 · 累计盈亏已计入费用，当日成交金额与费用按所选交易日统计">
      <QuantMetricGrid summary={data.summary} />
      <div className="quant-state-counts quant-summary-counts">{[
        ['纳入统计账户', data.summary.account_count], ['观察记录', data.summary.observation_count], ['买卖信号', data.summary.signal_count],
        ['买入预选', data.summary.preselection_count], ['卖出候选', data.summary.sell_candidate_count],
      ].map(([label, count]) => <div key={label}><span>{label}</span><strong>{formatQuantNumber(count as number | null | undefined)}</strong></div>)}</div>
      <details className="quant-summary-details"><summary>查看全部汇总与收益口径</summary><p className="quant-detail-note">汇总仅纳入曾实际买入的账户，已清仓账户继续计入，从未买入者排除。本金、现金、总资产与收益率直接使用后端汇总；新增本金不是盈利。单股账户、单笔持仓与平仓收益分别按所属范围展示，净盈亏已含对应费用。</p><QuantFieldList model="Summary" data={data.summary} /></details>
    </QuantSection>
    <QuantPerformance snapshot={latest} points={performance} />
    <QuantSection title="最近买卖信号" meta={`所选交易日共 ${formatQuantNumber(data.signal_summary.count)} 条信号，以下为摘要记录`} action={<button type="button" className="quant-text-button" onClick={onOpenSignals}>查看全部信号</button>}>
      {signals.length ? <QuantRecordTable resource="signals" items={signals} sort={sort} onSortChange={setSort} identity={{ id: data.strategy_id, name: data.strategy_name }} /> : <QuantEmptyState title="当前快照未返回最近信号" />}
    </QuantSection>
    <QuantSection title="观察细分状态统计" meta="细分状态与通用状态分别统计，以接口返回值为准。">
      {Object.keys(detailStates).length ? <div className="quant-state-counts">{Object.entries(detailStates).map(([state, count]) => {
        const presentation = quantDetailPresentation(state);
        return <div key={state}><span className={`is-${presentation.tone}`}>{presentation.label}</span><strong>{formatQuantNumber(count)}</strong></div>;
      })}</div> : <QuantEmptyState title="当前快照未返回细分状态统计" />}
    </QuantSection>
    <QuantSection title="观察状态统计" meta={`观察记录 ${formatQuantNumber(data.observation_summary.count)} 条 · 观察不等于买卖信号`}>
      {Object.keys(states).length ? <div className="quant-state-counts">{Object.entries(states).map(([state, count]) => {
        const presentation = quantObservationPresentation(state);
        return <div key={state}><span className={`is-${presentation.tone}`}>{presentation.label}</span><strong>{formatQuantNumber(count)}</strong></div>;
      })}</div> : <QuantEmptyState title="当前快照未返回观察统计" />}
    </QuantSection>
  </div>;
}


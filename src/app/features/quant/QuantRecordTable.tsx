import type { ReactNode } from 'react';
import { QuantActionBadge, QuantPnlPair, QuantSortableHeader, QuantStatusBadge, QuantTableFrame, QuantTableTime } from './QuantCommon';
import { formatQuantMoney, formatQuantNumber, formatQuantPrice, parseQuantDateTime, quantActionPresentation } from './quant-format';
import { formatQuantReason, quantPositionPresentation } from './quant-format';
import { formatQuantField } from './quant-field-format';
import { QuantRecordDetailButton } from './QuantDetails';
import type { QuantSortState, QuantSortValue } from './quant-sort';
import type { QuantAccount, QuantCandidate, QuantClosedTrade, QuantExecution, QuantExitDecision, QuantHolding, QuantListResource, QuantObservation, QuantResourceItems, QuantSignal, QuantStrategy } from './quant-types';

interface Column<T> { key: string; label: string; value: (item: T) => QuantSortValue; render: (item: T) => ReactNode }
interface TableConfig<T> { title: string; empty: string; description: string; defaultSort: QuantSortState; columns: Column<T>[] }
type NumberValue<T> = (item: T) => number | null | undefined;
type TextValue<T> = (item: T) => string | null | undefined;
const number = <T,>(key: string, label: string, value: NumberValue<T>, format = formatQuantMoney): Column<T> => ({ key, label, value, render: item => format(value(item)) });
const time = <T,>(key: string, label: string, value: TextValue<T>): Column<T> => ({ key, label, value: item => parseQuantDateTime(value(item)), render: item => <QuantTableTime value={value(item)} /> });
const stock = <T extends { code: string; name?: string | null },>(): Column<T> => ({ key: 'stock', label: '股票', value: item => item.code, render: item => <><strong>{item.name ?? '—'}</strong><small>{item.code}</small></> });
const action = <T extends { action?: string | null },>(observation = false): Column<T> => ({ key: 'action', label: observation ? '观察方向' : '买卖方向', value: item => item.action, render: item => <QuantActionBadge {...quantActionPresentation(item.action, observation)} /> });
const pnl = <T,>(key: string, label: string, amount: NumberValue<T>, ratio: NumberValue<T>): Column<T> => ({ key, label, value: amount, render: item => <QuantPnlPair amount={amount(item)} ratio={ratio(item)} /> });
const reason = <T extends { reason?: string | null; status?: string | null; state?: string | null },>(): Column<T> => {
  const value = (item: T) => formatQuantReason(item.reason, item.status ?? item.state);
  return { key: 'reason', label: '原因', value, render: item => <span className="quant-record-reason">{value(item)}</span> };
};
const detailStatus = <T,>(value: TextValue<T>): Column<T> => ({ key: 'detailStatus', label: '细分状态', value, render: item => <QuantStatusBadge value={value(item)} kind="detail" /> });

const accounts: TableConfig<QuantAccount> = {
  title: '逐股独立账户', empty: '当前筛选条件下暂无账户记录', description: '包含未交易与空仓账户。收益率属于单股独立账户；金额：元。', defaultSort: { key: 'stock', direction: 'asc' },
  columns: [stock(), number('initialCapital', '初始本金（元）', item => item.initial_capital), number('cash', '现金（元）', item => item.cash_balance),
    number('marketValue', '市值（元）', item => item.market_value), number('assets', '总资产（元）', item => item.total_assets),
    number('realizedPnl', '已实现盈亏（元）', item => item.realized_pnl), number('unrealizedPnl', '浮盈亏（元）', item => item.unrealized_pnl),
    pnl('totalPnl', '累计盈亏 / 收益率', item => item.total_pnl, item => item.total_return),
    { key: 'hasPosition', label: '持仓状态', value: item => item.has_position, render: item => <QuantActionBadge {...quantPositionPresentation(item.has_position)} /> },
    number('shares', '数量（股）', item => item.shares, formatQuantNumber)],
};

const observations: TableConfig<QuantObservation> = {
  title: '观察列表', empty: '当前筛选条件下暂无观察记录', description: '观察不等于买卖信号。', defaultSort: { key: 'stock', direction: 'asc' },
  columns: [stock(), action(true),
    { key: 'state', label: '观察状态', value: item => item.state, render: item => <QuantStatusBadge value={item.state} kind="observation" /> },
    detailStatus(item => item.state_detail), reason(), time('dataAt', '数据时点', item => item.last_complete_bar_at),
    { key: 'dataStatus', label: '数据状态', value: item => item.data_status, render: item => <QuantStatusBadge value={item.data_status} kind="data" /> },
  ],
};
const signals: TableConfig<QuantSignal> = {
  title: '买卖信号', empty: '当前筛选条件下暂无买卖信号', description: '成交字段仅展示已有模拟成交记录。', defaultSort: { key: 'signalAt', direction: 'desc' },
  columns: [stock(), action(), time('signalAt', '信号时间', item => item.signal_at),
    number('signalPrice', '信号价（元/股）', item => item.signal_price, formatQuantPrice),
    { key: 'status', label: '信号状态', value: item => item.status, render: item => <QuantStatusBadge value={item.status} kind="signal" /> },
    detailStatus(item => item.status_detail), reason(),
    time('executionAt', '模拟成交时间', item => item.execution_at),
    number('executionPrice', '成交价（元/股）', item => item.execution_price, formatQuantPrice),
    number('shares', '成交数量（股）', item => item.shares, formatQuantNumber),
  ],
};
const executions: TableConfig<QuantExecution> = {
  title: '当日模拟成交', empty: '当前筛选条件下暂无模拟成交', description: '所选交易日的成交金额与费用，金额单位：元。', defaultSort: { key: 'executionAt', direction: 'desc' },
  columns: [stock(), action(), time('executionAt', '成交时间', item => item.execution_at),
    number('executionPrice', '成交价（元/股）', item => item.execution_price, formatQuantPrice),
    number('shares', '数量（股）', item => item.shares, formatQuantNumber),
    number('notional', '成交金额（元）', item => item.notional),
    number('commission', '佣金（元）', item => item.commission),
    number('stampDuty', '印花税（元）', item => item.stamp_duty),
    number('fees', '总费用（元）', item => item.total_fees),
    number('cashFlow', '现金流（元）', item => item.cash_flow),
  ],
};
const holdings: TableConfig<QuantHolding> = {
  title: '所选日期持仓', empty: '当前筛选条件下暂无持仓记录', description: '单笔持仓毛、净收益分开展示；净盈亏已计入费用。账户当日收益含持仓与交易影响。', defaultSort: { key: 'stock', direction: 'asc' },
  columns: [stock(), number('shares', '数量（股）', item => item.shares, formatQuantNumber), time('entryAt', '建仓时间', item => item.entry_execution_at),
    number('entryPrice', '买入价（元/股）', item => item.entry_execution_price, formatQuantPrice),
    number('cost', '持仓成本（元）', item => item.cost_basis),
    number('markPrice', '估值价（元/股）', item => item.mark_price, formatQuantPrice),
    number('marketValue', '持仓市值（元）', item => item.market_value),
    pnl('grossPnl', '持仓毛盈亏 / 收益率', item => item.gross_total_pnl, item => item.gross_total_return),
    pnl('totalPnl', '持仓净盈亏 / 收益率', item => item.total_pnl, item => item.total_return),
    pnl('accountDayPnl', '账户当日盈亏 / 收益率', item => item.account_day_pnl, item => item.account_day_return),
    { key: 'sellable', label: '可卖状态', value: item => item.t1_locked ? false : item.sellable_today, render: item =>
      item.t1_locked === true ? <QuantActionBadge label="T+1 锁定" tone="warning" />
        : item.sellable_today === true ? <QuantActionBadge label="今日可卖" tone="accent" />
          : item.sellable_today === false ? <QuantActionBadge label="今日不可卖" tone="neutral" /> : '—' },
    time('markedAt', '估值时间', item => item.marked_at),
  ],
};
const closed: TableConfig<QuantClosedTrade> = {
  title: '当日平仓记录', empty: '当前筛选条件下暂无当日平仓记录', description: '仅包含所选交易日完成的平仓交易，净盈亏已计入总费用。', defaultSort: { key: 'exitAt', direction: 'desc' },
  columns: [stock(), time('entryAt', '买入时间', item => item.entry_execution_at), time('exitAt', '卖出时间', item => item.exit_execution_at),
    number('entryPrice', '买入价（元/股）', item => item.entry_execution_price, formatQuantPrice),
    number('exitPrice', '卖出价（元/股）', item => item.exit_execution_price, formatQuantPrice),
    number('shares', '数量（股）', item => item.shares, formatQuantNumber),
    number('fees', '总费用（元）', item => item.total_fees),
    number('grossPnl', '毛盈亏（元）', item => item.gross_pnl),
    pnl('netPnl', '净盈亏 / 净收益率', item => item.net_pnl, item => item.net_return),
  ],
};

const candidates: TableConfig<QuantCandidate> = {
  title: '买入预选', empty: '当前筛选条件下暂无买入预选', description: '预选与候选尚不代表买卖信号或成交。', defaultSort: { key: 'stock', direction: 'asc' },
  columns: [stock(), reason(), number('referencePrice', '参考价格（元/股）', item => item.reference_price, formatQuantPrice),
    { key: 'status', label: '状态', value: item => item.status, render: item => <QuantStatusBadge value={item.status} kind="detail" /> }],
};
const exits: TableConfig<QuantExitDecision> = {
  title: '持有与退出判断', empty: '当前筛选条件下暂无退出判断', description: '判断记录不等于成交记录，估算净收益不等于已实现收益。', defaultSort: { key: 'decisionAt', direction: 'desc' },
  columns: [stock(), time('decisionAt', '判断时点', item => item.at),
    { key: 'before', label: '判断前 → 后', value: item => item.state_after, render: item => <>{formatQuantField('state_before', item.state_before)} → {formatQuantField('state_after', item.state_after)}</> },
    { key: 'action', label: '动作', value: item => item.action, render: item => formatQuantField('action', item.action) }, reason(),
    { key: 'allowDelay', label: '允许延期', value: item => item.allow_delay, render: item => formatQuantField('allow_delay', item.allow_delay) },
    { key: 'estimatedReturn', label: '估算净收益率', value: item => item.estimated_net_return, render: item => formatQuantField('estimated_net_return', item.estimated_net_return) },
    { key: 'anomaly', label: '数据异常', value: item => item.data_anomaly, render: item => <span className={item.data_anomaly ? 'is-danger' : undefined}>{formatQuantField('data_anomaly', item.data_anomaly)}</span> }],
};
const configs = { accounts, observations, signals, executions, holdings, 'closed-trades': closed, preselections: candidates,
  'sell-candidates': { ...candidates, title: '卖出候选', empty: '当前筛选条件下暂无卖出候选' }, 'exit-decisions': exits };
export function quantTableConfig<R extends QuantListResource>(resource: R): TableConfig<QuantResourceItems[R]> {
  return configs[resource] as TableConfig<QuantResourceItems[R]>;
}
export function quantTableSelectors<R extends QuantListResource>(resource: R) {
  return Object.fromEntries(quantTableConfig(resource).columns.map(column => [column.key, column.value]));
}

export function QuantRecordTable<R extends QuantListResource>({ resource, items, sort, onSortChange, identity }: {
  resource: R; items: QuantResourceItems[R][]; sort: QuantSortState; onSortChange: (sort: QuantSortState) => void; identity?: Pick<QuantStrategy, 'id' | 'name'>;
}) {
  const config = quantTableConfig(resource);
  return <QuantTableFrame>
    <table role="table" className="quant-table quant-public-table" aria-label={config.title}>
      <thead role="rowgroup"><tr role="row">{config.columns.map(column => <QuantSortableHeader key={column.key} label={column.label} column={column.key} sort={sort} onSortChange={onSortChange} defaultDirection={column.key.endsWith('At') ? 'desc' : 'asc'} />)}<th scope="col">详情</th></tr></thead>
      <tbody role="rowgroup">{items.map((item, index) => <tr role="row" key={`${item.code}:${index}`}>
        {config.columns.map(column => <td role="cell" key={column.key} data-label={column.label}>{column.render(item)}</td>)}
        <td role="cell" data-label="详情"><QuantRecordDetailButton resource={resource} item={item} title={config.title} identity={identity} /></td>
      </tr>)}</tbody>
    </table>
  </QuantTableFrame>;
}

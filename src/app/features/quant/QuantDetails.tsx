import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { QUANT_DETAIL_FIELDS } from './quant-detail-fields';
import { formatQuantField, quantFieldLabel } from './quant-field-format';
import { formatQuantNumber, formatQuantReason, isQuantReasonField, quantDetailPresentation } from './quant-format';
import type { QuantListResource, QuantResourceItems, QuantStrategy } from './quant-types';

type DetailModel = keyof typeof QUANT_DETAIL_FIELDS;
type PublicIdentity = Pick<QuantStrategy, 'id' | 'name'>;
const RESOURCE_MODELS: Record<QuantListResource, DetailModel> = {
  accounts: 'Account', observations: 'Observation', signals: 'Signal', executions: 'Execution', holdings: 'Holding',
  'closed-trades': 'ClosedTrade', preselections: 'Candidate', 'sell-candidates': 'Candidate', 'exit-decisions': 'ExitDecision',
};
const FIELD_GROUPS: { title: string; fields: readonly string[] }[] = [
  { title: '记录与状态', fields: ['code', 'name', 'action', 'state', 'state_detail', 'status', 'status_detail', 'reason', 'data_status', 'data_status_detail', 'at', 'last_complete_bar_at', 'signal_at', 'signal_price', 'execution_at', 'execution_price', 'shares', 'has_position', 'reference_price'] },
  { title: '成交口径与费用', fields: ['execution_reference_price', 'execution_price_source', 'previous_close', 'daily_price_limit', 'execution_bar_low', 'execution_bar_high', 'slippage_rate', 'notional', 'commission', 'stamp_duty', 'total_fees', 'cash_flow'] },
  { title: '持有与退出判断', fields: ['entry_at', 'exit_state', 'state_before', 'state_after', 'original_sell', 'allow_delay', 'deferred_from', 'exit_reason', 'adx_state', 'adx', 'adx_3_days_ago', 'quote_price', 'quote_net_proceeds', 'entry_cost', 'estimated_net_return', 'data_anomaly'] },
];

function publicNestedEntries(value: Record<string, unknown>, identity?: PublicIdentity) {
  return Object.entries(value).flatMap(([key, entry]) => {
    if (/strategy/i.test(key) && /(name|id)/i.test(key)) {
      if (key === 'strategy_name' && identity) return [[key, identity.name] as const];
      if (key === 'strategy_id' && identity) return [[key, identity.id] as const];
      return [];
    }
    return [[key, entry] as const];
  });
}

function FieldValue({ field, value, model, identity, status }: { field: string; value: unknown; model: string; identity?: PublicIdentity; status?: unknown }): ReactNode {
  if (isQuantReasonField(field)) return formatQuantReason(value, status);
  if (Array.isArray(value)) return value.length ? <ul className="quant-detail-values">{value.map((item, index) => <li key={index}><FieldValue field={field} value={item} model={model} identity={identity} /></li>)}</ul> : <span>无已保存记录</span>;
  if (value && typeof value === 'object') {
    const entries = publicNestedEntries(value as Record<string, unknown>, identity);
    return entries.length ? <dl className="quant-detail-nested">{entries.map(([key, entry]) => <div key={key}><dt>{field === 'observation_state_counts' ? quantDetailPresentation(key).label : quantFieldLabel(key)}</dt><dd><FieldValue field={key} value={entry} model={model} identity={identity} /></dd></div>)}</dl> : <span>—</span>;
  }
  return formatQuantField(field, value, model);
}

export function QuantFieldList({ model, data, fields, identity }: { model: DetailModel; data: object; fields?: readonly string[]; identity?: PublicIdentity }) {
  const source = data as Record<string, unknown>;
  const allowed = QUANT_DETAIL_FIELDS[model] as readonly string[];
  const visible = (fields ?? allowed).filter(field => allowed.includes(field) && source[field] !== undefined);
  return <dl className="quant-detail-fields">{visible.map(field => <div key={field} className={source[field] && typeof source[field] === 'object' || field.endsWith('reason') || field === 'last_error' ? 'is-wide' : undefined}>
    <dt>{model === 'Summary' && field === 'total_fees' ? '当日成交费用（元）' : model === 'Summary' && field === 'unrealized_return' ? '未实现收益率（全账户）' : quantFieldLabel(field)}</dt>
    <dd><FieldValue field={field} value={model === 'StrategyDetail' && identity && (field === 'id' || field === 'name') ? identity[field] : source[field]} model={model} identity={identity} status={source.status ?? source.state} /></dd>
  </div>)}</dl>;
}

export function QuantRecordDetails<R extends QuantListResource>({ resource, item, identity }: { resource: R; item: QuantResourceItems[R]; identity?: PublicIdentity }) {
  const model = RESOURCE_MODELS[resource];
  const source = item as unknown as Record<string, unknown>;
  const grouped = new Set(FIELD_GROUPS.flatMap(group => group.fields));
  const other = (QUANT_DETAIL_FIELDS[model] as readonly string[]).filter(field => !grouped.has(field) && field !== 'attempts' && field !== 'attempt_count');
  const groups = [...FIELD_GROUPS, { title: resource === 'accounts' ? '独立账户资产与收益' : '资产、收益与关联记录', fields: other }];
  const savedAttempts = resource === 'signals' && Array.isArray(source.attempts) ? source.attempts : null;
  return <div className="quant-detail-body">
    {resource === 'observations' && <p className="quant-detail-note">观察、条件满足、产生信号和模拟成交是不同阶段，请结合通用状态与细分状态查看。</p>}
    {resource === 'accounts' && <p className="quant-detail-note">此处为单股独立账户收益，以该账户初始本金为口径；空仓账户也保留资产和交易后的累计盈亏。</p>}
    {(resource === 'holdings' || resource === 'closed-trades') && <p className="quant-detail-note">此处收益属于单笔持仓或平仓交易。净盈亏已计入对应费用；股票相对昨收涨跌与账户当日收益分别展示。</p>}
    {resource === 'exit-decisions' && <p className="quant-detail-note">判断记录不等于成交记录，估算净收益不等于已实现收益。</p>}
    {groups.map(group => group.fields.some(field => source[field] !== undefined && (QUANT_DETAIL_FIELDS[model] as readonly string[]).includes(field)) ? <section key={group.title}><h3>{group.title}</h3><QuantFieldList model={model} data={item} fields={group.fields} identity={identity} /></section> : null)}
    {resource === 'signals' && <section><h3>执行尝试</h3><p className="quant-detail-note">累计尝试 {formatQuantNumber(source.attempt_count as number | null)} 次 · 已保存 {savedAttempts ? formatQuantNumber(savedAttempts.length) : '—'} 条明细。保存记录可能少于累计次数。</p>
      {savedAttempts?.length ? savedAttempts.map((attempt, index) => <section className="quant-attempt" key={index}><h4>已保存明细 {index + 1}</h4><QuantFieldList model="ExecutionAttempt" data={attempt} identity={identity} /></section>) : <p className="quant-detail-note">{savedAttempts ? '暂无已保存的执行尝试明细' : '执行尝试明细不可得'}</p>}
    </section>}
  </div>;
}

export function QuantRecordDetailButton<R extends QuantListResource>({ resource, item, title, identity }: { resource: R; item: QuantResourceItems[R]; title: string; identity?: PublicIdentity }) {
  return <Dialog><DialogTrigger asChild><button type="button" className="quant-text-button" aria-label={`查看 ${item.code} 详情`}>详情</button></DialogTrigger>
    <DialogContent className="quant-detail-dialog" overlayClassName="quant-detail-overlay"><DialogHeader><DialogTitle>{identity ? `${identity.name} · ` : ''}{item.name ?? item.code}</DialogTitle><DialogDescription>{title} · {item.code} · 模拟账户 · 金额：元，价格：元/股，数量：股 · 时间：上海</DialogDescription></DialogHeader>
      <QuantRecordDetails resource={resource} item={item} identity={identity} />
    </DialogContent>
  </Dialog>;
}

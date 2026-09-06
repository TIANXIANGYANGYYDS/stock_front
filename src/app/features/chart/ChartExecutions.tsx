import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { formatQuantDateTime, formatQuantMoney, formatQuantNumber, recordingLabel } from '../quant/quant-format';
import { formatRecordedExecutionPrice } from './execution-markers';
import type { ChartExecutionState } from './useChartExecutions';

const PRICE_NOTE = '成交价为当时记录值，日K为前复权价格';
export function ChartExecutions({ state, portalContainer }: { state: ChartExecutionState; portalContainer?: HTMLElement | null }) {
  const { result, model, strategy } = state;
  const data = result.data;
  const error = state.catalogError || result.error;
  const items = model.filled.filter(item => !state.selectedDate || item.trade_date === state.selectedDate);
  const unlocated = new Set(model.unlocated.map(item => item.event_id));
  const history = data?.history;
  return <div className="chart-executions" aria-label="日K成交标记">
    <div className="chart-execution-controls">
      <label><input type="checkbox" checked={state.enabled} onChange={event => state.setEnabled(event.target.checked)} />买卖标记</label>
      {state.enabled && <>
        <select aria-label="图表成交策略" value={strategy?.id ?? ''} disabled={!state.catalog?.length} onChange={event => state.setSelectedId(event.target.value)}>
          {!state.catalog?.length && <option value="">{state.catalog ? '暂无公开策略' : '加载策略…'}</option>}
          {state.catalog?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        <select aria-label="图表成交方向" value={state.action} onChange={event => state.setAction(event.target.value as '' | 'buy' | 'sell')}>
          <option value="">买入与卖出</option><option value="buy">买入</option><option value="sell">卖出</option>
        </select>
        <button type="button" disabled={!data} onClick={() => state.showDetails()}>成交明细{data ? ` · ${model.filled.length} 笔` : ''}</button>
        <button type="button" onClick={state.retry} disabled={result.loading}>刷新成交</button>
        <details className="chart-execution-range"><summary>日期区间</summary>
          <form key={`${state.code}:${state.startDate}:${state.endDate}`} onSubmit={event => {
            event.preventDefault();
            const form = event.currentTarget;
            const start = form.elements.namedItem('start') as HTMLInputElement;
            const end = form.elements.namedItem('end') as HTMLInputElement;
            end.setCustomValidity(start.value > end.value ? '结束日期不能早于开始日期' : '');
            if (form.reportValidity()) state.setRange(start.value, end.value);
          }}>
            <label>开始<input aria-label="成交开始日期" name="start" type="date" required defaultValue={state.startDate} onChange={event => { const end = event.currentTarget.form?.elements.namedItem('end') as HTMLInputElement; end?.setCustomValidity(''); }} /></label>
            <label>结束<input aria-label="成交结束日期" name="end" type="date" required defaultValue={state.endDate} onChange={event => event.target.setCustomValidity('')} /></label>
            <button type="submit">查询成交</button><button type="button" onClick={state.resetRange}>使用日K区间</button>
          </form>
        </details>
      </>}
    </div>
    {state.enabled && <div className="chart-execution-status">
      {error ? <span role="alert">成交标记加载失败：{error} <button type="button" onClick={state.retry}>重试成交</button></span>
        : result.loading || !state.catalog ? <span role="status">正在核对成交历史…</span>
          : data ? <>
            <span>{data.start_date} 至 {data.end_date} · {model.filled.length ? `买入 ${model.filled.filter(item => item.action === 'buy').length} 笔 · 卖出 ${model.filled.filter(item => item.action === 'sell').length} 笔` : '该区间没有已成交记录'}</span>
            {model.unlocated.length > 0 && <button type="button" onClick={() => state.showDetails()}>{model.unlocated.length} 笔无法在当前日K定位，查看详情</button>}
            {!!history?.incomplete_trade_dates?.length && <span className="is-warning">区间内 {history.incomplete_trade_dates.length} 个交易日的账户快照有数据缺口，不代表当前股票行情全部缺失。</span>}
            <span>点击买卖标记查看当日成交明细 · {PRICE_NOTE}</span>
          </> : <span>{state.catalog.length ? '等待股票日K日期' : '暂无公开策略'}</span>}
    </div>}
    <Dialog open={state.open} onOpenChange={open => { if (!open) state.close(); }}>
      <DialogContent className="quant-detail-dialog chart-execution-dialog" overlayClassName="quant-detail-overlay" portalContainer={portalContainer}>
        <DialogHeader><DialogTitle>{strategy?.name} · {state.code} · {state.selectedDate ?? '区间'}成交</DialogTitle><DialogDescription>{PRICE_NOTE}。日线标记对应交易日，具体成交时刻见下方记录。金额：人民币元，数量：股，时间：上海。</DialogDescription></DialogHeader>
        <div className="quant-detail-body">
          {history && <details className="chart-execution-history"><summary>数据说明与历史覆盖</summary>
            <p>记录性质：模拟账户成交。</p>
            <p>日快照覆盖：{history.covered_start_date ?? '—'} 至 {history.covered_end_date ?? '—'} · {formatQuantNumber(history.trade_day_count)} 个交易日。覆盖日期不代表本股首末成交日期。</p>
            <p>{history.recording_modes?.map(mode => recordingLabel(mode as Parameters<typeof recordingLabel>[0])).join('、') || '未注明'}</p>
            <p>计算时间 {formatQuantDateTime(history.computed_at)} · 历史重建 {formatQuantDateTime(history.history_rebased_at)} · 账户重算 {formatQuantDateTime(history.accounting_rebased_at)}（均非成交时间）</p>
            <p>账户记录起点：{history.recording_start_dates?.join('、') || '—'} · 策略业务版本：{history.strategy_versions?.join('、') || '—'}</p>
            <p>有数据缺口的快照日期：{history.incomplete_trade_dates ? history.incomplete_trade_dates.join('、') || '无' : '—'}</p>
          </details>}
          {!items.length && <p>所选条件下没有已成交记录。</p>}
          {items.map(item => <article className="chart-execution-record" key={`${data?.strategy_id}:${item.event_id}`}>
            <h3>{item.code} {item.name ?? '—'} · {item.action === 'buy' ? '买入' : item.action === 'sell' ? '卖出' : '方向不可得'}</h3>
            {unlocated.has(item.event_id) && <p className="is-warning">当前日K缺少对应交易日期或记录缺少定位信息，已保留成交明细，未移动到其他日期。</p>}
            <dl className="quant-detail-fields">
              {[['策略', strategy?.name ?? '—'], ['交易日', item.trade_date ?? '—'], ['成交时间', formatQuantDateTime(item.execution_at)],
                ['原始成交价（元/股）', formatRecordedExecutionPrice(item.execution_price)], ['成交股数（股）', formatQuantNumber(item.shares)],
                ['成交金额（元）', formatQuantMoney(item.notional)], ['佣金（元）', formatQuantMoney(item.commission)],
                ['印花税（元）', formatQuantMoney(item.stamp_duty)], ['总费用（元）', formatQuantMoney(item.total_fees)],
                ['现金流（元）', formatQuantMoney(item.cash_flow)], ['记录模式', recordingLabel(item.recording?.mode)],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <details><summary>来源记录时间</summary><p>补录计算 {formatQuantDateTime(item.recording?.computed_at)} · 历史重建 {formatQuantDateTime(item.recording?.history_rebased_at)} · 账户重算 {formatQuantDateTime(item.recording?.accounting_rebased_at)}（均非成交时间）</p></details>
          </article>)}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

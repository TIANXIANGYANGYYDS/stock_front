import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { QuantEmptyState, QuantSection } from './QuantCommon';
import { formatQuantDateTime, formatQuantMoney, formatQuantRatio, quantDataStatusPresentation, recordingLabel } from './quant-format';
import type { QuantOverviewData, QuantPerformancePoint } from './quant-types';

const METRICS = {
  total_return: { label: '累计收益率', format: formatQuantRatio },
  total_assets: { label: '总资产（元）', format: formatQuantMoney },
  total_pnl: { label: '累计盈亏（元）', format: formatQuantMoney },
};
type Metric = keyof typeof METRICS;
export function performancePointLabel(point: QuantPerformancePoint) {
  if (point.runtime.data_status === 'closed' || point.runtime.data_status === 'closed_partial') return '收盘记录';
  return '盘中 / 非最终收盘记录';
}

export function QuantPerformance({ snapshot, points }: { snapshot: QuantOverviewData; points: QuantPerformancePoint[] }) {
  const [metric, setMetric] = useState<Metric>('total_return');
  const selected = METRICS[metric];
  const plotted = points.map(point => ({ ...point, value: point.summary[metric] ?? null }));
  return <QuantSection title="收益曲线" meta={`统计区间 ${snapshot.recording.start_date ?? '—'} 至 ${snapshot.trade_date} · 数据截至日期 ${snapshot.trade_date}`} action={
    <label className="quant-chart-selector">展示指标<select aria-label="收益曲线指标" value={metric} onChange={event => setMetric(event.target.value as Metric)}>
      {Object.entries(METRICS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
    </select></label>
  }>
    {points.length === 0 ? <QuantEmptyState title="该日期范围暂无正式收益记录" /> : <>
          <div className="quant-performance-chart" aria-label={`${snapshot.strategy_name} ${selected.label}曲线`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={plotted} margin={{ top: 16, right: 24, bottom: 12, left: 18 }} accessibilityLayer>
                <CartesianGrid stroke="var(--terminal-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="trade_date" tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} minTickGap={40} />
                <YAxis width={metric === 'total_assets' ? 115 : 88} domain={['auto', 'auto']} tickFormatter={value => selected.format(value)} tick={{ fill: 'var(--terminal-muted)', fontSize: 10 }} />
                <Tooltip content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as QuantPerformancePoint | undefined;
                  if (!active || !point) return null;
                  return <div className="quant-chart-tooltip"><strong>{point.trade_date} · {performancePointLabel(point)}</strong>
                    <span>{snapshot.strategy_name} · {selected.label} {selected.format(point.summary[metric])}</span>
                    <span>{recordingLabel(point.recording.mode)} · {quantDataStatusPresentation(point.runtime.data_status).label}</span>
                    <small>数据更新 {formatQuantDateTime(point.updated_at)}</small>
                  </div>;
                }} />
                <Line type="linear" dataKey="value" name={`${snapshot.strategy_name} · ${selected.label}`} stroke="var(--terminal-accent)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="quant-list-order">共 {points.length} 个交易日记录；仅绘制已有数据。收益率使用全部初始本金口径，盈亏已计入费用。</p>
          <details className="quant-performance-records"><summary>查看日度资产与收益数值</summary>
            <div className="quant-table-frame"><table className="quant-table" aria-label="日度资产与收益"><thead><tr><th>交易日期</th><th>记录状态</th><th>累计收益率</th><th>总资产（元）</th><th>累计盈亏（元）</th></tr></thead>
              <tbody>{points.map(point => <tr key={point.trade_date}><td data-label="交易日期">{point.trade_date}</td><td data-label="记录状态">{performancePointLabel(point)}<small>{recordingLabel(point.recording.mode)} · {quantDataStatusPresentation(point.runtime.data_status).label}</small></td><td data-label="累计收益率">{formatQuantRatio(point.summary.total_return)}</td><td data-label="总资产（元）">{formatQuantMoney(point.summary.total_assets)}</td><td data-label="累计盈亏（元）">{formatQuantMoney(point.summary.total_pnl)}</td></tr>)}</tbody>
            </table></div>
          </details>
        </>}
  </QuantSection>;
}

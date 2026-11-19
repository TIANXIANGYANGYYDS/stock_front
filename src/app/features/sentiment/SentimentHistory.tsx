import type { SentimentScope, SentimentMeta } from './sentiment-contract';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { atConsistentSnapshot, sentimentApi, snapshotQuery } from './sentiment-api';
import { useSentimentResource } from './useSentiment';
import { EnvironmentWindows } from './SentimentEnvironment';
import { publicationKey } from './sentiment-publication';
import { buildHistorySeries, historyTimeLabel } from './sentiment-history-series';

export function DataNotice({ error, loading, retry }: { error: string | null; loading: boolean; retry?: () => void }) {
  return <div className={`sent-data-notice${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{error ?? (loading ? '正在读取已发布数据…' : '暂无观测记录')}{error && retry && <button type="button" className="sent-button" onClick={retry}>重试</button>}</div>;
}
export function SentimentHistory({ tradeDate, themeId, meta, onConflict, scope = 'all_a' }: { scope?: SentimentScope; tradeDate: string; themeId?: string; meta?: SentimentMeta; onConflict?: () => void }) {
  const [interval, setInterval] = useState<'1m' | '5m' | '1d'>('1m');
  const startDate = interval !== '1d' ? tradeDate : new Date(Date.parse(`${tradeDate}T00:00:00Z`) - 19 * 86400000).toISOString().slice(0, 10);
  const key = `${scope}:${tradeDate}:${themeId ?? 'market'}:${interval}`;
  const version = meta ? publicationKey(meta) : '';
  const requestKey = `${key}:${version}`;
  const conflictKey = useRef<string>();
  const resource = useSentimentResource(key, async signal => {
    if (meta) return sentimentApi.timeseries({ ...snapshotQuery(meta), interval, start_date: startDate, end_date: tradeDate, theme_id: themeId }, signal);
    const result = await atConsistentSnapshot(tradeDate, meta => sentimentApi.timeseries({ ...snapshotQuery(meta), interval, start_date: startDate, end_date: tradeDate, theme_id: themeId }, signal), signal, scope);
    return result.response;
  }, true, version);
  useEffect(() => {
    if (resource.errorStatus === 409 && conflictKey.current !== requestKey) {
      conflictKey.current = requestKey;
      onConflict?.();
    }
  }, [resource.errorStatus, onConflict, requestKey]);
  const { data, ticks, label, lunchBoundary } = useMemo(() => buildHistorySeries(resource.data?.data.items ?? [], interval === '5m' ? '1m' : interval, tradeDate, themeId), [resource.data?.data.items, interval, tradeDate, themeId]);
  return <section className="sent-trend" aria-label="情绪统计历史"><div className="sent-section-head"><h2>{themeId ? '题材观察走势' : '情绪观察'}</h2><div className="sent-segment"><button type="button" aria-pressed={interval === '1m'} onClick={() => setInterval('1m')}>当日分钟</button><button type="button" aria-pressed={interval === '5m'} onClick={() => setInterval('5m')}>五分钟环境</button><button type="button" aria-pressed={interval === '1d'} onClick={() => setInterval('1d')}>近 20 日</button></div></div>
    <div className="sent-chart-readout"><span>{interval !== '1d' ? tradeDate : `${startDate} — ${tradeDate}`}</span><span><i className="sent-legend-dot is-sealed" />涨停<i className="sent-legend-dot is-opened" />当前打开</span></div>
    {resource.data && resource.error && <DataNotice loading={false} error={resource.error} retry={resource.reload} />}
    {!resource.data && (resource.loading || resource.error) ? <DataNotice loading={resource.loading} error={resource.error} retry={resource.reload} /> : !resource.data?.data.items.length ? <div className="sent-data-notice" role="status">{interval === '5m' ? '该日期暂无五分钟环境记录，旧历史可能尚未提供。' : '暂无观测记录'}</div> : interval === '5m' ? <EnvironmentWindows items={resource.data.data.items} themeId={themeId} meta={resource.data.meta} /> : <div className="sent-live-history"><ResponsiveContainer width="100%" height="100%" minWidth={0}><ComposedChart data={data} margin={{ left: -24, right: 12, top: 12, bottom: 0 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--terminal-border)" /><XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} ticks={ticks} tickFormatter={label} tick={{ fontSize: 9, fill: 'var(--terminal-muted)' }} axisLine={false} tickLine={false} minTickGap={30} /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'var(--terminal-muted)' }} axisLine={false} tickLine={false} />
      {lunchBoundary !== undefined && <ReferenceLine x={lunchBoundary} stroke="var(--terminal-border)" strokeDasharray="3 4" />}
      <Tooltip labelFormatter={(value, payload) => {
        const timestamp = payload?.[0]?.payload?.timestamp;
        return typeof timestamp === 'number' ? historyTimeLabel(timestamp, interval) : label(Number(value));
      }} contentStyle={{ background: 'var(--terminal-panel)', border: '1px solid var(--terminal-border)', fontSize: 11 }} />
      {interval === '1m' ? <><Line dataKey="up" name="涨停" type="linear" stroke="var(--terminal-rise)" strokeWidth={1.7} dot={data.length < 3} connectNulls={false} isAnimationActive={false} /><Line dataKey="broken" name="当前打开" stroke="var(--terminal-warning)" dot={data.length < 3} connectNulls={false} isAnimationActive={false} /></> : <><Bar dataKey="up" name="涨停" fill="var(--terminal-rise)" maxBarSize={12} isAnimationActive={false} /><Bar dataKey="broken" name="当前打开" fill="var(--terminal-warning)" maxBarSize={12} isAnimationActive={false} /></>}
    </ComposedChart></ResponsiveContainer></div>}
    <div className="sent-chart-caption"><span>{interval === '5m' ? '实际处理窗口 · 历史记录缺失时不回填' : interval === '1m' ? '每分钟首次观测 · 午休压缩衔接 · 盘中缺失留空' : '仅收盘定稿数据 · 20 个自然日'}</span><span>单位：家</span></div>
  </section>;
}

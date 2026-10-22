import { EnvironmentSummary, RecentActivity } from './SentimentEnvironment';
import type { CSSProperties } from 'react';
import { ChevronRight, MoveRight, Waves } from 'lucide-react';
import type { LiveSnapshot } from './sentiment-live-model';
import { displayNumber, pct, emotionTitle, emotionStatus, emotionChange, missingReason } from './sentiment-live-model';
import { SentimentHistory } from './SentimentHistory';

export function SentimentOverview({ snapshot, height, onHeight, onEvidence, onConflict }: { snapshot: LiveSnapshot; onConflict?: () => void; height: number | null; onHeight: (height: number | null) => void; onEvidence: () => void }) {
  const { market } = snapshot.dashboard, { values, emotion } = market;
  const bars = Object.entries(values.board_counts ?? {}).sort((a, b) => (b[0] === '10_plus' ? 10 : Number(b[0])) - (a[0] === '10_plus' ? 10 : Number(a[0])));
  const metrics = [
    { key: 'limit_up', label: '当前涨停', value: displayNumber(values.limit_up), unit: '家', hint: '当前处于涨停价 · 按代码去重', tone: 'rise' },
    { key: 'chain_count', label: '连板家数', value: displayNumber(values.chain_count), unit: '家', hint: '连续 2 板及以上', tone: 'rise' },
    { key: 'seal_rate', label: '当前涨停价占触板比例', value: pct(values.seal_rate), unit: '', hint: '价格状态统计，不代表有可核验封单', tone: 'plain' },
    { key: 'broken', label: '触板后当前打开', value: displayNumber(values.broken), unit: '家', hint: `当前打开 ${pct(values.currently_open_ratio)} · 曾开板 ${pct(values.ever_open_ratio)}`, tone: 'warning' },
    { key: 'limit_down', label: '当前跌停', value: displayNumber(values.limit_down), unit: '家', hint: `样本覆盖 ${pct(values.coverage)}`, tone: 'fall' },
  ];
  return <><div className="sent-overview"><section className="sent-market-state">
    <div className="sent-state-top"><span><Waves size={16} />大盘情绪周期</span><span className="sent-confirmed">{emotionStatus[emotion.status]}</span></div>
    <div className="sent-state-title"><span>{emotion.status === 'confirmed' ? '当前确认状态' : '当前观察状态'}</span><h2>{emotionTitle(emotion)}</h2></div>
    <p>{emotion.status !== 'confirmed' ? `上次确认：${emotion.state ?? '暂无'}${emotion.missing_reason ? ` · ${missingReason(emotion.missing_reason)}` : ''}` : `盘中反馈${emotionChange[emotion.intraday_change]}${emotion.extreme_tag ? ` · ${emotion.extreme_tag}` : ''}`}</p>
    <EnvironmentSummary emotion={emotion} /><RecentActivity activity={market.recent_activity} /><div className="sent-state-route"><span>{emotion.previous_state ?? '暂无前态'}</span><MoveRight size={18} /><strong>{emotion.state ?? '未确认'}</strong></div>
    <div className="sent-state-bottom"><span>后端描述性判断</span><button type="button" onClick={onEvidence}>判断依据<ChevronRight size={14} /></button></div>
  </section><SentimentHistory scope={snapshot.meta.scope} tradeDate={snapshot.meta.trade_date} meta={snapshot.meta} onConflict={onConflict} />
  <section className="sent-height-map" aria-label="全市场连板高度筛选"><div className="sent-section-head"><h2>空间高度</h2><span className="sent-muted">{snapshot.meta.is_final ? '已定稿' : '暂定'}</span></div><div className="sent-highest"><strong>{displayNumber(values.height)}</strong><span>板<small>最高连续板</small></span></div>
    <div className="sent-height-bars">{bars.map(([key, count]) => { const value = key === '10_plus' ? 10 : Number(key); return <button type="button" key={key} aria-pressed={height === value} aria-label={`筛选 ${key === '10_plus' ? '10 板及以上' : `${key} 板`}，${displayNumber(count)} 家`} onClick={() => onHeight(height === value ? null : value)}><span>{key === '10_plus' ? '10+' : key} 板</span><i style={{ '--bar-width': `${count == null ? 0 : count / Math.max(1, ...bars.map(([, n]) => n ?? 0)) * 100}%` } as CSSProperties} /><b>{displayNumber(count)}</b></button>; })}{!bars.length && <p className="sent-panel-note">{market.missing_reasons.board_counts ?? '暂无完整梯队统计'}</p>}</div>
  </section></div>
  <div className="sent-metrics" aria-label="市场统计">{metrics.map(metric => <div className="sent-metric" key={metric.key} title={market.missing_reasons[metric.key]}><span>{metric.label}</span><div className={`sent-number is-${metric.tone}`}><strong>{metric.value}</strong><small>{metric.unit}</small></div><small>{market.missing_reasons[metric.key] ?? metric.hint}</small></div>)}</div></>;
}

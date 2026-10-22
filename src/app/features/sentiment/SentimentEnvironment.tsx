import { useState } from 'react';
import { EVENT_NAMES, type Emotion, type SentimentMeta, type SentimentStats, type TimeseriesPoint } from './sentiment-contract';
import { clockTime } from './sentiment-model';
import { emotionColor, emotionStatus, emotionTitle, pct } from './sentiment-live-model';

export const triState = (value: unknown) => value === true ? '成立' : value === false ? '不成立' : '未知';
export const evidenceValue = (value: unknown): string => value == null ? '未知' : typeof value === 'boolean' ? triState(value) : typeof value === 'object' ? JSON.stringify(value) : String(value);

export function RecentActivity({ activity }: { activity: SentimentStats['recent_activity'] }) {
  if (!activity) return null;
  const counts = Object.entries(EVENT_NAMES).filter(([key]) => typeof activity[key as keyof typeof EVENT_NAMES] === 'number');
  return <details className="sent-environment-evidence"><summary>近 {activity.window_seconds} 秒行为 · 观察次数</summary><div className="sent-environment-summary">{counts.map(([key, label]) => <span key={key}>{label} <b>{activity[key as keyof typeof EVENT_NAMES]}</b></span>)}</div><small>最近窗口内的后端观察次数，非全天总数。</small></details>;
}

export function EnvironmentSummary({ emotion }: { emotion: Emotion }) {
  return <div className="sent-environment-summary">
    <span>{emotionStatus[emotion.status]}</span>
    {emotion.candidate_state && <span>候选 <b>{emotion.candidate_state}</b> · 尚未切换</span>}
    <span>保持证据：<b>{triState(emotion.support)}</b>{emotion.support_status ? ` · ${emotion.support_status}` : ''}</span>
    <span>判断 {clockTime(emotion.evaluated_at)} · {Math.round((emotion.evaluation_interval_seconds ?? 300) / 60)} 分钟周期{emotion.is_carried_to_close && ' · 沿用最后盘中判断'}</span>
  </div>;
}

function EvidenceFields({ title, value }: { title: string; value: unknown }) {
  if (value == null) return null;
  const entries: [string, unknown][] = typeof value === 'object' ? Object.entries(value) : [['说明', value]];
  if (!entries.length) return null;
  return <details className="sent-environment-evidence"><summary>{title}</summary><dl>{entries.map(([key, item]) => <div key={key}><dt>{key}</dt><dd>{evidenceValue(item)}</dd></div>)}</dl></details>;
}

export function EnvironmentEvidence({ emotion }: { emotion: Emotion }) {
  return <div className="sent-environment-details"><EnvironmentSummary emotion={emotion} />
    {emotion.support_unknown_reasons?.length ? <p>支持未知：{emotion.support_unknown_reasons.join('；')}</p> : null}
    <p className="sent-panel-note">阶段起点 {emotion.state_since ? new Date(emotion.state_since).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '未知'} · 最后支持 {clockTime(emotion.last_supported_at ?? null)}</p>
    <EvidenceFields title="进入条件 · 三态判断" value={emotion.entry} /><EvidenceFields title="保持条件 · 三态判断" value={emotion.hold} />
    <EvidenceFields title="候选累计窗口与阻挡原因" value={emotion.candidates} />
    <EvidenceFields title="判断事实 · 后端原始口径（B / U / D3 / D5 / Q10 为 0—100，M 为 r10）" value={emotion.facts} />
    <EvidenceFields title="窗口数据质量" value={emotion.data_quality} /><EvidenceFields title="统计主线与候选" value={emotion.structure} />
    {emotion.cycle_id != null && <p>题材周期 {emotion.cycle_id}</p>}
    <EvidenceFields title="启动股票组" value={emotion.startup_cohort} /><EvidenceFields title="高板股票组" value={emotion.high_cohort} /><EvidenceFields title="退出证据" value={emotion.exit_evidence} />
    <small>规则 {emotion.rule_version}</small>
  </div>;
}

export function EnvironmentWindows({ items, themeId, meta }: { items: TimeseriesPoint[]; themeId?: string; meta?: SentimentMeta }) {
  const [selected, setSelected] = useState<string | null>(null);
  const points = [...items].filter(p => Number.isFinite(Date.parse(p.timestamp))).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const point = points.find(p => p.timestamp === selected) ?? points[0];
  const stats = point ? themeId ? point.theme : point.market : null;
  return <div className="sent-environment-windows">
    <p className="sent-panel-note">实际五分钟环境窗口 · 从近到远 · 点击查看当时条件与证据</p>
    <div className="sent-window-list" role="group" aria-label="五分钟环境窗口">{points.map(p => {
      const emotion = (themeId ? p.theme : p.market)?.emotion;
      return <button key={p.timestamp} type="button" aria-pressed={point?.timestamp === p.timestamp} onClick={() => setSelected(p.timestamp)}><time>{clockTime(p.timestamp)}</time><b className={`sent-emotion-tag is-${emotion ? emotionColor(emotion) : 'neutral'}`}>{emotion ? emotionTitle(emotion) : '记录缺失'}</b></button>;
    })}</div>
    {point && <div className="sent-window-detail"><p>窗口 {clockTime(point.timestamp)} · 实际观察 {clockTime(point.as_of)} · 行情截至 {clockTime(meta?.as_of ?? null)}</p>
      <div className="sent-window-facts"><span>涨停 {stats?.values.limit_up ?? '—'} 家</span><span>当前打开 {stats?.values.broken ?? '—'} 家</span><span>覆盖 {pct(stats?.values.coverage)}</span></div>
      {stats?.emotion ? <EnvironmentEvidence emotion={stats.emotion} /> : <p>该题材在此窗口没有环境记录。</p>}
    </div>}
  </div>;
}

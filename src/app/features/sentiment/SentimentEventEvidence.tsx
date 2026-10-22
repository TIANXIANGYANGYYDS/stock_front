import { evidenceValue } from './SentimentEnvironment';
import { pct } from './sentiment-live-model';
import { money } from './sentiment-model';

const LABELS: Record<string, string> = { window_seconds: '窗口秒数', observed_window_seconds: '实际采样秒数', baseline_seconds: '基准秒数', amount_yuan: '实际成交额', baseline_per_minute_yuan: '此前每分钟均额', multiple: '放量倍数', threshold_multiple: '倍数门槛', minimum_amount_yuan: '最低成交额', change_ratio: '价格变化', rise_ratio: '上涨幅度', fall_ratio: '下跌幅度', rebound_ratio: '反弹幅度', drawdown_ratio: '回撤幅度', threshold_ratio: '幅度门槛' };
export function EventEvidence({ evidence, rule_version, cooldown_seconds }: { evidence?: Record<string, unknown>; rule_version?: string | null; cooldown_seconds?: number | null }) {
  if (!evidence || !Object.keys(evidence).length) return null;
  return <details className="sent-event-evidence"><summary>行为依据{cooldown_seconds != null ? ` · 同股同类型冷却 ${cooldown_seconds} 秒` : ''}</summary><dl>{Object.entries(evidence).map(([key, value]) => <div key={key}><dt>{LABELS[key] ?? key}</dt><dd>{typeof value === 'number' && key.endsWith('_ratio') ? pct(value, 2) : typeof value === 'number' && key.endsWith('_yuan') ? money(value) : evidenceValue(value)}</dd></div>)}</dl>{rule_version && <small>规则 {rule_version}</small>}</details>;
}

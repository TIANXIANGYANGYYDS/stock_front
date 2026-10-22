import { EventEvidence } from './SentimentEventEvidence';
import { useEffect, useState } from 'react';
import { Activity, ChevronRight } from 'lucide-react';
import { COHORTS, EVENT_NAMES, type SentimentScope, type SentimentEvent, type SentimentStats } from './sentiment-contract';
import { atConsistentSnapshot, sentimentApi, snapshotQuery } from './sentiment-api';
import { displayNumber, mergeEvents, pct, missingReason } from './sentiment-live-model';
import { useSentimentResource } from './useSentiment';
import { DataNotice } from './SentimentHistory';
import { clockTime } from './sentiment-model';

export function SentimentFeedback({ stats }: { stats: SentimentStats }) {
  return <section className="sent-feedback"><div className="sent-section-head"><div><h2>昨日强势股，今天怎么样？</h2><p>后端固定昨日群体，缺失观测保留为空。</p></div></div><div className="sent-feedback-scroll"><table><thead><tr><th>昨日群体</th><th>开盘中位数</th><th>当前中位数</th><th>当前晋级率</th><th>观测 / 样本</th></tr></thead><tbody>{Object.entries(COHORTS).map(([key, name]) => {
    const cohort = stats.feedback[key as keyof typeof COHORTS];
    return <tr key={key} title={cohort?.missing_reason ?? undefined}><th>{name}<small>{missingReason(cohort?.missing_reason) ?? `覆盖 ${pct(cohort?.coverage)}`}</small></th><td>{pct(cohort?.open_return_median, 2, true)}</td><td className={(cohort?.return_median ?? 0) < 0 ? 'is-fall' : 'is-rise'}>{pct(cohort?.return_median, 2, true)}</td><td>{pct(cohort?.promotion)}</td><td>{displayNumber(cohort?.observed_count)} / {displayNumber(cohort?.sample_count)}</td></tr>;
  })}</tbody></table></div><p className="sent-panel-note">昨高板为昨日 4 板及以上，与昨连板群体重叠。晋级率直接采用后端结果，缺行情不算晋级失败。</p></section>;
}
export function SentimentEvents({ scope = 'all_a', tradeDate, seeds = [], code, themeId, stockNames = {}, themeNames = {}, onStock, onTheme, onMarket }: {
  scope?: SentimentScope; tradeDate: string; seeds?: SentimentEvent[]; code?: string; themeId?: string; stockNames?: Record<string, string>; themeNames?: Record<string, string>;
  onStock: (code: string) => void; onTheme: (id: string) => void; onMarket: () => void;
}) {
  const [type, setType] = useState('');
  return <section className="sent-events"><div className="sent-section-head"><div><h2><Activity size={16} />观察事件</h2><p>来源时间与观察时间分别保留，不代表逐笔完整记录。</p></div></div>
    <label className="sent-select sent-event-select">事件类型<select aria-label="事件类型" value={type} onChange={event => setType(event.target.value)}><option value="">全部事件</option>{Object.entries(EVENT_NAMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <EventPages scope={scope} key={`${scope}:${tradeDate}:${code ?? ''}:${themeId ?? ''}:${type}`} tradeDate={tradeDate} code={code} themeId={themeId} type={type} seeds={seeds} stockNames={stockNames} themeNames={themeNames} onStock={onStock} onTheme={onTheme} onMarket={onMarket} />
  </section>;
}
function EventPages({ scope, tradeDate, code, themeId, type, seeds, stockNames, themeNames, onStock, onTheme, onMarket }: {
  scope: SentimentScope; tradeDate: string; code?: string; themeId?: string; type: string; seeds: SentimentEvent[]; stockNames: Record<string, string>; themeNames: Record<string, string>;
  onStock: (code: string) => void; onTheme: (id: string) => void; onMarket: () => void;
}) {
  const [cursor, setCursor] = useState<string>();
  const [items, setItems] = useState<SentimentEvent[]>([]);
  const [visible, setVisible] = useState(12);
  const resource = useSentimentResource(`${scope}:${tradeDate}:${code}:${themeId}:${type}:${cursor ?? ''}`, async signal => {
    let reset = false;
    const result = await atConsistentSnapshot(tradeDate, (meta, attempt) => {
      reset = attempt > 0;
      return sentimentApi.events({ ...snapshotQuery(meta), after: reset ? undefined : cursor, limit: 100, code, theme_id: themeId, event_type: type || undefined }, signal);
    }, signal, scope);
    return { ...result.response, reset };
  });
  useEffect(() => { if (resource.data) setItems(previous => mergeEvents(resource.data!.reset ? [] : previous, resource.data!.data.items)); }, [resource.data]);
  const events = mergeEvents(items, seeds).filter(event => (!code || event.code === code) && (!themeId || event.theme_ids?.includes(themeId)) && (!type || event.type === type)).reverse();
  return <><div className="sent-event-list">{events.slice(0, visible).map(event => <div key={event.event_id}><button type="button" className={`sent-event ${event.type === 'open' ? 'is-open' : ''}`} key={event.event_id} title={`事件 ID：${event.event_id}；来源：${event.source_time ?? '未知'}；观察：${event.observed_at}`}
    onClick={() => event.code ? onStock(event.code) : event.theme_ids?.[0] ? onTheme(event.theme_ids[0]) : onMarket()}><time>{clockTime(event.source_time ?? event.observed_at)}</time><span className="sent-event-line"><i /><span><b>{EVENT_NAMES[event.type] ?? event.label ?? event.type}</b><span>{event.code ? `${event.name ?? stockNames[event.code] ?? event.code} · ${event.code}` : event.theme_ids?.length ? event.theme_ids.map(id => themeNames[id] ?? id).join('、') : '市场情绪观察'}</span>{event.type === 'emotion_changed' && typeof event.state === 'string' && <span>{typeof event.previous_state === 'string' ? `${event.previous_state} → ` : ''}{event.state}</span>}<small>观察 {clockTime(event.observed_at)}</small></span></span><ChevronRight size={13} /></button><EventEvidence {...event} /></div>)}</div>
    {(resource.loading || resource.error || !events.length) && <DataNotice loading={resource.loading} error={resource.error} retry={() => { if (cursor) { setItems([]); setCursor(undefined); } else resource.reload(); }} />}
    <div className="sent-pagination"><span>已载入 {events.length} 条 · 倒序展示</span>{events.length > visible && <button type="button" onClick={() => setVisible(value => value + 20)}>展开已载入</button>}{resource.data?.data.has_more && <button type="button" disabled={resource.loading || !resource.data.data.next_cursor || resource.data.data.next_cursor === cursor} onClick={() => setCursor(resource.data!.data.next_cursor!)}>继续读取历史</button>}</div>
  </>;
}

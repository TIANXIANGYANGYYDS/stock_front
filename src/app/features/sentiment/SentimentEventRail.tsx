import { PRICE_EVENT_KINDS } from './sentiment-contract';
import { EventEvidence } from './SentimentEventEvidence';
import { useMemo, type CSSProperties } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import { secondsClock } from './sentiment-seconds';
import { pct } from './sentiment-live-model';
import { groupBehaviorMarkers, type BehaviorFilter, type ChartBehavior } from './sentiment-event-view';

export function BehaviorBroadcast({ items, active, index, following, newerCount, filter, loading, failed, onFilter, onSelect, onFollow, onStock }: {
  items: ChartBehavior[]; active: ChartBehavior | null; index: number; following: boolean; newerCount: number;
  filter: BehaviorFilter; loading: boolean; failed: boolean; onFilter: (filter: BehaviorFilter) => void;
  onSelect: (id: string) => void; onFollow: () => void; onStock: (code: string) => void;
}) {
  return <section className={`sent-behavior-broadcast${following ? ' is-following' : ''}`} aria-label="行为播报" style={active ? { '--behavior-color': active.color } as CSSProperties : undefined}>
    <header><span><Radio size={14} />行为播报 <small>{following ? '跟随最新' : '已固定查看'}</small></span><div><select aria-label="行为类型" value={filter} onChange={e => onFilter(e.target.value as BehaviorFilter)}><option value="all">全部行为</option>{Object.values(PRICE_EVENT_KINDS).map(kind => <option key={kind}>{kind}</option>)}</select>{!following && <button type="button" className="sent-follow-events" onClick={onFollow}>{newerCount ? `后续 ${newerCount} 条 · ` : ''}返回最新</button>}</div></header>
    <div className="sent-broadcast-body">{active ? <>
      <div className="sent-broadcast-message"><time>{secondsClock(active.event.time)}</time><strong><i />{active.name}</strong><b className={`sent-behavior-word is-${active.event.kind}`}>{active.event.kind}</b><span className="sent-broadcast-price">{pct(active.event.change_ratio, 2, true)}</span><button type="button" className="sent-broadcast-detail" aria-label={`查看${active.name}行为详情`} onClick={() => onStock(active.event.code)}><ArrowUpRight size={16} /></button></div>
      <EventEvidence {...active.event} /><div className="sent-broadcast-caption"><span>竖线与圆点定位此条行为</span><span title={`行情来源 ${active.event.sourceTime ? secondsClock(active.event.sourceTime) : '未知'} · 系统观察 ${secondsClock(active.event.observedTime ?? active.event.time)}`}>观察 {secondsClock(active.event.observedTime ?? active.event.time)}</span></div>
    </> : <p className="sent-broadcast-empty">{failed ? '行为暂不可用，可在下方重新读取' : loading ? '正在读取已归档行为…' : '此范围暂无已归档行为'}</p>}
    <nav aria-label="浏览股票行为"><button type="button" aria-label="上一条行为" disabled={index <= 0} onClick={() => onSelect(items[index - 1].event.id)}><ChevronLeft size={16} /></button><span>{active ? index + 1 : 0} / {items.length}</span><button type="button" aria-label="下一条行为" disabled={index < 0 || index >= items.length - 1} onClick={() => onSelect(items[index + 1].event.id)}><ChevronRight size={16} /></button></nav></div>
  </section>;
}

export function SentimentEventRail({ items, activeId, width, insetLeft, position, onSelect }: {
  items: ChartBehavior[]; activeId?: string; width: number; insetLeft: number; position: (time: number) => number; onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => groupBehaviorMarkers(items, position, Math.max(1, width - insetLeft - 60)), [items, position, width, insetLeft]);
  const selected = groups.find(group => group.items.some(item => item.event.id === activeId));
  const active = selected?.items.find(item => item.event.id === activeId);
  return <section className="sent-event-rail" aria-label="与走势图时间对应的行为轴">
    <div className="sent-event-rail-heading"><strong>行为时间轴 <small>{items.length} 条</small></strong><span>● 行为 <b>◇ 开板</b> ↻ 回封</span></div>
    <div className="sent-event-rail-track" style={{ marginLeft: insetLeft, marginRight: 60 }}>
      {active && <i className="sent-rail-exact-time" aria-hidden="true" style={{ left: `${position(active.event.time) * 100}%`, borderColor: active.color }} />}
      {groups.map(group => {
        const item = group.items.find(item => item.event.id === activeId) ?? group.items.at(-1)!;
        const selected = item.event.id === activeId;
        return <button type="button" key={group.items[0].event.id} className={`sent-rail-marker${selected ? ' is-selected' : ''}`} style={{ left: `${group.position * 100}%`, '--series-color': item.color } as CSSProperties}
          aria-label={`${secondsClock(group.items[0].event.time)} ${group.items.length > 1 ? `${group.items.length} 条行为` : `${item.name}${item.event.kind}`}，定位到图表`} aria-pressed={selected}
          title={group.items.length > 1 ? `${group.items.length} 条相邻行为，点击逐条查看` : `${item.name} ${secondsClock(item.event.time)} ${item.event.kind}`} onClick={() => onSelect(item.event.id)}>
          {group.items.length > 1 ? group.items.length : item.event.kind === '开板' ? '◇' : item.event.kind === '回封' ? '↻' : '●'}
        </button>;
      })}
    </div>
    <div className="sent-event-rail-caption">{selected && selected.items.length > 1 ? <label>此处 {selected.items.length} 条<select aria-label="同一位置的行为" value={activeId} onChange={e => onSelect(e.target.value)}>{selected.items.map(({ event, name }) => <option key={event.id} value={event.id}>{secondsClock(event.time)} · {name} · {event.kind}</option>)}</select></label> : <span>点选标记定位 · 相邻事件合并数量显示</span>}<span>与上图共用时间刻度</span></div>
  </section>;
}

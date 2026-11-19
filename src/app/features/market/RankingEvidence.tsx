import type { RankingEvidence as Evidence } from '../../lib/api';

const sourceNames: Record<string, string> = { cls: '财联社', jin10: '金十数据', '10jqka': '同花顺' };

export function RankingEvidence({ sector, items }: { sector: string; items: Evidence[] }) {
  return <section className="ranking-evidence" aria-label={sector + '新闻依据'}>
    <h4>{sector} · 新闻依据</h4>
    {items.length ? <ul>{items.map(item => <li key={item.event_id}>
      <strong>{item.title}</strong>
      <small>{sourceNames[item.source] ?? item.source} · {item.publish_time}</small>
      {item.reason && <p>{item.reason}</p>}
    </li>)}</ul> : <p>该快照未附新闻依据</p>}
  </section>;
}

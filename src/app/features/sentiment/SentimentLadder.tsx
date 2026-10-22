import { EnvironmentSummary, RecentActivity } from './SentimentEnvironment';
import { useMemo, type CSSProperties } from 'react';
import { ArrowRight, ChevronRight, Star } from 'lucide-react';
import { useThemeMembers } from './useThemeMembers';
import { selectThemeMembers } from './sentiment-members';
import { DataNotice } from './SentimentHistory';
import { ThemeSecondsChart } from './ThemeSecondsChart';
import { boardName } from './sentiment-contract';
import type { SentimentStock, ThemeStats, SentimentMeta } from './sentiment-contract';
import { stockHeight, stockStatus, pct, emotionColor, emotionTitle, emotionChange, displayNumber, type LiveFilters } from './sentiment-live-model';
import { clockTime } from './sentiment-model';
import { awaitingClose, isFinal, isRetained, memberQuality, publicationKey } from './sentiment-publication';

export function StockRow({ stock, onSelect }: { stock: SentimentStock; onSelect: (code: string) => void }) {
  const height = stockHeight(stock), opened = stock.limit_status === 'opened';
  return <button type="button" className={`sent-stock-row${opened ? ' is-opened' : ''}`} data-stock-code={stock.code} onClick={() => onSelect(stock.code)} aria-label={`${stock.name ?? stock.code} ${stock.code}，${stockStatus(stock)}，查看详情`}>
    <span className={`sent-board-chip ${height !== null && height >= 5 ? 'is-high' : ''}`} style={{ '--height-fill': `${Math.max(10, (height ?? 0) / 7 * 100)}%` } as CSSProperties}><b>{height ?? '—'}</b><small>{height === null ? '未知' : opened ? '冲板' : height === 1 ? '首板' : '连板'}</small></span>
    <span className="sent-stock-name"><strong>{stock.name ?? stock.code}{opened && <i>开板</i>}</strong><small>{stock.code} · {boardName(stock.board_type)}{stock.board_run.label && <em>{stock.board_run.label}</em>}</small>{memberQuality(stock) && <small className="is-warning">{memberQuality(stock)}</small>}</span>
    <span className="sent-stock-time"><b>{clockTime(stock.first_seal_at ?? stock.first_touch_at)}</b><small>{stock.first_seal_at ? '首次观察封板' : '首次观察触板'}</small></span><span className={`sent-stock-change ${(stock.change_ratio ?? 0) < 0 ? 'is-fall' : 'is-rise'}`}>{pct(stock.change_ratio, 2, true)}</span>
  </button>;
}
export function ThemeCard({ theme: latestTheme, filters, index, favorite, onFavorite, onTheme, onStock, meta: latestMeta, historical, connected, onConflict }: {
  theme: ThemeStats; filters: LiveFilters; index: number; favorite: boolean;
  onFavorite: (id: string) => void; onTheme: (id: string) => void; onStock: (code: string) => void;
  meta: SentimentMeta; historical: boolean; connected: boolean;
  onConflict?: () => void;
}) {
  const filtered = !!filters.query.trim() || filters.status !== 'all' || !!filters.board || filters.height !== null;
  const members = useThemeMembers(latestTheme.theme_id, latestMeta, filtered ? 'all' : 'top', onConflict);
  // While refreshing, the card keeps its own coherent theme/member publication, visibly dated.
  const theme = members.theme ?? latestTheme, meta = members.meta ?? latestMeta, tone = emotionColor(theme.emotion);
  const updating = !!members.meta && publicationKey(members.meta) !== publicationKey(latestMeta);
  const pendingClose = awaitingClose(meta);
  const boardKey = meta.included_boards?.join(',');
  const stocks = useMemo(() => selectThemeMembers(members.items ?? [], filters, theme.name, meta), [members.items, filters, theme.name, meta.scope, boardKey]);
  return <article ref={members.containerRef} className={`sent-theme-card is-${tone}`} style={{ '--card-delay': `${Math.min(index, 8) * 30}ms` } as CSSProperties}>
    <div className="sent-theme-summary"><div className="sent-theme-identity">
    <header className="sent-theme-heading"><div><span className="sent-theme-rank">{String(index + 1).padStart(2, '0')}</span><button type="button" className="sent-theme-title" onClick={() => onTheme(theme.theme_id)}><h3>{theme.name}</h3><ChevronRight size={18} /></button><span className={`sent-emotion-tag is-${tone}`}>{emotionTitle(theme.emotion)}</span></div><button type="button" className="sent-icon-button" aria-pressed={favorite} aria-label={`${favorite ? '取消关注' : '关注'}${theme.name}`} onClick={() => onFavorite(theme.theme_id)}><Star size={18} fill={favorite ? 'currentColor' : 'none'} /></button></header>
    <p className="sent-theme-subtitle">{theme.scope_member_count} 只范围成员 · 覆盖 {pct(theme.values.coverage)} · {emotionChange[theme.emotion.intraday_change]}</p>
    </div><div className="sent-theme-numbers"><span>当前涨停 <b>{displayNumber(theme.values.limit_up)}<small> 家</small></b></span><span>连板高度 <b>{displayNumber(theme.values.height)}<small> 板</small></b></span><span>昨涨停反馈 <b className={(theme.feedback.yesterday_limit_up?.return_median ?? 0) < 0 ? 'is-fall' : 'is-rise'}>{pct(theme.feedback.yesterday_limit_up?.return_median, 2, true)}</b></span></div></div>
    <EnvironmentSummary emotion={theme.emotion} /><RecentActivity activity={theme.recent_activity} />{isRetained(meta) && <p className="sent-panel-note">统计与排行保留 {clockTime(meta.as_of)} 的服务端观察 · 非最终收盘结果</p>}
    {updating && <p className="sent-panel-note" role="status">正在同步新发布版本，当前题材截至 {clockTime(meta.as_of)}</p>}
    {theme.emotion.status !== 'confirmed' && theme.emotion.state && <p className="sent-panel-note">上次确认：{theme.emotion.state}</p>}
    {!members.items ? <div className="sent-members-placeholder"><DataNotice loading={members.loading} error={members.error} retry={members.retry} /><span>{members.error ? '成员尚未返回，暂不能确定前 7 只' : filtered ? '正在读取完整成员后筛选' : '正在读取服务端前 7 名'}</span></div> : <ThemeSecondsChart key={`${meta.scope}:${meta.trade_date}`} scope={meta.scope} themeName={theme.name} stocks={stocks} members={members.items} asOf={meta.as_of} archiveAsOf={isFinal(meta) ? `${meta.trade_date}T15:00:00.999+08:00` : meta.processed_as_of ?? meta.as_of} publication={publicationKey(meta)} snapshotId={meta.snapshot_id} playing={connected && !historical && !isFinal(meta) && !isRetained(meta)} onStock={onStock} sampleInterval={meta.sample_interval_seconds ?? 5} />}
    {members.items && members.error && <div className="sent-day-history-status"><span>成员排名更新失败，当前为 {clockTime(members.meta?.as_of ?? null)} 的排名</span><button type="button" onClick={members.retry}>重新读取</button></div>}
    <footer><span>{members.items ? `前 ${Math.min(7, stocks.length)} / ${filtered ? stocks.length : members.total} 只${filtered ? '符合条件成员' : '题材成员'}` : '成员读取中'} · {historical || pendingClose || isFinal(meta) ? `${meta.trade_date} 全天` : '开盘至当前'}</span><button type="button" onClick={() => onTheme(theme.theme_id)}>题材全览<ArrowRight size={13} /></button></footer>
  </article>;
}
export function MarketLadder({ stocks, onStock }: { stocks: SentimentStock[]; onStock: (code: string) => void }) {
  const heights = [...new Set(stocks.map(stockHeight))].sort((a, b) => (b ?? -1) - (a ?? -1));
  return <section className="sent-market-ladder" aria-label="全市场涨停梯队">{heights.map(height => { const members = stocks.filter(stock => stockHeight(stock) === height); return <div className="sent-ladder-level" key={height ?? 'unknown'}><div className="sent-level-label"><strong>{height ?? '—'}<small>板</small></strong><span>{members.length} 家</span><i>当前筛选</i></div><div className="sent-level-stocks">{members.map(stock => <div className="sent-level-stock" key={stock.code}><StockRow stock={stock} onSelect={onStock} /><span>{stockStatus(stock)}</span></div>)}</div></div>; })}</section>;
}

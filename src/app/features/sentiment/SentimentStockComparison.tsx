import { popularityText } from './sentiment-popularity';
import { memo, useMemo, type CSSProperties } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, RotateCcw } from 'lucide-react';
import type { SentimentStock } from './sentiment-contract';
import type { SentimentSecondSeries } from './sentiment-seconds';
import { secondsClock } from './sentiment-seconds';
import { SESSION_HALF, sessionAxisTime } from './sentiment-day-series';
import { pct, stockStatus } from './sentiment-live-model';
import { memberQuality } from './sentiment-publication';
import { movementText, recentMovement, sparklinePath } from './sentiment-movement';

export type ComparisonStock = { stock: SentimentStock & { name: string }; series: SentimentSecondSeries; color: string };

const StockComparisonRow = memo(function StockComparisonRow({ item, rank, selected, tradeDate, through, domain, onFocus, onStock }: {
  item: ComparisonStock; rank: number; selected: boolean; tradeDate: string; through: number; domain: [number, number];
  onFocus: (code: string) => void; onStock: (code: string) => void;
}) {
  const { stock, series } = item;
  const visual = useMemo(() => {
    const points = series.points.filter(point => point.time <= through);
    return { path: sparklinePath(points, time => sessionAxisTime(tradeDate, time) / (SESSION_HALF * 2), domain), change: recentMovement(points, through) };
  }, [series.points, through, tradeDate, domain]);
  const change = visual.change, MovementIcon = change !== null && change >= .005 ? ArrowUpRight : change !== null && change <= -.005 ? ArrowDownRight : ArrowRight;
  const status = stockStatus(stock), quality = memberQuality(stock);
  const statusLabel = stock.limit_status === 'at_limit' ? '涨停价' : stock.limit_status === 'not_touched' ? '未触板' : status;
  return <div className={`sent-stock-compare-row${selected ? ' is-selected' : ''}`} data-stock-code={stock.code} style={{ '--series-color': item.color } as CSSProperties}>
    <button type="button" className="sent-stock-compare-select" aria-label={`突出${stock.name}曲线`} aria-pressed={selected} onClick={() => onFocus(stock.code)}>
      <span className="sent-stock-compare-heading"><span className="sent-compare-name"><i>{String(rank).padStart(2, '0')}</i><strong>{stock.name}</strong></span><b className={`sent-compare-return ${(stock.change_ratio ?? 0) > 0 ? 'is-rise' : (stock.change_ratio ?? 0) < 0 ? 'is-fall' : ''}`}>{pct(stock.change_ratio, 2, true)}</b></span>
      <span className="sent-stock-compare-facts" title={`现价 ${stock.price?.toFixed(2) ?? '—'} · 行情来源 ${stock.source_time ? secondsClock(Date.parse(stock.source_time)) : '未知'}`}><span className="sent-compare-code">{stock.code}</span>{stock.intraday_streak != null && stock.intraday_streak > 0 && <span className="sent-compare-streak">{stock.intraday_streak === 1 ? '首板' : `${stock.intraday_streak} 连板`}</span>}{stock.board_run.label && stock.board_run.limit_up_days !== stock.intraday_streak && <span>{stock.board_run.label}</span>}<span className="sent-popularity" title="与行情快照同时冻结的同花顺前 100 榜单">{popularityText(stock.popularity)}</span><span className={`sent-compare-status is-${stock.limit_status}`} title={status}>{statusLabel}</span></span>
      <span className="sent-stock-compare-movement"><svg className="sent-stock-spark" viewBox="0 0 112 32" aria-hidden="true"><path d={visual.path} fill="none" stroke={item.color} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></svg><span title="截至归档查询时间，连续 5 分钟涨幅之差；缺少采样时不计算。单位为百分点。">近 5 分钟 <b className={change !== null && change >= .005 ? 'is-rise' : change !== null && change <= -.005 ? 'is-fall' : ''}><MovementIcon size={14} />{movementText(change)}</b></span></span>
    </button>
    {quality && <div className="sent-stock-compare-quality is-warning" title={quality}>{quality}</div>}
    <button type="button" className="sent-compare-detail" title={`查看${stock.name}详情`} aria-label={`查看${stock.name}详情`} onClick={() => onStock(stock.code)}><ArrowUpRight size={16} /></button>
  </div>;
});

export function SentimentStockComparison({ items, focusCode, tradeDate, through, domain, onFocus, onStock, onReset }: {
  items: ComparisonStock[]; focusCode: string | null; tradeDate: string; through: number; domain: [number, number];
  onFocus: (code: string) => void; onStock: (code: string) => void; onReset: () => void;
}) {
  return <aside className="sent-stock-comparison" aria-label="个股走势对照">
    <div className="sent-stock-comparison-heading"><div><h4>个股对照 <span>{items.length}</span></h4><p>连板 → 多板 → 热度 → 涨幅</p></div>{focusCode && <button type="button" onClick={onReset} title="恢复全部曲线"><RotateCcw size={13} />全部</button>}</div>
    <div className="sent-stock-comparison-list">{items.map((item, index) => <StockComparisonRow key={item.stock.code} item={item} rank={index + 1} selected={focusCode === item.stock.code} tradeDate={tradeDate} through={through} domain={domain} onFocus={onFocus} onStock={onStock} />)}</div>
    <p className="sent-stock-comparison-note">点选股票聚焦主图 · 小图为全天、同一刻度<br />近 5 分钟缺少连续采样时显示 —</p>
  </aside>;
}

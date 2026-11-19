import { EnvironmentEvidence } from './SentimentEnvironment';
import { popularityText } from './sentiment-popularity';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, X } from 'lucide-react';
import { boardName, SCOPE_NAMES, type BoardType } from './sentiment-contract';
import type { Emotion, SentimentMeta, SentimentStats } from './sentiment-contract';
import { atConsistentSnapshot, sentimentApi, snapshotQuery } from './sentiment-api';
import { useSentimentResource } from './useSentiment';
import { compareLiveStocks, displayNumber, emotionChange, emotionStatus, emotionTitle, pct, stockHeight, stockStatus, missingReason, type LiveSnapshot } from './sentiment-live-model';
import { clockTime, money } from './sentiment-model';
import { isFinal, isRetained, publicationKey } from './sentiment-publication';
import { SentimentPublication } from './SentimentPublication';
import { StockRow } from './SentimentLadder';
import { DataNotice, SentimentHistory } from './SentimentHistory';
import { SentimentEvents, SentimentFeedback } from './SentimentPanels';

export type DetailSelection = { kind: 'stock'; id: string } | { kind: 'theme'; id: string } | { kind: 'market' } | { kind: 'rules' } | { kind: 'board'; id: BoardType };
const EVIDENCE_METRICS: Record<string, { label: string; ratio: boolean }> = {
  advancing_ratio: { label: '上涨占比', ratio: true }, seal_rate: { label: '当前涨停价占触板比例', ratio: true },
  limit_up: { label: '当前涨停家数', ratio: false }, limit_down: { label: '当前跌停家数', ratio: false },
  yesterday_up_return: { label: '昨涨停群体当前涨幅中位数', ratio: true }, promotion: { label: '昨涨停群体当前晋级率', ratio: true },
};
function EvidenceRecord({ record }: { record: Record<string, unknown> }) {
  const metric = typeof record.metric === 'string' ? EVIDENCE_METRICS[record.metric] : undefined;
  return <dl className="sent-evidence-record">{metric && <div><dt>{metric.label}</dt><dd>{typeof record.value === 'number' ? metric.ratio ? pct(record.value, 2) : displayNumber(record.value) : '—'}</dd></div>}{Object.entries(record).filter(([key]) => !metric || !['metric', 'value'].includes(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>;
}
function Evidence({ emotion }: { emotion: Emotion }) {
  return <div className="sent-evidence"><h3>{emotionTitle(emotion)}</h3><p>{emotionStatus[emotion.status]} · 盘中{emotionChange[emotion.intraday_change]} · 极端标签 {emotion.extreme_tag ?? '无'}</p>{emotion.status !== 'confirmed' && <p>上次确认：{emotion.state ?? '暂无'}；候选：{emotion.candidate_state ?? '暂无'}</p>}
    {([['支持依据', emotion.evidence], ['反向证据', emotion.counter_evidence]] as const).map(([title, records]) => <div key={title}><h3>{title}</h3>{(records ?? []).length ? records.map((record, index) => <EvidenceRecord key={index} record={record} />) : <p>未提供</p>}</div>)}
    <EnvironmentEvidence emotion={emotion} /><small>确认时间 {emotion.state_since?.slice(0, 19).replace('T', ' ') ?? '—'} · 规则 {emotion.rule_version}</small><p>{missingReason(emotion.missing_reason)}</p><p>描述性观察，未经交易有效性验证。</p></div>;
}
function Quality({ reasons }: { reasons: Record<string, string> }) {
  return Object.keys(reasons).length ? <div className="sent-quality"><h3>缺失说明</h3>{Object.entries(reasons).map(([field, reason]) => <p key={field}>{field}：{missingReason(reason)}</p>)}</div> : null;
}
function DetailMeta({ meta }: { meta: SentimentMeta }) {
  return <><SentimentPublication meta={meta} /><p className="sent-panel-note">{SCOPE_NAMES[meta.scope]} · {meta.trade_date} · 截止 {clockTime(meta.as_of)} · {isFinal(meta) ? '已定稿' : '未定稿'} · {meta.is_stale ? isRetained(meta) ? '保留观察已过期，仍可回看' : '数据过期' : `数据年龄 ${meta.age_seconds.toFixed(0)} 秒`}<br />快照 {meta.snapshot_id}</p></>;
}
export function SentimentDetails({ selection, snapshot, onSelect, onClose, restoreFocus }: {
  selection: DetailSelection | null; snapshot: LiveSnapshot; onSelect: (selection: DetailSelection) => void; onClose: () => void; restoreFocus: () => void;
}) {
  const title = selection?.kind === 'stock' ? snapshot.stocks[selection.id]?.name ?? selection.id : selection?.kind === 'theme' ? snapshot.dashboard.themes.find(item => item.theme_id === selection.id)?.name ?? '题材详情' : selection?.kind === 'board' ? boardName(selection.id) + ' · 判断依据' : selection?.kind === 'market' ? '市场情绪 · 判断依据' : '统计与采样口径';
  const eventsProps = { basis: { meta: snapshot.meta, data: snapshot.dashboard }, scope: snapshot.meta.scope, tradeDate: snapshot.meta.trade_date, seeds: snapshot.events, stockNames: Object.fromEntries(Object.values(snapshot.stocks).map(stock => [stock.code, stock.name ?? stock.code])), themeNames: Object.fromEntries(snapshot.dashboard.themes.map(theme => [theme.theme_id, theme.name])), onStock: (id: string) => onSelect({ kind: 'stock', id }), onTheme: (id: string) => onSelect({ kind: 'theme', id }), onMarket: () => onSelect({ kind: 'market' }) };
  return <Dialog.Root open={selection !== null} onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="sent-detail-overlay" /><Dialog.Content className="sentiment-detail" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
    <header className="sent-detail-header"><div><span className="sent-kicker">短线情绪 / 观察详情</span><Dialog.Title>{title}</Dialog.Title><Dialog.Description>后端已发布快照 · {snapshot.meta.trade_date}</Dialog.Description></div><Dialog.Close className="sent-icon-button" aria-label="关闭观察详情"><X size={20} /></Dialog.Close></header>
    <div className="sent-detail-body" key={selection ? `${selection.kind}:${'id' in selection ? selection.id : ''}` : 'closed'}>
      {selection?.kind === 'stock' && <StockContent code={selection.id} tradeDate={snapshot.meta.trade_date} publication={publicationKey(snapshot.meta)} eventsProps={eventsProps} onSelect={onSelect} />}
      {selection?.kind === 'theme' && <ThemeContent id={selection.id} tradeDate={snapshot.meta.trade_date} publication={publicationKey(snapshot.meta)} eventsProps={eventsProps} onSelect={onSelect} />}
      {selection?.kind === 'board' && (() => { const board = snapshot.dashboard.boards.find(item => item.board_type === selection.id); return board ? <><DetailMeta meta={snapshot.meta} /><Evidence emotion={board.emotion} /><Quality reasons={board.missing_reasons} /><SentimentFeedback stats={board} /></> : <p>该历史快照没有分板块明细。</p>; })()}
      {selection?.kind === 'market' && <><DetailMeta meta={snapshot.meta} /><Evidence emotion={snapshot.dashboard.market.emotion} /><SentimentHistory scope={snapshot.meta.scope} tradeDate={snapshot.meta.trade_date} meta={snapshot.meta} /><Quality reasons={snapshot.dashboard.market.missing_reasons} /><SentimentFeedback stats={snapshot.dashboard.market} /></>}
      {selection?.kind === 'rules' && <div className="sent-rules">{[
        ['范围与时间', '默认全 A 股，包含沪深主板、创业板、科创板和北交所，可切换沪深主板对照。板块归属采用后端 board_type；页面以响应交易日、时效和定稿标志为准；最新已发布日可能不是今天。行情缺失保留为未知。'],
        ['每题材前 7 只', '直接读取服务端完整成员排序的前七，默认不限是否触板；被排除和缺行情成员保留标记，不计入有效统计。筛选时读取全部分页并保持服务端顺序。依次按当前连板高度、多日多板的涨停板数降序、同花顺排名升序、涨幅降序排列，相同则按代码稳定排序；未知值排后。连板直接使用 intraday_streak，多板使用 board_run.limit_up_days，不把冲板目标算作已实现连板。'],
        ['叠加走势', '复用单股秒级图的已归档行情，按采集时间展示同一题材前 7 只股票从开盘至当前的涨幅。默认全天，支持上午、下午切换，午休时段压缩；缺失采样以断点展示，不补零或前向填充。保留观察的排行截止时间与归档处理时间分别展示。目标采样周期 5 秒，不代表逐笔或每秒必有报价。开板、封板、回封标注来自后端事件。'],
        ['事件标注', '事件独立来自后端；仅在收到相同来源时间的个股价格点时锚定到曲线。没有对应价格的事件仍保留在事件列表。观察时间不等同交易所首次发生时间，观察次数不代表全天完整次数。'],
        ['价格涨停与盘口封板', '以逐股当日限价及 is_limit_up 判断涨停，不统一按 10% 计算；is_sealed 和封单金额需要可核验盘口。盘口未知显示未知，不推断封单。'],
        ['统计与题材', '市场数据直接采用后端按代码去重统计，不累加题材计数，不平均各板块情绪。昨日反馈使用后端固定群体。历史题材属于固定题材池回看，成员关系不等于本次上涨原因。'],
        ['情绪状态', '同时阅读已确认状态、候选状态和 status；待确认或数据不足时，上次确认状态不代表当前已确认。大盘采用沸点、过热、微热、微冷、过冷、冰点；题材采用启动、主升、分歧、高潮、退潮、整理，题材阶段不是线性强弱排序。支持证据未知不会自动重置既有阶段。环境每五分钟判断，判断时间可能早于收盘行情时间。前端不生成情绪分数、预测概率或交易建议。'],
      ].map(([heading, body]) => <section key={heading}><h3>{heading}</h3><p>{body}</p></section>)}</div>}
    </div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
type EventsProps = Parameters<typeof SentimentEvents>[0];
function StockContent({ code, tradeDate, publication, eventsProps, onSelect }: { code: string; tradeDate: string; publication: string; eventsProps: EventsProps; onSelect: (selection: DetailSelection) => void }) {
  const resource = useSentimentResource(`${eventsProps.scope}:${tradeDate}:stock:${code}`, async signal => (await atConsistentSnapshot(tradeDate, meta => sentimentApi.stock(code, snapshotQuery(meta), signal), signal, eventsProps.scope, eventsProps.basis)).response, true, publication);
  if (!resource.data) return <DataNotice error={resource.error} loading={resource.loading} retry={resource.reload} />;
  const stock = resource.data.data;
  return <>{resource.error && <DataNotice loading={false} error={resource.error} retry={resource.reload} />}<DetailMeta meta={resource.data.meta} /><div className="sent-detail-quote"><div><span>{stock.code} · {stock.name} · {boardName(stock.board_type)}</span><strong className={(stock.change_ratio ?? 0) < 0 ? 'is-fall' : 'is-rise'}>{stock.price?.toFixed(2) ?? '—'}<small>{pct(stock.change_ratio, 2, true)}</small></strong></div><span className="sent-emotion-tag">{stockStatus(stock)}</span></div>
    <div className="sent-stock-story"><p>{popularityText(stock.popularity)} · 热度 {stock.popularity?.status === 'ranked' ? displayNumber(stock.popularity.heat) : '—'} · 榜单时间 {clockTime(stock.popularity?.observed_at ?? null)}</p>{stock.popularity?.rank_change != null && <p>供应商排名变化：{typeof stock.popularity.rank_change === 'object' ? JSON.stringify(stock.popularity.rank_change) : String(stock.popularity.rank_change)}</p>}<strong>{stock.limit_status === 'opened' ? '今日冲击' : '连续板高度'} {displayNumber(stockHeight(stock))} 板 · {stock.is_final ? '已定稿' : '暂定'}</strong><p>昨日确认 {displayNumber(stock.confirmed_streak_before_today)} 板 · 多日多板 {stock.board_run.label ?? '未知'}（{stock.board_run.is_final ? '已定稿' : '暂定'}）</p></div>
    <dl className="sent-detail-grid">{[['首次观察触板', clockTime(stock.first_touch_at)], ['首次观察封板', clockTime(stock.first_seal_at)], ['最近观察开板', clockTime(stock.last_open_at)], ['最近观察回封', clockTime(stock.last_reseal_at)], ['已观察开板次数', displayNumber(stock.observed_open_count)], ['盘口封板', stock.is_sealed === null ? '未知' : stock.is_sealed ? '可核验' : '未封板'], ['封单金额', money(stock.seal_amount_yuan)], ['成交额', money(stock.amount_yuan)], ['换手率', pct(stock.turnover_ratio)], ['来源时间', clockTime(stock.source_time)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="sent-panel-note">{stock.eligible ? '参与统计' : `不参与统计：${stock.excluded_reason ?? '未知'}`} · {stock.valid ? '行情有效' : '行情缺失'} · {stock.is_stale ? '过期' : '未标记过期'}</p><Quality reasons={stock.missing_reasons} />
    <section className="sent-board-history"><h3>近 20 个交易日板记录</h3><div>{stock.board_history.map((day, index) => <span key={day.trade_date ?? index} title={`${day.trade_date ?? '日期未知'} · ${day.is_final === false ? '未定稿' : '历史记录'}`}><i className={day.is_limit_up === true ? 'is-sealed' : ''}>{day.is_limit_up === true ? '板' : day.is_limit_up === false ? '—' : '?'}</i><small>{day.trade_date?.slice(5) ?? '—'}</small></span>)}</div><p>“?” 表示未知，不作为非涨停日。</p></section>
    <section className="sent-detail-section"><h3>关联题材</h3><div className="sent-related-themes">{stock.themes.map(theme => <button type="button" key={theme.theme_id} onClick={() => onSelect({ kind: 'theme', id: theme.theme_id })}>{theme.name}<ArrowUpRight size={14} /></button>)}</div><p>题材关联不等于本次上涨原因。</p></section>
    <SentimentEvents {...eventsProps} code={code} seeds={[...(eventsProps.seeds ?? []), ...stock.events.items]} />
  </>;
}
function ThemeContent({ id, tradeDate, publication, eventsProps, onSelect }: { id: string; tradeDate: string; publication: string; eventsProps: EventsProps; onSelect: (selection: DetailSelection) => void }) {
  const [page, setPage] = useState(1);
  const resource = useSentimentResource(`${eventsProps.scope}:${tradeDate}:theme:${id}:${page}`, async signal => (await atConsistentSnapshot(tradeDate, meta => sentimentApi.theme(id, { ...snapshotQuery(meta), page, page_size: 50, sort: 'board_strength' }, signal), signal, eventsProps.scope, eventsProps.basis)).response, true, publication);
  if (!resource.data) return <DataNotice error={resource.error} loading={resource.loading} retry={resource.reload} />;
  const theme = resource.data.data;
  const ladder = [...new Map(theme.ladder.groups.flatMap(group => group.levels.flatMap(level => level.stocks)).map(stock => [stock.code, stock])).values()].sort(compareLiveStocks);
  return <>{resource.error && <DataNotice loading={false} error={resource.error} retry={resource.reload} />}<DetailMeta meta={resource.data.meta} /><p className="sent-detail-intro">范围成员 {theme.scope_member_count} / 全部成员 {theme.member_count} · 覆盖 {pct(theme.values.coverage)}</p><p className="sent-panel-note">{theme.historical_membership_verified ? '历史成员关系已核验' : '固定题材池回看 · 历史成员关系未核验'}</p><Evidence emotion={theme.emotion} /><Quality reasons={theme.missing_reasons} />
    <SentimentHistory scope={eventsProps.scope} tradeDate={tradeDate} themeId={id} meta={resource.data.meta} onConflict={resource.reload} /><SentimentFeedback stats={theme} />
    <section className="sent-detail-section"><h3>题材梯队</h3>{ladder.map(stock => <StockRow key={stock.code} stock={stock} onSelect={code => onSelect({ kind: 'stock', id: code })} />)}{!ladder.length && <p>暂无梯队成员</p>}</section>
    <section className="sent-detail-section"><h3>全部成员 · {theme.members.total}</h3><p>保留被排除和缺行情成员的状态。</p>{theme.members.items.map(stock => <StockRow key={stock.code} stock={stock} onSelect={code => onSelect({ kind: 'stock', id: code })} />)}<div className="sent-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><span>第 {theme.members.page} 页</span><button type="button" disabled={theme.members.page * theme.members.page_size >= theme.members.total} onClick={() => setPage(value => value + 1)}>下一页</button></div></section>
    <SentimentEvents {...eventsProps} themeId={id} />
  </>;
}

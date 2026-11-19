import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronRight, CircleHelp, Clock3, Filter, Layers3, ListFilter, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Star, Waves, X } from 'lucide-react';
import { useWorkspaceState } from '../../hooks/useWorkspaceState';
import { useSentiment } from './useSentiment';
import { awaitingClose, isFinal, isRetained } from './sentiment-publication';
import { SentimentPublication } from './SentimentPublication';
import { BOARD_NAMES, SCOPE_NAMES, scopeBoards, type SentimentScope } from './sentiment-contract';
import { sentimentDaySeries } from './sentiment-day-series';
import { SentimentBoards } from './SentimentBoards';
import { SentimentOverview } from './SentimentOverview';
import { MarketLadder, ThemeCard } from './SentimentLadder';
import { SentimentDetails, type DetailSelection } from './SentimentDetails';
import { DataNotice } from './SentimentHistory';
import { SentimentEvents, SentimentFeedback } from './SentimentPanels';
import { clockTime } from './sentiment-model';
import { displayNumber, emotionColor, emotionTitle, pct, selectLiveStocks, type LiveFilters } from './sentiment-live-model';

const DEFAULT_FILTERS: LiveFilters = { query: '', status: 'all', height: null, board: '' };
const CONNECTION = { loading: '读取快照', connecting: '连接实时订阅', live: '实时订阅', polling: '快照轮询', historical: '历史日期 · 实时订阅已关闭', error: '数据暂不可用' };
const SESSION: Record<string, string> = { opening_auction: '开盘竞价', continuous: '连续交易', lunch: '午休', closing_auction: '收盘竞价', closed_pending_final: '收盘待定稿', closed: '收盘' };
export function SentimentWorkspace() {
  const [scope, setScope] = useState<SentimentScope>('all_a');
  const [tradeDate, setTradeDate] = useState<string>();
  const [dateInput, setDateInput] = useState('');
  const { snapshot, connection, error, refresh, resync } = useSentiment(tradeDate, scope);
  const final = !!snapshot && isFinal(snapshot.meta), retained = !!snapshot && isRetained(snapshot.meta);
  const pendingClose = !!snapshot && awaitingClose(snapshot.meta);
  const [view, setView] = useWorkspaceState<'themes' | 'market'>('sentiment:focus-view', 'themes');
  const [filters, setFilters] = useWorkspaceState<LiveFilters>('sentiment:v1.2:member-filters', DEFAULT_FILTERS);
  const [selectedThemeId, setSelectedThemeId] = useWorkspaceState<string | null>('sentiment:selected-theme', null);
  const [themeQuery, setThemeQuery] = useState('');
  const [cycle, setCycle] = useState('all');
  const [favorites, setFavorites] = useWorkspaceState<string[]>('sentiment:favorites', []);
  const [onlyFavorites, setOnlyFavorites] = useWorkspaceState('sentiment:only-favorites', false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [chartFocused, setChartFocused] = useState(false);
  const [selection, setSelection] = useState<DetailSelection | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const stocks = useMemo(() => Object.values(snapshot?.stocks ?? {}), [snapshot?.stocks]);
  const themes = useMemo(() => (snapshot?.dashboard.themes ?? [])
    .filter(theme => (cycle === 'all' || emotionTitle(theme.emotion) === cycle)
      && (!onlyFavorites || favorites.includes(theme.theme_id))
      && (!themeQuery.trim() || theme.name.toLowerCase().includes(themeQuery.trim().toLowerCase())))
    , [snapshot?.dashboard.themes, cycle, onlyFavorites, favorites, themeQuery]);
  useEffect(() => { if (!selectedThemeId && themes[0]) setSelectedThemeId(themes[0].theme_id); }, [selectedThemeId, themes, setSelectedThemeId]);
  const selectedTheme = themes.find(theme => theme.theme_id === selectedThemeId) ?? themes[0];
  const marketStocks = useMemo(() => view === 'market' ? selectLiveStocks(stocks, filters) : [], [view, stocks, filters]);
  const open = useCallback((next: DetailSelection) => { triggerRef.current = document.activeElement as HTMLElement; setSelection(next); }, []);
  const onStock = useCallback((id: string) => open({ kind: 'stock', id }), [open]);
  const onTheme = useCallback((id: string) => open({ kind: 'theme', id }), [open]);
  const onFavorite = (id: string) => setFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const activeFilters = !!filters.query || filters.height !== null || !!filters.board || !['all', 'touched'].includes(filters.status) || (view === 'themes' && filters.status === 'touched');
  const changeDate = (date?: string) => { if (date === tradeDate) { refresh(); return; } sentimentDaySeries.clear(); setSelection(null); setTradeDate(date); setDateInput(date ?? ''); };
  const changeScope = (next: SentimentScope) => { if (next === scope) return; sentimentDaySeries.clear(); setSelection(null); setScope(next); resetFilters(); };
  const refreshData = refresh;
  const memberFilters = <div className="sent-focus-filters">
    <label className="sent-search"><Search size={14} /><input value={filters.query} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} placeholder="筛选股票 / 代码" aria-label="筛选股票或代码" />{filters.query && <button type="button" aria-label="清空股票筛选" onClick={() => setFilters(current => ({ ...current, query: '' }))}><X size={12} /></button>}</label>
    <label className="sent-select"><Filter size={13} /><select aria-label="涨停状态" value={view === 'market' && filters.status === 'all' ? 'touched' : filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value as LiveFilters['status'] }))}>{view === 'themes' && <option value="all">全部成员</option>}<option value="touched">全部触板</option><option value="limit_up">当前涨停价</option><option value="opened">当前开板</option></select></label>
    <label className="sent-select"><select aria-label="板块筛选" value={filters.board} onChange={event => setFilters(current => ({ ...current, board: event.target.value as LiveFilters['board'] }))}><option value="">全部板块</option>{scopeBoards(scope).map(board => <option key={board} value={board}>{BOARD_NAMES[board]}</option>)}</select></label>
    {activeFilters && <button type="button" className="sent-focus-reset" onClick={resetFilters}>重置{filters.height !== null && ` · ${filters.height}板`}<X size={12} /></button>}
    <span className="sent-sort-note">连板 ↓<ChevronRight size={11} />{view === 'themes' ? <>多板 ↓<ChevronRight size={11} />热度名次 ↑<ChevronRight size={11} />涨幅 ↓</> : '触板时间 ↑'}</span>
  </div>;
  return <main className="sentiment-workspace sent-focus-workspace">
    <header className="sent-page-heading"><div><div className="sent-heading-line"><span className="sent-title-mark"><Waves size={23} /></span><h1>短线情绪</h1><span className="sent-demo-badge">{!snapshot ? '等待数据' : tradeDate ? '历史观察' : '已发布行情'}</span></div><p>选择一个题材，追踪前七只股票的全天变化。</p></div>
      <div className="sent-page-actions"><label className="sent-select sent-scope-select"><span>观测范围</span><select aria-label="情绪观测范围" value={scope} onChange={event => changeScope(event.target.value as SentimentScope)}>{Object.entries(SCOPE_NAMES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><form className="sent-date-form" onSubmit={event => { event.preventDefault(); changeDate(dateInput || undefined); }}><input type="date" aria-label="情绪交易日" value={dateInput} onChange={event => setDateInput(event.target.value)} /><button type="submit" className="sent-button">查看</button></form><button type="button" className="sent-button" aria-pressed={!tradeDate} onClick={() => changeDate()}>最新发布</button><button type="button" className="sent-icon-button sent-refresh" aria-label="刷新情绪数据" title="刷新情绪数据" onClick={refreshData}><RefreshCw size={15} /></button></div>
    </header>
    <div className="sent-context-strip"><span><i className={connection === 'live' && !pendingClose && !retained && !final ? 'is-playing' : ''} />{final ? '已收盘 · 定稿快照' : retained ? '服务端保留观察' : pendingClose ? '等待收盘定稿' : CONNECTION[connection]}{snapshot && !tradeDate && !pendingClose && !retained && !final && <> · 目标 {snapshot.meta.sample_interval_seconds ?? 5} 秒采样</>}</span><span>{SCOPE_NAMES[scope]}{snapshot && <> <b>·</b> {SESSION[snapshot.meta.session] ?? snapshot.meta.session} <b>·</b> {final ? '已定稿' : '未定稿'}</>}</span></div>
    {error && <DataNotice error={error} loading={false} retry={refreshData} />}
    {!snapshot ? !error && <DataNotice loading={true} error={null} /> : <>
      <div className={`sent-live-meta${snapshot.meta.is_stale ? ' is-stale' : ''}`}><span className="sent-snapshot-clock"><Clock3 size={13} />观察截至 {snapshot.meta.trade_date}<b>{clockTime(snapshot.meta.as_of)}</b></span><span>{retained ? '保留观察年龄' : snapshot.meta.is_stale ? '数据过期' : '数据年龄'} {snapshot.meta.age_seconds.toFixed(0)} 秒{snapshot.meta.is_stale && retained ? ' · 已标记过期' : ''} · 覆盖 {pct(snapshot.meta.coverage)}</span><button type="button" onClick={() => open({ kind: 'rules' })}><CircleHelp size={13} />统计口径</button></div>
      <SentimentPublication meta={snapshot.meta} />{snapshot.meta.popularity && <p className="sent-panel-note">同花顺榜单：{{ available: '可用', missing: '缺失', stale: '已过期' }[snapshot.meta.popularity.status]} · 采集 {clockTime(snapshot.meta.popularity.observed_at ?? null)} · 随行情快照冻结</p>}
      <div className="sent-market-compact">
        <button type="button" className="sent-market-summary" onClick={() => open({ kind: 'market' })}><Waves size={16} /><span>大盘情绪</span><b>{emotionTitle(snapshot.dashboard.market.emotion)}</b></button>
        <span>涨停 <b className="is-rise">{displayNumber(snapshot.dashboard.market.values.limit_up)}</b></span><span>跌停 <b className="is-fall">{displayNumber(snapshot.dashboard.market.values.limit_down)}</b></span><span>最高 <b>{displayNumber(snapshot.dashboard.market.values.height)}</b> 板</span>
        <button type="button" className="sent-overview-toggle" aria-expanded={overviewOpen} onClick={() => setOverviewOpen(value => !value)}>{overviewOpen ? '收起总览' : '展开市场总览'}<ChevronDown size={14} /></button>
      </div>
      {overviewOpen && <div className="sent-overview-expanded"><SentimentOverview snapshot={snapshot} onConflict={resync} height={filters.height} onHeight={height => setFilters(current => ({ ...current, height }))} onEvidence={() => open({ kind: 'market' })} /><SentimentBoards boards={snapshot.dashboard.boards} selected={filters.board} onFilter={board => setFilters(current => ({ ...current, board: current.board === board ? '' : board }))} onEvidence={id => open({ kind: 'board', id })} /></div>}
      <section className="sent-ladder-section" aria-labelledby="sent-ladder-title">
        <div className="sent-ladder-heading"><div><h2 id="sent-ladder-title">题材观察台</h2><p>全部成员参与 · 连板、多板、热度、涨幅排序取前 7</p></div><div className="sent-observation-actions">{view === 'themes' && <button type="button" className="sent-button sent-focus-toggle" aria-pressed={chartFocused} onClick={() => setChartFocused(value => !value)}>{chartFocused ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}{chartFocused ? '展开题材' : '专注看盘'}</button>}<div className="sent-segment sent-view-switch" aria-label="梯队展示方式"><button type="button" aria-pressed={view === 'themes'} onClick={() => { setView('themes'); setFilters(current => ({ ...current, status: 'all' })); }}><Layers3 size={14} />题材大图</button><button type="button" aria-pressed={view === 'market'} onClick={() => setView('market')}><ListFilter size={14} />市场梯队</button></div></div></div>
        {view === 'themes' ? <div className={`sent-focus-layout${chartFocused ? ' is-chart-focused' : ''}`}>
          <aside className="sent-theme-picker" aria-label="题材自选列表">
            <div className="sent-picker-heading"><h3>题材列表 <small>{themes.length}</small></h3><span>点击切换</span></div>
            <label className="sent-search"><Search size={14} /><input aria-label="搜索题材" placeholder="搜索题材" value={themeQuery} onChange={event => setThemeQuery(event.target.value)} />{themeQuery && <button type="button" aria-label="清空题材搜索" onClick={() => setThemeQuery('')}><X size={12} /></button>}</label>
            <div className="sent-picker-controls"><div className="sent-segment"><button type="button" aria-pressed={!onlyFavorites} onClick={() => setOnlyFavorites(false)}>全部</button><button type="button" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(true)}><Star size={12} />自选</button></div><label className="sent-select"><select aria-label="题材情绪阶段" value={cycle} onChange={event => setCycle(event.target.value)}><option value="all">全部情绪</option>{[...new Set(snapshot.dashboard.themes.map(theme => emotionTitle(theme.emotion)))].map(state => <option key={state}>{state}</option>)}</select></label></div>
            <div className="sent-picker-list">{themes.map(theme => <div className={`sent-picker-row${selectedTheme?.theme_id === theme.theme_id ? ' is-selected' : ''}`} key={theme.theme_id}>
              <button type="button" className="sent-picker-select" aria-label={`选择题材${theme.name}`} aria-pressed={selectedTheme?.theme_id === theme.theme_id} onClick={() => setSelectedThemeId(theme.theme_id)}><span><strong>{theme.name}</strong><span className={`sent-emotion-tag is-${emotionColor(theme.emotion)}`}>{emotionTitle(theme.emotion)}</span></span><span><small>涨停 <b>{displayNumber(theme.values.limit_up)}</b></small><small>高度 <b>{displayNumber(theme.values.height)}</b> 板</small><ChevronRight size={12} /></span></button>
              <button type="button" className="sent-picker-star" aria-label={`${favorites.includes(theme.theme_id) ? '取消自选' : '加入自选'}${theme.name}`} aria-pressed={favorites.includes(theme.theme_id)} onClick={() => onFavorite(theme.theme_id)}><Star size={13} fill={favorites.includes(theme.theme_id) ? 'currentColor' : 'none'} /></button>
            </div>)}{!themes.length && <div className="sent-picker-empty">{onlyFavorites ? '还没有匹配的自选题材，点击星标添加。' : '没有匹配的题材。'}</div>}</div>
          </aside>
          <div className="sent-focus-main">{memberFilters}{selectedTheme ? <ThemeCard key={`${scope}:${snapshot.meta.trade_date}:${selectedTheme.theme_id}`} theme={selectedTheme} filters={filters} index={themes.indexOf(selectedTheme)} favorite={favorites.includes(selectedTheme.theme_id)} onFavorite={onFavorite} onTheme={onTheme} onStock={onStock} onConflict={resync} meta={snapshot.meta} historical={!!tradeDate} connected={connection === 'live' && !pendingClose && !retained && !final} /> : <div className="sent-empty"><Layers3 size={28} /><h3>选择一个题材开始观察</h3><p>可在左侧搜索或切换到全部题材。</p></div>}</div>
        </div> : <>{memberFilters}{marketStocks.length ? <MarketLadder stocks={marketStocks} onStock={onStock} /> : <div className="sent-empty">暂无符合条件的梯队成员</div>}</>}
      </section>
      <div className="sent-bottom-grid"><SentimentFeedback stats={snapshot.dashboard.market} /><SentimentEvents key={`${snapshot.meta.scope}:${snapshot.meta.trade_date}`} scope={scope} tradeDate={snapshot.meta.trade_date} basis={{ meta: snapshot.meta, data: snapshot.dashboard }} seeds={snapshot.events} stockNames={Object.fromEntries(stocks.map(stock => [stock.code, stock.name ?? stock.code]))} themeNames={Object.fromEntries(snapshot.dashboard.themes.map(theme => [theme.theme_id, theme.name]))} onStock={onStock} onTheme={onTheme} onMarket={() => open({ kind: 'market' })} /></div>
      <footer className="sent-page-footer"><span>有效 {displayNumber(snapshot.dashboard.market.values.eligible)} / 应观测 {displayNumber(snapshot.dashboard.market.values.expected)} · 缺失 {displayNumber(snapshot.dashboard.market.values.missing)}</span><span>描述性情绪观察<button type="button" onClick={() => open({ kind: 'rules' })}>查看口径<ArrowUpRight size={12} /></button></span></footer>
      <SentimentDetails key={`${snapshot.meta.scope}:${snapshot.meta.trade_date}`} selection={selection} snapshot={snapshot} onSelect={setSelection} onClose={() => setSelection(null)} restoreFocus={() => { const target = triggerRef.current?.isConnected ? triggerRef.current : document.querySelector<HTMLElement>('.sent-refresh'); target?.focus(); }} />
    </>}
  </main>;
}

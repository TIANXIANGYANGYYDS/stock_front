import { CalendarDays, HandCoins, LayoutDashboard, ListFilter, ScanSearch, WalletCards, RefreshCw, History, BookOpen, ListChecks } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import * as m from 'motion/react-m';
import { SelectionGroup, SelectionIndicator, useEntranceMotion } from '../../components/StudioMotion';
import { useWorkspaceState } from '../../hooks/useWorkspaceState';
import { getQuantStrategies } from './quant-api';
import { QuantDataQualityNotice, QuantEmptyState, QuantErrorState, QuantLoadingState, QuantSafetyNotice, QuantStatusBadge } from './QuantCommon';
import { QuantDailyPage } from './QuantDailyPage';
import { QuantExecutionsPage } from './QuantExecutionsPage';
import { QuantHoldingsPage } from './QuantHoldingsPage';
import { QuantObservationsPage } from './QuantObservationsPage';
import { QuantOverview } from './QuantOverview';
import { QuantSignalsPage } from './QuantSignalsPage';
import { QuantRecordsPage } from './QuantRecordsPage';
import { formatQuantDateTime, quantErrorMessage, recordingLabel } from './quant-format';
import type { QuantStrategyList } from './quant-types';
import { useQuantSnapshot } from './useQuantSnapshot';
import { useQuantHistory } from './useQuantHistory';

const NAVIGATION = [
  { id: 'overview', label: '账户总览', icon: LayoutDashboard, path: '/quant' },
  { id: 'accounts', label: '逐股账户', icon: BookOpen, path: '/quant/accounts' },
  { id: 'observations', label: '观察列表', icon: ScanSearch, path: '/quant/observations' },
  { id: 'signals', label: '买卖信号', icon: ListFilter, path: '/quant/signals' },
  { id: 'executions', label: '模拟成交', icon: HandCoins, path: '/quant/executions' },
  { id: 'holdings', label: '持仓', icon: WalletCards, path: '/quant/holdings' },
  { id: 'closed-trades', label: '当日平仓', icon: History, path: '/quant/closed-trades' },
  { id: 'preselections', label: '买入预选', icon: ListChecks, path: '/quant/preselections' },
  { id: 'sell-candidates', label: '卖出候选', icon: ListChecks, path: '/quant/sell-candidates' },
  { id: 'exit-decisions', label: '退出判断', icon: ListFilter, path: '/quant/exit-decisions' },
  { id: 'daily', label: '当日完整记录', icon: CalendarDays, path: '/quant/daily/' },
] as const;

export function QuantWorkspace() {
  const entrance = useEntranceMotion();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (/^\/quant\/runtime(?:\/|$)/.test(location.pathname)) navigate('/quant', { replace: true });
  }, [location.pathname, navigate]);
  const section = NAVIGATION.find(item => item.id !== 'overview' && location.pathname.startsWith(item.path))?.id ?? 'overview';
  const workspaceRef = useRef<HTMLElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);
  const dateToolbarRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    const navigation = navigationRef.current;
    if (!workspace || !navigation) return;
    // Wrapped navigation changes height with screen width, zoom and font loading.
    const measure = () => workspace.style.setProperty('--quant-navigation-height', `${navigation.getBoundingClientRect().height}px`);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(navigation);
    if (!observer) window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      workspace.style.removeProperty('--quant-navigation-height');
    };
  }, []);
  const previousSection = useRef(section);
  useLayoutEffect(() => {
    if (previousSection.current !== section) dateToolbarRef.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    previousSection.current = section;
  }, [section]);
  const routeDate = section === 'daily' ? location.pathname.split('/')[3] : '';
  const [selectedId, setSelectedId] = useWorkspaceState('quant.public.strategy', '');
  const [requestedDate, setRequestedDate] = useWorkspaceState('quant.continuous.date', '');
  const effectiveDate = section === 'daily' ? (routeDate === 'latest' ? '' : routeDate ?? '') : requestedDate;
  const [dateDraft, setDateDraft] = useState(effectiveDate);
  const [catalog, setCatalog] = useState<QuantStrategyList | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogReload, setCatalogReload] = useState(0);
  useEffect(() => setDateDraft(effectiveDate), [effectiveDate]);
  useEffect(() => {
    const controller = new AbortController();
    setCatalog(null); setCatalogError(null);
    void getQuantStrategies({ signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setCatalog(result);
    }).catch(error => {
      if (!controller.signal.aborted) setCatalogError(quantErrorMessage(error));
    });
    return () => controller.abort();
  }, [catalogReload]);
  const strategy = catalog?.items.find(item => item.id === selectedId) ?? catalog?.items[0];
  // A single latest-overview poll owns history changes, including while viewing an older day.
  const latestSnapshot = useQuantSnapshot(strategy?.id ?? '', !!strategy, '', section !== 'daily');
  const history = useQuantHistory(latestSnapshot.data, latestSnapshot.resetCount, latestSnapshot.recoverSnapshot);
  const validDate = !effectiveDate || !!history.points?.some(point => point.trade_date === effectiveDate);
  const historical = !!effectiveDate && effectiveDate !== latestSnapshot.data?.trade_date;
  const datedSnapshot = useQuantSnapshot(strategy?.id ?? '', !!strategy && !!history.points && validDate && historical, effectiveDate, false, history.key);
  const snapshot = historical ? datedSnapshot : latestSnapshot;
  const selectedPoint = history.points?.find(point => point.trade_date === effectiveDate);
  const mismatch = !!(historical && datedSnapshot.data && selectedPoint && (datedSnapshot.data.snapshot_id !== selectedPoint.snapshot_id
    || datedSnapshot.data.recording.start_date !== latestSnapshot.data?.recording.start_date));
  useEffect(() => { if (mismatch) latestSnapshot.recoverSnapshot(); }, [mismatch, latestSnapshot.recoverSnapshot]);
  // The directory is the authority for the visible strategy identity across all child views.
  const data = snapshot.data && strategy ? { ...snapshot.data, strategy_name: strategy.name, strategy: { ...snapshot.data.strategy, id: strategy.id, name: strategy.name } } : null;
  const latest = latestSnapshot.data && strategy ? { ...latestSnapshot.data, strategy_name: strategy.name } : null;
  const contextData = !catalogError && !latestSnapshot.error && !history.error && latest && history.points && !mismatch && validDate && !snapshot.error ? data : null;
  const applyDate = (date: string) => {
    setRequestedDate(date);
    setDateDraft(date);
    if (section === 'daily') navigate(`/quant/daily/${date || 'latest'}`);
  };
  const changeSection = (path: string) => {
    setRequestedDate(effectiveDate);
    navigate(path.endsWith('/daily/') ? `${path}${data?.trade_date || effectiveDate || 'latest'}` : path);
  };
  const retryCatalog = () => setCatalogReload(value => value + 1);

  return <main ref={workspaceRef} className="quant-workspace">
    <QuantSafetyNotice />
    <div ref={navigationRef} className="quant-subnav-row">
      <div className="quant-nav-group">
        <label className="quant-strategy-select"><span>策略</span><select aria-label="选择量化策略" value={strategy?.id ?? ''} disabled={!catalog?.items.length} onChange={event => { setSelectedId(event.target.value); applyDate(''); }}>
          {!catalog?.items.length && <option value="">{catalog ? '暂无公开策略' : '加载策略目录…'}</option>}
          {catalog?.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <SelectionGroup><nav className="quant-subnav" aria-label="量化影子盘导航">
          {NAVIGATION.map(item => { const Icon = item.icon; return <button type="button" key={item.id} className={section === item.id ? 'is-active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => changeSection(item.path)}>
            <Icon size={14} />{item.label}<SelectionIndicator active={section === item.id} />
          </button>; })}
        </nav></SelectionGroup>
      </div>
    </div>
    <div ref={dateToolbarRef} className="quant-date-toolbar">
      <form className="quant-filter-bar" onSubmit={event => { event.preventDefault(); applyDate(dateDraft); }}>
        <label><span>交易日期（仅列出已有记录）</span><select aria-label="量化交易日期" disabled={!history.points} value={dateDraft} onChange={event => setDateDraft(event.target.value)}>
          <option value="">最新已有交易日{latest ? ` · ${latest.trade_date}` : ''}</option>
          {dateDraft && !history.points?.some(point => point.trade_date === dateDraft) && <option value={dateDraft} disabled>{dateDraft} · {history.points ? '无交易记录' : '正在核对'}</option>}
          {history.points?.map(point => <option key={point.trade_date} value={point.trade_date}>{point.trade_date}</option>)}
        </select></label>
        <button type="submit" className="quant-button is-primary" disabled={!history.points || !!dateDraft && !history.points.some(point => point.trade_date === dateDraft)}>查看日期</button>
        <button type="button" className="quant-button" onClick={() => applyDate('')}>最新已有交易日</button>
        <button type="button" className="quant-button" disabled={!strategy || latestSnapshot.initialLoading} onClick={latestSnapshot.refresh}><RefreshCw size={14} />{latestSnapshot.refreshing ? '正在刷新' : '刷新数据'}</button>
      </form>
      {latest && history.points && <p className="quant-date-range">已有记录区间 {latest.recording.start_date ?? '—'} 至 {latest.trade_date} · 共 {history.points.length} 个交易日</p>}
      {contextData && <div className="quant-snapshot-context" key={`${history.key}:${contextData.trade_date}:${contextData.snapshot_id}`}>
        <h1 className="sr-only">{contextData.strategy_name} · 模拟账户</h1>
        <span>数据截至日期 {contextData.trade_date}{!effectiveDate ? ' · 最新已有交易日' : ''}</span>
        <span>账户统计区间 {contextData.recording.start_date ?? '—'} 至 {contextData.trade_date}</span>
        <span>{recordingLabel(contextData.recording.mode)}</span>
        <QuantStatusBadge value={contextData.status} kind="run" />
        <details className="quant-recording-details">
          <summary>数据详情</summary>
          <div className="quant-public-meta">
            <QuantStatusBadge value={contextData.runtime.data_status} kind="data" />
            <span>数据更新 {formatQuantDateTime(contextData.updated_at)}</span>
            {contextData.recording.mode === 'historical_replay' && <span>补录计算时间 {formatQuantDateTime(contextData.recording.computed_at)}（非成交时间）</span>}
            {contextData.recording.history_rebased_at && <span>历史重建时间 {formatQuantDateTime(contextData.recording.history_rebased_at)}（非成交时间）</span>}
          </div>
        </details>
        {latestSnapshot.refreshing && <span role="status">正在检查最新数据…</span>}
        <QuantDataQualityNotice compact runtime={contextData.runtime} onRetry={latestSnapshot.refresh} />
      </div>}
    </div>
    <m.div key={section} className="quant-page-scroll terminal-scroll" {...entrance}>
      {catalogError ? <QuantErrorState title="策略目录加载失败" message={catalogError} onRetry={retryCatalog} />
        : !catalog ? <QuantLoadingState label="正在读取公开策略目录…" />
          : !strategy ? <QuantEmptyState title="暂无公开策略" action={<button type="button" className="quant-button" onClick={retryCatalog}>重新检查</button>} />
            : latestSnapshot.error ? <QuantErrorState title="量化账户加载失败" message={latestSnapshot.error} onRetry={latestSnapshot.refresh} />
              : history.error ? <QuantErrorState title="交易日期与收益历史加载失败" message={history.error} onRetry={latestSnapshot.refresh} />
                : !latest || !history.points || mismatch ? <QuantLoadingState label="正在核对账户起点与全部交易日记录…" />
                  : !validDate ? <QuantEmptyState title="所选日期没有已有交易记录" description="请选择列表中的实际交易日期，或查看最新记录。" action={<button type="button" className="quant-button" onClick={() => applyDate('')}>查看最新记录</button>} />
                    : snapshot.error ? <QuantErrorState title="量化账户加载失败" message={snapshot.error} onRetry={latestSnapshot.refresh} />
                      : !data ? <QuantLoadingState label="正在读取所选日期的账户…" /> : <div key={`${history.key}:${data.strategy_id}:${data.trade_date}:${data.snapshot_id}:${snapshot.resetCount}`} className="quant-active-detail">
                  {section === 'overview' && <QuantOverview data={data} latest={latest} performance={history.points} onOpenSignals={() => changeSection('/quant/signals')} />}
                  {section === 'observations' && <QuantObservationsPage snapshot={data} onSnapshotConflict={latestSnapshot.recoverSnapshot} />}
                  {section === 'signals' && <QuantSignalsPage snapshot={data} onSnapshotConflict={latestSnapshot.recoverSnapshot} />}
                  {section === 'executions' && <QuantExecutionsPage snapshot={data} onSnapshotConflict={latestSnapshot.recoverSnapshot} />}
                  {section === 'holdings' && <QuantHoldingsPage snapshot={data} onSnapshotConflict={latestSnapshot.recoverSnapshot} />}
                  {section === 'closed-trades' && <QuantRecordsPage resource="closed-trades" snapshot={data} onSnapshotConflict={latestSnapshot.recoverSnapshot} />}
                  {(section === 'accounts' || section === 'preselections' || section === 'sell-candidates' || section === 'exit-decisions') && <QuantRecordsPage resource={section} snapshot={data} onSnapshotConflict={latestSnapshot.recoverSnapshot} />}
                  {section === 'daily' && <QuantDailyPage snapshot={data} onSnapshotConflict={latestSnapshot.recoverSnapshot} />}
                </div>}
    </m.div>
  </main>;
}


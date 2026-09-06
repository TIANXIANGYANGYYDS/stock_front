import { useEffect, useRef } from 'react';
import {
  Activity,
  BarChart3,
  CandlestickChart,
  MessageSquareQuote,
  Newspaper,
  Orbit,
  Radio,
  ArrowUpRight,
  Sun,
  Moon,
  Search,
} from 'lucide-react';
import { useAppearance } from '../hooks/useAppearance';
import { SelectionGroup, SelectionIndicator } from './StudioMotion';
import type { RealtimeMarketIndicesResponse } from '../lib/api';
import {
  formatShanghaiTime,
  marketStatusLabel,
  orderMarketIndices,
  quoteTone,
} from '../lib/realtime-format';

export type WorkspaceView = 'decision' | 'market' | 'news' | 'creators' | 'quant';

interface TerminalHeaderProps {
  activeView: WorkspaceView;
  tradeDate?: string;
  realtimeIndices: RealtimeMarketIndicesResponse | null;
  indicesLoading: boolean;
  indicesDelayed: boolean;
  indicesError: string | null;
  onViewChange: (view: WorkspaceView) => void;
  onOpenCommands?: () => void;
  onOpenPanorama?: () => void;
}

function formatNumber(value: number | null, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(digits)
    : '--';
}

function formatSigned(value: number | null, suffix = ''): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`;
}

export function TerminalHeader({
  activeView,
  tradeDate,
  realtimeIndices,
  indicesLoading,
  indicesDelayed,
  indicesError,
  onViewChange,
  onOpenCommands,
  onOpenPanorama,
}: TerminalHeaderProps) {
  const { appearance, toggleAppearance } = useAppearance();
  const activeNavigationRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const item = activeNavigationRef.current;
    const nav = item?.parentElement;
    if (item && nav) nav.scrollLeft = item.offsetLeft - nav.offsetLeft - (nav.clientWidth - item.clientWidth) / 2;
  }, [activeView]);
  const orderedIndices = orderMarketIndices(realtimeIndices?.items ?? []);
  const hasRealtimeData = (realtimeIndices?.items.length ?? 0) > 0;
  const backendStale = realtimeIndices?.marketStatus === 'stale'
    || realtimeIndices?.items.some((item) => item.status === 'stale') === true;
  const dataDelayed = indicesDelayed || backendStale;
  const updatedTime = formatShanghaiTime(realtimeIndices?.updatedAt ?? '');
  const indexSummary = indicesError && !hasRealtimeData
    ? '行情暂不可用'
    : hasRealtimeData
      ? `${dataDelayed || indicesError ? '数据可能延迟 · ' : ''}${realtimeIndices?.marketStatus === 'closed' ? '最后行情 · ' : ''}更新 ${updatedTime}`
      : realtimeIndices
        ? `更新 ${updatedTime}`
        : '等待指数行情';
  const navigation: Array<{ id: WorkspaceView; label: string; icon: typeof Activity }> = [
    { id: 'decision', label: '决策工作台', icon: CandlestickChart },
    { id: 'quant', label: '量化影子盘', icon: Orbit },
    { id: 'market', label: '市场洞察', icon: BarChart3 },
    { id: 'news', label: '实时资讯', icon: Newspaper },
    { id: 'creators', label: '博主观点', icon: MessageSquareQuote },
  ];
  const currentView = navigation.find((item) => item.id === activeView)!;
  const descriptions: Record<WorkspaceView, string> = {
    decision: '从实时行情，到每一个决策细节',
    quant: '追踪策略运行、信号与持仓表现',
    market: '梳理市场主线，发现板块变化',
    news: '聚焦市场资讯与事件影响',
    creators: '读懂关键判断，追踪验证结果',
  };

  return (
    <header className="terminal-header studio-header">
      <aside className="studio-sidebar" aria-label="工作空间导航">
        <div className="terminal-brand">
          <div className="brand-mark"><Activity size={20} /></div>
          <div><strong>Alpha Desk</strong><span>投研工作空间</span></div>
        </div>
        <span className="studio-nav-label">工作空间</span>
        <SelectionGroup><nav className="terminal-nav" aria-label="主导航">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                ref={activeView === item.id ? activeNavigationRef : undefined}
                aria-current={activeView === item.id ? 'page' : undefined}
                className={activeView === item.id ? 'is-active' : ''}
                onClick={() => onViewChange(item.id)}
              >
                <Icon size={19} /><span>{item.label}</span><ArrowUpRight size={14} className="studio-nav-arrow" aria-hidden="true" />
                <SelectionIndicator active={activeView === item.id} />
              </button>
            );
          })}
        </nav></SelectionGroup>
        <div className="studio-sidebar-footer">
          <span><Activity size={14} />A 股市场研究</span>
          <p>行情 · 策略 · 洞察</p>
        </div>
      </aside>
      <div className="terminal-topbar">
        <div className="studio-view-heading"><span>工作空间 <i>/</i> {currentView.label}</span><strong>{descriptions[activeView]}</strong></div>
        <div className="terminal-actions">
          {onOpenPanorama && <button type="button" className="studio-panorama-trigger" onClick={onOpenPanorama} aria-label="打开活跃股速览" title="比较成交额前 50 只股票的涨跌、排名，一键进入 K 线"><BarChart3 size={17} /><span>活跃股速览</span></button>}
          {onOpenCommands && <button type="button" className="studio-command-trigger" onClick={onOpenCommands} aria-label="打开指令中心" aria-keyshortcuts="Control+k Meta+k" title="指令中心（Ctrl / ⌘ + K）"><Search size={17} /><span>快速查找</span><kbd>⌘ / Ctrl K</kbd></button>}
          <button type="button" className="studio-theme-toggle" onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            toggleAppearance({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
          }} aria-label={appearance === 'light' ? '切换深色模式' : '切换浅色模式'} title={appearance === 'light' ? '切换深色模式' : '切换浅色模式'}>
            {appearance === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <div className={`api-state ${dataDelayed || indicesError ? 'is-error' : ''}`}>
            <Radio size={13} />
            <span>
              {indicesLoading && !hasRealtimeData
                ? '连接中'
                : dataDelayed || indicesError
                  ? '数据延迟'
                  : '数据在线'}
              </span>
          </div>
        </div>
      </div>

      {activeView === 'decision' && <div className="market-index-strip">
        <div className="market-session">
          <span>
            行情数据日期
            {realtimeIndices && <em>{marketStatusLabel(realtimeIndices.marketStatus)}</em>}
          </span>
          <strong>{realtimeIndices?.tradingDate || tradeDate || '--'}</strong>
          <small className={dataDelayed || indicesError ? 'is-delayed' : ''}>
            {indexSummary}
          </small>
        </div>
        <div className="index-ticker-list terminal-scroll-x">
          {indicesLoading && !hasRealtimeData && Array.from({ length: 5 }).map((_, index) => (
            <div className="index-ticker is-skeleton" key={index}><span /><b /><small /></div>
          ))}
          {!(indicesLoading && !hasRealtimeData) && realtimeIndices && !hasRealtimeData && !indicesError && (
            <div className="index-message">暂无指数行情</div>
          )}
          {!(indicesLoading && !hasRealtimeData) && (hasRealtimeData || indicesError) && orderedIndices.map((item) => {
            const quote = item.quote;
            if (!quote) {
              return (
                <div className="index-ticker is-unavailable" key={item.symbol}>
                  <span>{item.name}<small>{item.symbol}</small></span>
                  <b>--</b>
                  <em>{indicesError ? '行情暂不可用' : '暂无数据'}</em>
                </div>
              );
            }
            const tone = quoteTone(quote.change, quote.changePercent);
            return (
              <div
                className={`index-ticker is-${tone}`}
                key={quote.symbol}
                title={quote.sourceTime ? `行情时间 ${formatShanghaiTime(quote.sourceTime)}` : undefined}
              >
                <span>{quote.name || item.name}<small>{quote.symbol}</small></span>
                <b>{formatNumber(quote.price)}</b>
                <em>{formatSigned(quote.change)} · {formatSigned(quote.changePercent, '%')}</em>
              </div>
            );
          })}
        </div>
      </div>}
    </header>
  );
}

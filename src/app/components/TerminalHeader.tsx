import {
  Activity,
  BarChart3,
  CandlestickChart,
  MessageSquareQuote,
  Newspaper,
  Radio,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { RealtimeMarketIndicesResponse } from '../lib/api';
import {
  formatShanghaiTime,
  marketStatusLabel,
  orderMarketIndices,
  quoteTone,
} from '../lib/realtime-format';

export type WorkspaceView = 'decision' | 'market' | 'news' | 'creators';

interface TerminalHeaderProps {
  activeView: WorkspaceView;
  tradeDate?: string;
  realtimeIndices: RealtimeMarketIndicesResponse | null;
  indicesLoading: boolean;
  indicesDelayed: boolean;
  indicesError: string | null;
  onViewChange: (view: WorkspaceView) => void;
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
}: TerminalHeaderProps) {
  const orderedIndices = orderMarketIndices(realtimeIndices?.items ?? []);
  const hasRealtimeData = (realtimeIndices?.items.length ?? 0) > 0;
  const updatedTime = formatShanghaiTime(realtimeIndices?.updatedAt ?? '');
  const navigation: Array<{ id: WorkspaceView; label: string; icon: typeof Activity }> = [
    { id: 'decision', label: '决策工作台', icon: CandlestickChart },
    { id: 'market', label: '市场洞察', icon: BarChart3 },
    { id: 'news', label: '实时资讯', icon: Newspaper },
    { id: 'creators', label: '博主观点', icon: MessageSquareQuote },
  ];

  return (
    <header className="terminal-header">
      <div className="terminal-topbar">
        <div className="terminal-brand">
          <div className="brand-mark"><Activity size={20} /></div>
          <div><strong>ALPHA DESK</strong><span>A 股智能决策终端</span></div>
        </div>

        <nav className="terminal-nav" aria-label="主导航">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeView === item.id ? 'is-active' : ''}
                onClick={() => onViewChange(item.id)}
              >
                <Icon size={15} />{item.label}
              </button>
            );
          })}
        </nav>

        <div className="terminal-actions">
          <div className="terminal-search-hint"><Search size={14} /><span>股票 / 板块</span><kbd>⌘ K</kbd></div>
          <div className={`api-state ${indicesDelayed || indicesError ? 'is-error' : ''}`}>
            <Radio size={13} />
            <span>
              {indicesLoading && !hasRealtimeData
                ? '连接中'
                : indicesDelayed || indicesError
                  ? '数据延迟'
                  : '数据在线'}
            </span>
          </div>
          <button className="icon-button" aria-label="终端设置"><Settings size={16} /></button>
        </div>
      </div>

      <div className="market-index-strip">
        <div className="market-session">
          <span>
            <Sparkles size={13} />大盘指数
            {realtimeIndices && <em>{marketStatusLabel(realtimeIndices.marketStatus)}</em>}
          </span>
          <strong>{realtimeIndices?.tradingDate || tradeDate || '--'}</strong>
          <small className={indicesDelayed || indicesError ? 'is-delayed' : ''}>
            {indicesDelayed && hasRealtimeData
              ? `数据可能延迟 · 更新 ${updatedTime}`
              : indicesError && !hasRealtimeData
                ? '行情暂不可用'
                : realtimeIndices
                  ? `更新 ${updatedTime}`
                  : '等待指数行情'}
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
      </div>
    </header>
  );
}

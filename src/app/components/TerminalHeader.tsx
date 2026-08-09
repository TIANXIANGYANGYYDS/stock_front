import {
  Activity,
  BarChart3,
  CandlestickChart,
  Newspaper,
  Radio,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';

export type WorkspaceView = 'decision' | 'market' | 'news';

interface TerminalHeaderProps {
  activeView: WorkspaceView;
  tradeDate?: string;
  updatedAt?: string;
  marketLoading: boolean;
  marketError: string | null;
  onViewChange: (view: WorkspaceView) => void;
}

const MARKET_INDICES = [
  { name: '上证指数', code: '000001.SH' },
  { name: '深证成指', code: '399001.SZ' },
  { name: '创业板指', code: '399006.SZ' },
  { name: '科创50', code: '000688.SH' },
  { name: '沪深300', code: '000300.SH' },
];

export function TerminalHeader({
  activeView,
  tradeDate,
  updatedAt,
  marketLoading,
  marketError,
  onViewChange,
}: TerminalHeaderProps) {
  const navigation: Array<{ id: WorkspaceView; label: string; icon: typeof Activity }> = [
    { id: 'decision', label: '决策工作台', icon: CandlestickChart },
    { id: 'market', label: '市场洞察', icon: BarChart3 },
    { id: 'news', label: '实时资讯', icon: Newspaper },
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
          <div className={`api-state ${marketError ? 'is-error' : ''}`}>
            <Radio size={13} />
            <span>{marketLoading ? '连接中' : marketError ? '数据离线' : '数据在线'}</span>
          </div>
          <button className="icon-button" aria-label="终端设置"><Settings size={16} /></button>
        </div>
      </div>

      <div className="market-index-strip">
        <div className="market-session">
          <span><Sparkles size={13} />大盘指数</span>
          <strong>{tradeDate || '--'}</strong>
          <small>{updatedAt ? `更新 ${updatedAt.slice(11, 16) || updatedAt}` : 'Stock_Project 指数接口待接入'}</small>
        </div>
        <div className="index-ticker-list terminal-scroll-x">
          {marketLoading && Array.from({ length: 5 }).map((_, index) => (
            <div className="index-ticker is-skeleton" key={index}><span /><b /><small /></div>
          ))}
          {!marketLoading && MARKET_INDICES.map((item) => (
            <div className="index-ticker is-unavailable" key={item.code}>
              <span>{item.name}<small>{item.code}</small></span>
              <b>--</b>
              <em className={marketError ? 'market-rise' : ''}>{marketError ? '数据不可用' : '接口待接入'}</em>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

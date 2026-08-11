import { Database, Search, Waves } from 'lucide-react';
import type { StockListItem } from '../../lib/api';

interface StockNavigatorProps {
  items: StockListItem[];
  query: string;
  selectedCode: string;
  loading: boolean;
  error: string | null;
  missingCodes: string[];
  realtimeDelayed: boolean;
  realtimeError: string | null;
  onQueryChange: (query: string) => void;
  onSelect: (code: string) => void;
}

function formatPrice(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '--' : value.toFixed(2);
}

export function StockNavigator({
  items,
  query,
  selectedCode,
  loading,
  error,
  missingCodes,
  realtimeDelayed,
  realtimeError,
  onQueryChange,
  onSelect,
}: StockNavigatorProps) {
  return (
    <aside className="terminal-panel stock-navigator">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow"><Waves size={12} /> STOCK NAVIGATOR</span>
          <h2>股票导航</h2>
        </div>
        <span className={`data-live${realtimeDelayed || realtimeError ? ' is-delayed' : ''}`}>
          <i />{realtimeDelayed || realtimeError ? '实时行情延迟' : '实时查询'}
        </span>
      </div>

      <label className="stock-search-field">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="输入股票代码或名称"
          aria-label="搜索股票"
        />
      </label>

      <div className="stock-list-caption">
        <span><Database size={12} />{query.trim() ? '搜索结果' : '成交活跃股票'}</span>
        <small>{loading ? '查询中' : `${items.length} 只`}</small>
      </div>

      <div className="navigator-stock-list terminal-scroll">
        {loading && items.length === 0 && (
          <div className="radar-placeholder"><span className="loading-pulse" />正在查询股票...</div>
        )}
        {error && items.length > 0 && (
          <div className="radar-placeholder is-error">查询失败，保留上次结果</div>
        )}
        {realtimeError && items.length > 0 && (
          <div className="radar-placeholder is-error realtime-stock-warning">{realtimeError}</div>
        )}
        {!loading && error && items.length === 0 && <div className="radar-placeholder is-error">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="radar-placeholder">没有找到符合条件的股票</div>
        )}
        {items.map((stock) => {
          const isUp = (stock.changePercent ?? 0) >= 0;
          const realtimeMissing = missingCodes.includes(stock.code);
          return (
            <button
              type="button"
              key={stock.code}
              className={`navigator-stock-row${selectedCode === stock.code ? ' is-active' : ''}${realtimeMissing ? ' is-realtime-missing' : ''}`}
              onClick={() => onSelect(stock.code)}
            >
              <span className="stock-name-code"><strong>{stock.name}</strong><small>{stock.code}</small></span>
              <span className="stock-list-price">
                <b>{formatPrice(stock.close)}</b>
                <small className={isUp ? 'market-rise' : 'market-fall'}>
                  {stock.changePercent === null
                    ? '--'
                    : `${stock.changePercent > 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`}
                </small>
              </span>
              <span className="stock-date-tag">
                {realtimeMissing ? '日线回退' : stock.tradeDate ? stock.tradeDate.slice(5) : '--'}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

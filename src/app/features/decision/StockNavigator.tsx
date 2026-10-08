import { useEffect, useRef } from 'react';
import { Database, Search, Waves, X } from 'lucide-react';
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
  onRetry?: () => void;
  onPrefetch?: (code: string, signal: AbortSignal) => void;
}

function formatPrice(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '--' : value.toFixed(2);
}

function changeTone(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) return 'market-flat';
  return value > 0 ? 'market-rise' : 'market-fall';
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
  onRetry,
  onPrefetch,
}: StockNavigatorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prefetchRef = useRef<{ code: string; timer: number; controller: AbortController } | null>(null);
  const cancelPrefetch = () => {
    if (!prefetchRef.current) return;
    window.clearTimeout(prefetchRef.current.timer);
    prefetchRef.current.controller.abort();
    prefetchRef.current = null;
  };
  const prefetch = (code: string) => {
    // Clicking a hovered row focuses it; keep its in-flight prefetch for the click.
    if (prefetchRef.current?.code === code) return;
    cancelPrefetch();
    if (!onPrefetch || code === selectedCode) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => onPrefetch(code, controller.signal), 120);
    prefetchRef.current = { code, timer, controller };
  };
  useEffect(() => cancelPrefetch, []);
  const clearSearch = () => { onQueryChange(''); inputRef.current?.focus(); };
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
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="输入股票代码或名称"
          aria-label="搜索股票"
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Escape') clearSearch();
            if (event.key === 'Enter' && !loading && !error && items[0]) onSelect(items[0].code);
          }}
        />
        {query && <button type="button" className="search-clear" aria-label="清除股票搜索" onClick={clearSearch}><X size={14} /></button>}
      </label>

      <div className="stock-list-caption">
        <span><Database size={12} />{query.trim() ? '搜索结果' : '成交活跃股票'}</span>
        <small>{loading ? '查询中' : `${items.length} 只`}</small>
      </div>

      <div className="navigator-stock-list terminal-scroll" aria-busy={loading}>
        {loading && items.length === 0 && (
          <div className="radar-placeholder"><span className="loading-pulse" />正在查询股票...</div>
        )}
        {!loading && error && (
          <div className="radar-placeholder is-error workspace-recovery" role="alert">
            <span>{items.length > 0 ? '查询失败，保留上次结果' : error}</span>
            {onRetry && <button type="button" className="terminal-button" onClick={onRetry}>重试</button>}
          </div>
        )}
        {realtimeError && items.length > 0 && (
          <div className="radar-placeholder is-error realtime-stock-warning">{realtimeError}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="radar-placeholder workspace-recovery">
            <span>没有找到符合条件的股票</span>
            {query && <button type="button" className="terminal-button" onClick={clearSearch}>清除搜索</button>}
          </div>
        )}
        {items.map((stock) => {
          const realtimeMissing = missingCodes.includes(stock.code);
          return (
            <button
              type="button"
              key={stock.code}
              className={`navigator-stock-row${selectedCode === stock.code ? ' is-active' : ''}${realtimeMissing ? ' is-realtime-missing' : ''}`}
              onClick={() => onSelect(stock.code)}
              onMouseEnter={() => prefetch(stock.code)}
              onMouseLeave={cancelPrefetch}
              onFocus={() => prefetch(stock.code)}
              onBlur={cancelPrefetch}
              aria-pressed={selectedCode === stock.code}
            >
              <span className="stock-name-code"><strong>{stock.name}</strong><small>{stock.code}</small></span>
              <span className="stock-list-price">
                <b>{formatPrice(stock.close)}</b>
                <small className={changeTone(stock.changePercent)}>
                  {stock.changePercent === null
                    ? '--'
                    : `${stock.changePercent > 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`}
                </small>
              </span>
              <span className="stock-date-tag">
                {realtimeMissing
                  ? '日线回退'
                  : stock.tradeDate
                    ? `${stock.isRealtime ? '实时 ' : ''}${stock.tradeDate.slice(5)}`
                    : '--'}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

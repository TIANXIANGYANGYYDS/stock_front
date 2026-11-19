import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Clock3, Search, X } from 'lucide-react';
import { getNews, getNewsUpdates, type NewsWindowDays, type NewsItem, type Sentiment } from '../../lib/api';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useWorkspaceState } from '../../hooks/useWorkspaceState';
import { SelectionGroup, SelectionIndicator } from '../../components/StudioMotion';
import { NewsArticle, scoreText, sentimentLabel } from './NewsArticle';
import type { NewsSortField, SortDirection } from './news-state';

interface NewsIntelligenceViewProps { tradeDate: string }
const PAGE_SIZE = 100;

export function NewsIntelligenceView({ tradeDate }: NewsIntelligenceViewProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useWorkspaceState('news.selected', '');
  const [search, setSearch] = useWorkspaceState('news.search', '');
  const [sentiment, setSentiment] = useWorkspaceState<Sentiment | null>('news.sentiment', null);
  const [aShareOnly, setAShareOnly] = useWorkspaceState('news.aShareOnly', false);
  const [windowDays, setWindowDays] = useWorkspaceState<NewsWindowDays>('news.window', 1);
  const [sortField, setSortField] = useWorkspaceState<NewsSortField>('news.sort', 'time');
  const [sortDirection, setSortDirection] = useWorkspaceState<SortDirection>('news.direction', 'desc');
  const [page, setPage] = useWorkspaceState('news.page', 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; snapshot?: number }>();
  const [newCount, setNewCount] = useState(0);
  const anchor = useRef<{ key: string; value: number } | null>(null);
  const [reload, setReload] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const compact = useMediaQuery('(max-width: 1125px)');
  const detailRef = useRef<HTMLElement>(null);
  const streamRef = useRef<HTMLElement>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const hasFilters = Boolean(search || sentiment || aShareOnly || windowDays !== 1);
  const keyword = search.trim();
  const queryKey = JSON.stringify([tradeDate, windowDays, keyword, sentiment, aShareOnly]);
  const refresh = () => {
    anchor.current = null;
    setNewCount(0);
    setPage(1);
    setReload(value => value + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetailOpen(false);
    const timer = window.setTimeout(() => {
      void getNews({
        tradeDate, windowDays, search: keyword || undefined, sentiment, aShareOnly,
        sort: `${sortField === 'score' ? 'impact' : 'time'}_${sortDirection}`, page, pageSize: PAGE_SIZE,
        snapshot: anchor.current?.key === queryKey ? anchor.current.value : undefined,
      }, { signal: controller.signal }).then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(1, Math.ceil(response.pagination.total / PAGE_SIZE));
        setTotal(response.pagination.total);
        setLoaded({ key: queryKey, snapshot: response.snapshot });
        if (response.snapshot !== undefined) anchor.current = { key: queryKey, value: response.snapshot };
        if (page > lastPage) setPage(lastPage);
        setItems(response.items);
        setSelectedId((current) => response.items.some((item) => item.id === current) ? current : '');
        if (streamRef.current) streamRef.current.scrollTop = 0;
      }).catch((reason: unknown) => {
        if (cancelled) return;
        setItems([]);
        setError(reason instanceof Error ? reason.message : '资讯加载失败');
      }).finally(() => { if (!cancelled) setLoading(false); });
    }, keyword ? 180 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [keyword, tradeDate, windowDays, sentiment, aShareOnly, sortField, sortDirection, page, reload, queryKey]);

  const snapshot = loaded?.key === queryKey ? loaded.snapshot : undefined;

  // 仅轮询新增数量，读者点提示后才切换快照和阅读位置。
  useEffect(() => {
    setNewCount(0);
    if (snapshot === undefined || anchor.current?.key !== queryKey) return;
    const controller = new AbortController();
    let busy = false;
    async function check() {
      if (document.hidden || busy || controller.signal.aborted || snapshot === undefined) return;
      busy = true;
      try {
        const count = await getNewsUpdates({ tradeDate, windowDays, sentiment, aShareOnly,
          search: keyword || undefined, snapshot }, { signal: controller.signal });
        if (!controller.signal.aborted) setNewCount(count);
      } catch {
        // 临时网络失败时保留已读列表，下次轮询重试。
      } finally { busy = false; }
    }
    const timer = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [snapshot, queryKey, keyword, tradeDate, windowDays, sentiment, aShareOnly]);

  const displayItems = items;
  const selected = items.find(item => item.id === selectedId) ?? items[0] ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = 0;
    setDetailOpen(false);
  }, [page, sentiment, sortField, sortDirection]);

  useEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0;
  }, [selected?.id]);

  const clearSearch = () => { setSearch(''); setPage(1); searchRef.current?.focus(); };
  const clearFilters = () => { setSearch(''); setSentiment(null); setWindowDays(1); setAShareOnly(false); setPage(1); };

  return (
    <main className="news-intelligence-view">
      <div className="news-filter-bar">
        <SelectionGroup><div className="news-window-group" aria-label="资讯时间范围">
          {([{ value: 1, label: '当天' }, { value: 3, label: '3天' }, { value: 7, label: '7天' }] as const).map((option) => (
            <button type="button" key={option.value} aria-pressed={windowDays === option.value}
              className={windowDays === option.value ? 'is-active' : ''}
              onClick={() => { setWindowDays(option.value); setPage(1); }}>{option.label}<SelectionIndicator active={windowDays === option.value} /></button>
          ))}
        </div></SelectionGroup>
        <SelectionGroup><div className="sentiment-filter-group" aria-label="资讯倾向">
          {([{ value: null, label: '全部' }, { value: 'positive', label: '利好' },
            { value: 'neutral', label: '中性' }, { value: 'negative', label: '利空' }] as const).map((option) => (
            <button type="button" key={option.label} aria-pressed={sentiment === option.value}
              className={sentiment === option.value ? 'is-active' : ''}
              onClick={() => { setSentiment(option.value); setPage(1); }}>{option.label}<SelectionIndicator active={sentiment === option.value} /></button>
          ))}
        </div></SelectionGroup>
        <button type="button" className="terminal-button" aria-pressed={aShareOnly}
          onClick={() => { setAShareOnly(!aShareOnly); setPage(1); }}>仅看 A 股相关</button>
        <div className="news-sort-controls">
          <div className="news-sort-field" aria-label="资讯排序字段">
            {(['time', 'score'] as const).map((field) => (
              <button type="button" key={field} aria-pressed={sortField === field}
                className={sortField === field ? 'is-active' : ''}
                onClick={() => { setSortField(field); setPage(1); }}>{field === 'time' ? '按时间' : '按评分'}</button>
            ))}
          </div>
          <div className="news-sort-direction" aria-label="资讯排序方向">
            {(['desc', 'asc'] as const).map((direction) => (
              <button type="button" key={direction} aria-pressed={sortDirection === direction}
                className={sortDirection === direction ? 'is-active' : ''}
                title={sortField === 'time' ? direction === 'desc' ? '最新在前' : '最早在前' : direction === 'desc' ? '高分在前' : '低分在前'}
                onClick={() => { setSortDirection(direction); setPage(1); }}>{direction === 'desc' ? '降序' : '升序'}</button>
            ))}
          </div>
        </div>
        <span className="news-filter-summary">资讯窗口：{windowDays === 1 ? '当天' : `${windowDays}天`} · {sortField === 'time' ? '时间' : '影响分'}{sortDirection === 'asc' ? '升序' : '降序'} · 截至 {tradeDate}</span>
        <label className="news-search-box">
          <Search size={15} />
          <input ref={searchRef} value={search} aria-label="搜索资讯" placeholder="搜索新闻、股票或板块"
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            onKeyDown={(event) => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) clearSearch(); }} />
          {search && <button type="button" className="search-clear" aria-label="清除资讯搜索" onClick={clearSearch}><X size={14} /></button>}
        </label>
        {hasFilters && <button type="button" className="terminal-button" onClick={clearFilters}>清除筛选</button>}
      </div>

      <div className="news-split-layout">
        <section ref={streamRef} className="terminal-panel news-stream terminal-scroll" aria-busy={loading}>
          <div className="news-stream-head">
            <span>资讯流</span>
            <div className="news-stream-actions">
              {newCount > 0 && !loading && <button type="button" className="terminal-button"
                onClick={refresh}>有 {newCount} 条新资讯 · 查看</button>}
              <small>{loading ? '更新中' : error ? '加载失败' : `共 ${total} 条`}</small>
              <button type="button" className="terminal-button" disabled={loading} onClick={refresh}>刷新资讯</button>
            </div>
          </div>
          {loading && <div className="terminal-empty" role="status"><span className="loading-pulse" />正在加载资讯...</div>}
          {!loading && error && (
            <div className="terminal-empty is-error workspace-recovery" role="alert">
              <span>{error}</span><button type="button" className="terminal-button" onClick={() => setReload((value) => value + 1)}>重试</button>
            </div>
          )}
          {!loading && !error && total === 0 && (
            <div className="terminal-empty workspace-recovery">
              <span>该交易日暂无符合条件的资讯</span>
              {hasFilters && <button type="button" className="terminal-button" onClick={clearFilters}>清除筛选</button>}
            </div>
          )}
          {!loading && !error && displayItems.map((item) => (
            <button type="button" key={item.id} aria-pressed={selected?.id === item.id}
              className={`news-stream-item ${selected?.id === item.id ? 'is-active' : ''}`}
              onClick={(event) => { detailTrigger.current = event.currentTarget; setSelectedId(item.id); setDetailOpen(true); }}>
              <div className="news-item-meta">
                <span><Clock3 size={11} />{item.time || item.publishTime || '--'}</span><span>{item.source}</span>
                <span className={`sentiment-pill sentiment-${item.sentiment}`}>{sentimentLabel(item)}</span>
                {item.impact !== null && <b className={item.impact > 0 ? 'market-rise' : item.impact < 0 ? 'market-fall' : ''}>{scoreText(item.impact)}</b>}
              </div>
              <h3>{item.title}</h3><p>{item.summary}</p>
              {(item.relatedSectors?.length ?? 0) > 0 && (
                <div className="news-item-sectors">{item.relatedSectors?.slice(0, 3).map((sector) => <span key={sector}>{sector}</span>)}</div>
              )}
            </button>
          ))}
          {!error && totalPages > 1 && (
            <nav className="news-pagination" aria-label="资讯分页">
              <button type="button" className="terminal-button" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
              <span>{page} / {totalPages}</span>
              <button type="button" className="terminal-button" disabled={loading || page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
            </nav>
          )}
        </section>

        {compact ? (
          <Dialog.Root open={detailOpen && Boolean(selected) && !loading} onOpenChange={setDetailOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="news-detail-overlay" />
              <Dialog.Content className="news-detail-dialog" onCloseAutoFocus={(event) => { event.preventDefault(); detailTrigger.current?.focus(); }}>
                <Dialog.Title className="sr-only">资讯详情</Dialog.Title>
                <Dialog.Description className="sr-only">所选资讯的正文、影响分析和关联标的</Dialog.Description>
                <Dialog.Close className="news-detail-back"><ArrowLeft size={16} />返回资讯列表</Dialog.Close>
                <article className="news-detail terminal-scroll">{selected && <NewsArticle item={selected} />}</article>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        ) : (
          <article ref={detailRef} className="terminal-panel news-detail terminal-scroll" aria-busy={loading}>
            {loading ? <div className="terminal-empty">正在更新资讯...</div> : selected && !error
              ? <NewsArticle item={selected} />
              : <div className="terminal-empty">从左侧选择一条资讯查看详情</div>}
          </article>
        )}
      </div>
    </main>
  );
}

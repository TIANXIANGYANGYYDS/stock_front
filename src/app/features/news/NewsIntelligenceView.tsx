import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Clock3,
  Newspaper,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react';
import {
  getNews,
  type NewsWindowDays,
  type NewsItem,
  type Sentiment,
} from '../../lib/api';
import { sortNews, type NewsSortField, type SortDirection } from './news-state';

interface NewsIntelligenceViewProps {
  tradeDate: string;
}

function sentimentLabel(sentiment: Sentiment): string {
  if (sentiment === 'positive') return '利好';
  if (sentiment === 'negative') return '利空';
  return '中性';
}

function scoreText(score: number): string {
  return `${score > 0 ? '+' : ''}${score.toFixed(0)}`;
}

export function NewsIntelligenceView({ tradeDate }: NewsIntelligenceViewProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [windowDays, setWindowDays] = useState<NewsWindowDays>(1);
  const [sortField, setSortField] = useState<NewsSortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void getNews({
        tradeDate,
        windowDays,
        search: search.trim() || undefined,
        sentiment,
        page: 1,
        pageSize: 100,
      })
        .then((response) => {
          if (cancelled) return;
          setItems(response.items);
          setSelectedId((current) =>
            response.items.some((item) => item.id === current) ? current : '',
          );
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setItems([]);
          setSelectedId('');
          setError(reason instanceof Error ? reason.message : '资讯加载失败');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, sentiment, tradeDate, windowDays]);

  const displayItems = useMemo(
    () => sortNews(items, sortField, sortDirection),
    [items, sortDirection, sortField],
  );
  const effectiveSelectedId = displayItems.some((item) => item.id === selectedId)
    ? selectedId
    : displayItems[0]?.id || '';

  const selected = useMemo(
    () => displayItems.find((item) => item.id === effectiveSelectedId) ?? null,
    [displayItems, effectiveSelectedId],
  );
  const windowLabel = windowDays === 1 ? '当天' : `${windowDays}天`;
  const sortLabel = sortField === 'time' ? '时间' : '影响分';
  const directionLabel = sortDirection === 'asc' ? '升序' : '降序';

  return (
    <main className="news-intelligence-view">
      <section className="view-heading news-view-heading">
        <div>
          <span className="eyebrow"><Newspaper size={12} /> NEWS INTELLIGENCE</span>
          <h1>实时资讯</h1>
          <p>跟踪 {tradeDate} 的事件冲击、市场情绪与关联股票板块</p>
        </div>
        <div className="news-search-box">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索新闻、股票或板块" />
        </div>
      </section>

      <div className="news-filter-bar">
        <div className="news-window-group" aria-label="资讯时间范围">
          {([{ value: 1, label: '当天' }, { value: 3, label: '3天' }, { value: 7, label: '7天' }] as const).map((option) => (
            <button
              type="button"
              key={option.value}
              className={windowDays === option.value ? 'is-active' : ''}
              onClick={() => setWindowDays(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="sentiment-filter-group">
          {([
            { value: null, label: '全部' },
            { value: 'positive', label: '利好' },
            { value: 'neutral', label: '中性' },
            { value: 'negative', label: '利空' },
          ] as Array<{ value: Sentiment | null; label: string }>).map((option) => (
            <button
              key={option.label}
              className={sentiment === option.value ? 'is-active' : ''}
              onClick={() => setSentiment(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="news-sort-controls">
          <div className="news-sort-field">
            <button className={sortField === 'time' ? 'is-active' : ''} onClick={() => setSortField('time')}>按时间</button>
            <button className={sortField === 'score' ? 'is-active' : ''} onClick={() => setSortField('score')}>按评分</button>
          </div>
          <div className="news-sort-direction">
            <button className={sortDirection === 'desc' ? 'is-active' : ''} onClick={() => setSortDirection('desc')}>降序</button>
            <button className={sortDirection === 'asc' ? 'is-active' : ''} onClick={() => setSortDirection('asc')}>升序</button>
          </div>
        </div>
        <span className="news-filter-summary">资讯窗口：{windowLabel} · {sortLabel}{directionLabel}</span>
      </div>

      <div className="news-split-layout">
        <section className="terminal-panel news-stream terminal-scroll">
          <div className="news-stream-head">
            <span>资讯流</span>
            <small>{loading ? '更新中' : `${displayItems.length} 条`}</small>
          </div>
          {loading && <div className="terminal-empty"><span className="loading-pulse" />正在加载资讯...</div>}
          {!loading && error && <div className="terminal-empty is-error">{error}</div>}
          {!loading && !error && items.length === 0 && <div className="terminal-empty">该交易日暂无符合条件的资讯</div>}
          {!loading && displayItems.map((item) => (
            <button
              key={item.id}
              className={`news-stream-item ${effectiveSelectedId === item.id ? 'is-active' : ''}`}
              onClick={() => setSelectedId(item.id)}
            >
              <div className="news-item-meta">
                <span><Clock3 size={11} />{item.time || item.publishTime || '--'}</span>
                <span>{item.source}</span>
                <span className={`sentiment-pill sentiment-${item.sentiment}`}>{sentimentLabel(item.sentiment)}</span>
                <b className={item.impact >= 0 ? 'market-rise' : 'market-fall'}>{scoreText(item.impact)}</b>
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              {(item.relatedSectors?.length ?? 0) > 0 && (
                <div className="news-item-sectors">
                  {item.relatedSectors?.slice(0, 3).map((sector) => <span key={sector}>{sector}</span>)}
                </div>
              )}
            </button>
          ))}
        </section>

        <article className="terminal-panel news-detail terminal-scroll">
          {!selected ? (
            <div className="terminal-empty">从左侧选择一条资讯查看详情</div>
          ) : (
            <>
              <header className="news-detail-head">
                <div className="news-detail-meta">
                  <span>{selected.source}</span>
                  <span>{selected.publishTime || selected.time}</span>
                  <span className={`sentiment-pill sentiment-${selected.sentiment}`}>
                    {sentimentLabel(selected.sentiment)} {scoreText(selected.impact)}
                  </span>
                </div>
                <h2>{selected.title}</h2>
              </header>

              <section className="news-detail-section news-content"><p>{selected.content}</p></section>

              {selected.analysisReason && (
                <section className="news-detail-section ai-analysis-block">
                  <h3><Sparkles size={14} />AI 影响分析</h3>
                  <p>{selected.analysisReason}</p>
                </section>
              )}

              {selected.keyPoints.length > 0 && (
                <section className="news-detail-section">
                  <h3><Tag size={14} />关键要点</h3>
                  <ul className="news-key-points">
                    {selected.keyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}
                  </ul>
                </section>
              )}

              {(selected.relatedStocks.length > 0 || (selected.relatedSectors?.length ?? 0) > 0) && (
                <section className="news-detail-section relation-block">
                  <h3><Building2 size={14} />关联标的</h3>
                  <div className="relation-chips">
                    {selected.relatedStocks.map((stock) => <span key={`stock-${stock}`}>{stock}</span>)}
                    {selected.relatedSectors?.map((sector) => <span key={`sector-${sector}`}>{sector}</span>)}
                  </div>
                </section>
              )}
            </>
          )}
        </article>
      </div>
    </main>
  );
}

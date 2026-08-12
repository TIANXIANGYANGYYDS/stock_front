import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Database,
  ListChecks,
  RotateCcw,
  Search,
  Timer,
  UsersRound,
} from 'lucide-react';
import {
  getCreatorAccounts,
  getCreatorOpinionAnalyses,
  getCreatorWorkDetail,
  getCreatorWorks,
  type CreatorAccount,
  type CreatorOpinionAnalysis,
  type CreatorWorkDetail,
  type CreatorWorkFilters,
  type CreatorWorkSummary,
} from '../../lib/api';
import { CreatorRankingPanel } from './CreatorRankingPanel';
import { CreatorWorkDetailPanel } from './CreatorWorkDetail';
import { CreatorWorkStream } from './CreatorWorkStream';
import {
  appendUniqueWorks,
  buildCreatorRankingItems,
  creatorTimeRange,
  filterWorksByDirection,
  type CreatorDirectionFilter,
  type CreatorTimeWindow,
} from './creator-opinion-state';

const PAGE_SIZE = 24;

const TIME_WINDOWS: Array<{ value: CreatorTimeWindow; label: string }> = [
  { value: '24h', label: '24小时' },
  { value: '3d', label: '3天' },
  { value: '7d', label: '7天' },
  { value: 'all', label: '全部' },
];

const DIRECTIONS: Array<{ value: CreatorDirectionFilter; label: string }> = [
  { value: 'all', label: '全部方向' },
  { value: 'bullish', label: '看多' },
  { value: 'bearish', label: '看空' },
  { value: 'neutral', label: '中性' },
];

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function CreatorInsightsView() {
  const [accounts, setAccounts] = useState<CreatorAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [analyses, setAnalyses] = useState<CreatorOpinionAnalysis[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [rankingReload, setRankingReload] = useState(0);

  const [works, setWorks] = useState<CreatorWorkSummary[]>([]);
  const [worksTotal, setWorksTotal] = useState(0);
  const [allWorksTotal, setAllWorksTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [worksLoading, setWorksLoading] = useState(true);
  const [worksLoadingMore, setWorksLoadingMore] = useState(false);
  const [worksError, setWorksError] = useState<string | null>(null);
  const [worksReload, setWorksReload] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [timeWindow, setTimeWindow] = useState<CreatorTimeWindow>('all');
  const [direction, setDirection] = useState<CreatorDirectionFilter>('all');
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [selectedWorkKey, setSelectedWorkKey] = useState('');
  const [mobileSection, setMobileSection] = useState<'ranking' | 'works'>('works');

  const [detail, setDetail] = useState<CreatorWorkDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReload, setDetailReload] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [inlineDetail, setInlineDetail] = useState(() => (
    typeof window.matchMedia !== 'function'
      || window.matchMedia('(min-width: 1281px)').matches
  ));
  const detailCache = useRef(new Map<string, CreatorWorkDetail>());
  const worksRequestGeneration = useRef(0);
  const detailTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(min-width: 1281px)');
    const updateLayout = () => setInlineDetail(query.matches);
    updateLayout();
    query.addEventListener?.('change', updateLayout);
    return () => query.removeEventListener?.('change', updateLayout);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAccountsLoading(true);
    void getCreatorAccounts()
      .then((items) => {
        if (!cancelled) setAccounts(items);
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRankingLoading(true);
    setRankingError(null);
    void getCreatorOpinionAnalyses()
      .then((items) => {
        if (!cancelled) setAnalyses(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAnalyses([]);
          setRankingError(errorText(error, '博主评分排行加载失败'));
        }
      })
      .finally(() => {
        if (!cancelled) setRankingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rankingReload]);

  const currentWorkFilters = useCallback((requestedPage: number): CreatorWorkFilters => ({
    creatorId: selectedCreatorId || undefined,
    platform: platform || undefined,
    keyword: debouncedSearch || undefined,
    ...creatorTimeRange(timeWindow),
    page: requestedPage,
    pageSize: PAGE_SIZE,
  }), [debouncedSearch, platform, selectedCreatorId, timeWindow]);

  useEffect(() => {
    let cancelled = false;
    const requestGeneration = ++worksRequestGeneration.current;
    setWorksLoading(true);
    setWorksLoadingMore(false);
    setWorksError(null);
    setSelectedWorkKey('');
    setDetail(null);

    void getCreatorWorks(currentWorkFilters(1))
      .then((response) => {
        if (cancelled || requestGeneration !== worksRequestGeneration.current) return;
        setWorks(response.items);
        setWorksTotal(response.total);
        setPage(1);
        const isUnfiltered = !selectedCreatorId
          && !platform
          && !debouncedSearch
          && timeWindow === 'all';
        if (isUnfiltered) setAllWorksTotal(response.total);
      })
      .catch((error: unknown) => {
        if (cancelled || requestGeneration !== worksRequestGeneration.current) return;
        setWorks([]);
        setWorksTotal(0);
        setWorksError(errorText(error, '博主观点加载失败'));
      })
      .finally(() => {
        if (!cancelled && requestGeneration === worksRequestGeneration.current) {
          setWorksLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentWorkFilters,
    debouncedSearch,
    platform,
    selectedCreatorId,
    timeWindow,
    worksReload,
  ]);

  const rankingItems = useMemo(
    () => buildCreatorRankingItems(analyses),
    [analyses],
  );
  const visibleWorks = useMemo(
    () => filterWorksByDirection(works, direction),
    [direction, works],
  );

  useEffect(() => {
    if (visibleWorks.length === 0) {
      setSelectedWorkKey('');
      setDetail(null);
      return;
    }
    if (!visibleWorks.some((work) => work.workKey === selectedWorkKey)) {
      setSelectedWorkKey(visibleWorks[0].workKey);
      setDetailOpen(inlineDetail);
    }
  }, [inlineDetail, selectedWorkKey, visibleWorks]);

  useEffect(() => {
    if (!selectedWorkKey) {
      setDetail(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }
    const cached = detailCache.current.get(selectedWorkKey);
    if (cached) {
      setDetail(cached);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void getCreatorWorkDetail(selectedWorkKey)
      .then((item) => {
        if (cancelled) return;
        detailCache.current.set(selectedWorkKey, item);
        setDetail(item);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailError(errorText(error, '作品详情加载失败'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailReload, selectedWorkKey]);

  const selectedSummary = works.find((item) => item.workKey === selectedWorkKey);
  const selectedAnalysis = analyses.find(
    (item) => item.creatorId === (detail?.creatorId || selectedSummary?.creatorId),
  ) ?? null;
  const scoredCreatorCount = analyses.filter((item) => item.accuracyScore !== null).length;
  const pendingOpinionCount = analyses.reduce(
    (total, item) => total + item.pendingOpinions.length,
    0,
  );
  const platforms = [...new Set(accounts.map((item) => item.platform).filter(Boolean))].sort();
  const hasMore = works.length < worksTotal;

  const handleCreatorSelect = (creatorId: string) => {
    setSelectedCreatorId((current) => current === creatorId ? '' : creatorId);
    setSelectedWorkKey('');
    setMobileSection('works');
  };

  const handleWorkSelect = (workKey: string) => {
    detailTrigger.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSelectedWorkKey(workKey);
    setDetailOpen(true);
  };

  const handleLoadMore = async () => {
    if (worksLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    const requestGeneration = worksRequestGeneration.current;
    setWorksLoadingMore(true);
    try {
      const response = await getCreatorWorks(currentWorkFilters(nextPage));
      if (requestGeneration !== worksRequestGeneration.current) return;
      setWorks((current) => appendUniqueWorks(current, response.items));
      setWorksTotal(response.total);
      setPage(nextPage);
    } catch (error: unknown) {
      if (requestGeneration !== worksRequestGeneration.current) return;
      setWorksError(errorText(error, '更多观点加载失败'));
    } finally {
      if (requestGeneration === worksRequestGeneration.current) {
        setWorksLoadingMore(false);
      }
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setPlatform('');
    setTimeWindow('all');
    setDirection('all');
    setSelectedCreatorId('');
  };

  const detailPanel = (
    <CreatorWorkDetailPanel
      work={detail}
      creatorAnalysis={selectedAnalysis}
      loading={detailLoading}
      error={detailError}
      onRetry={() => {
        if (selectedWorkKey) detailCache.current.delete(selectedWorkKey);
        setDetailReload((value) => value + 1);
      }}
      onClose={() => setDetailOpen(false)}
    />
  );

  return (
    <main className="creator-insights-view">
      <section className="creator-overview-grid" aria-label="博主观点概览">
        <div className="terminal-panel creator-overview-card">
          <UsersRound size={15} /><span>监控博主</span><b>{accountsLoading ? '--' : accounts.length}</b>
        </div>
        <div className="terminal-panel creator-overview-card">
          <Database size={15} /><span>A股相关作品</span><b>{allWorksTotal ?? worksTotal}</b>
        </div>
        <div className="terminal-panel creator-overview-card">
          <ListChecks size={15} /><span>已评分博主</span><b>{rankingLoading ? '--' : scoredCreatorCount}</b>
        </div>
        <div className="terminal-panel creator-overview-card">
          <Timer size={15} /><span>等待验证观点</span><b>{rankingLoading ? '--' : pendingOpinionCount}</b>
        </div>
      </section>

      <section className="creator-filter-bar terminal-panel">
        <label className="creator-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索作品、观点或标的"
          />
        </label>
        <div className="creator-filter-buttons" aria-label="发布时间">
          {TIME_WINDOWS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={timeWindow === option.value ? 'is-active' : ''}
              onClick={() => setTimeWindow(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="creator-platform-select">
          <span>平台</span>
          <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="">全部平台</option>
            {platforms.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
          </select>
        </label>
        <div className="creator-filter-buttons" aria-label="观点方向">
          {DIRECTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={direction === option.value ? 'is-active' : ''}
              onClick={() => setDirection(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className="creator-clear-filters" onClick={clearFilters}>
          <RotateCcw size={12} />清除筛选
        </button>
      </section>

      <div className="creator-mobile-switch" aria-label="博主观点页面区域">
        <button
          type="button"
          className={mobileSection === 'ranking' ? 'is-active' : ''}
          onClick={() => setMobileSection('ranking')}
        >
          评分排行
        </button>
        <button
          type="button"
          className={mobileSection === 'works' ? 'is-active' : ''}
          onClick={() => setMobileSection('works')}
        >
          最新观点
        </button>
      </div>

      <div className={'creator-workspace-grid mobile-' + mobileSection + (detailOpen ? ' has-open-detail' : '')}>
        <CreatorRankingPanel
          items={rankingItems}
          accounts={accounts}
          selectedCreatorId={selectedCreatorId}
          loading={rankingLoading}
          error={rankingError}
          onSelect={handleCreatorSelect}
          onRetry={() => setRankingReload((value) => value + 1)}
        />
        <CreatorWorkStream
          items={visibleWorks}
          selectedWorkKey={selectedWorkKey}
          loading={worksLoading}
          loadingMore={worksLoadingMore}
          error={worksError}
          total={worksTotal}
          hasMore={hasMore}
          directionFilter={direction}
          onSelect={handleWorkSelect}
          onLoadMore={() => void handleLoadMore()}
          onClearFilters={clearFilters}
          onRetry={() => setWorksReload((value) => value + 1)}
        />
        {inlineDetail ? (
          <div className="creator-detail-shell is-open">{detailPanel}</div>
        ) : (
          <DialogPrimitive.Root open={detailOpen} onOpenChange={setDetailOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="creator-detail-overlay" />
              <DialogPrimitive.Content
                className="creator-detail-shell is-open"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  detailTrigger.current?.focus();
                }}
              >
                <DialogPrimitive.Title className="sr-only">
                  作品与观点详情
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  查看所选博主作品的观点分析、验证结果与原始内容
                </DialogPrimitive.Description>
                {detailPanel}
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        )}
      </div>
    </main>
  );
}

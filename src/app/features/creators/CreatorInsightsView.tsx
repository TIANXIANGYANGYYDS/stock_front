import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  PanelLeft,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useWorkspaceState } from '../../hooks/useWorkspaceState';
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
import { AnimatedDisclosure, SelectionGroup, SelectionIndicator } from '../../components/StudioMotion';
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

  const [search, setSearch] = useWorkspaceState('creators.search', '');
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());
  const [platform, setPlatform] = useWorkspaceState('creators.platform', '');
  const [timeWindow, setTimeWindow] = useWorkspaceState<CreatorTimeWindow>('creators.window', 'all');
  const [direction, setDirection] = useWorkspaceState<CreatorDirectionFilter>('creators.direction', 'all');
  const [selectedCreatorId, setSelectedCreatorId] = useWorkspaceState('creators.selected', '');
  const [selectedWorkKey, setSelectedWorkKey] = useState('');
  const [directoryTab, setDirectoryTab] = useState<'ranking' | 'works'>('works');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [detail, setDetail] = useState<CreatorWorkDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReload, setDetailReload] = useState(0);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [inlineDirectory, setInlineDirectory] = useState(() => (
    typeof window.matchMedia !== 'function'
      || window.matchMedia('(min-width: 960px)').matches
  ));
  const detailCache = useRef(new Map<string, CreatorWorkDetail>());
  const worksRequestGeneration = useRef(0);
  const directoryTrigger = useRef<HTMLElement | null>(null);
  const readingRef = useRef<HTMLDivElement>(null);
  const focusReadingOnClose = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(min-width: 960px)');
    const updateLayout = () => {
      setInlineDirectory(query.matches);
      if (query.matches) setDirectoryOpen(false);
    };
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
    if (worksLoading) return;
    if (visibleWorks.length === 0) {
      setSelectedWorkKey('');
      setDetail(null);
      return;
    }
    if (!visibleWorks.some((work) => work.workKey === selectedWorkKey)) {
      setSelectedWorkKey(visibleWorks[0].workKey);
    }
  }, [selectedWorkKey, visibleWorks, worksLoading]);

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
    setDetail(null);
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
    (item) => item.creatorId === (selectedSummary?.creatorId || detail?.creatorId),
  ) ?? null;
  const scoredCreatorCount = analyses.filter((item) => item.accuracyScore !== null).length;
  const pendingOpinionCount = analyses.reduce(
    (total, item) => total + item.pendingOpinions.length,
    0,
  );
  const platforms = [...new Set(accounts.map((item) => item.platform).filter(Boolean))].sort();
  const hasMore = works.length < worksTotal;
  const selectedIndex = visibleWorks.findIndex((work) => work.workKey === selectedWorkKey);
  const selectedCreatorName = accounts.find((item) => item.creatorId === selectedCreatorId)?.displayName
    || analyses.find((item) => item.creatorId === selectedCreatorId)?.creatorName
    || selectedCreatorId;
  const extraFilterCount = Number(Boolean(platform)) + Number(direction !== 'all') + Number(timeWindow !== 'all');

  const handleCreatorSelect = (creatorId: string) => {
    setSelectedCreatorId((current) => current === creatorId ? '' : creatorId);
    setSelectedWorkKey('');
    setDirectoryTab('works');
  };

  const handleWorkSelect = (workKey: string) => {
    setSelectedWorkKey(workKey);
    focusReadingOnClose.current = true;
    setDirectoryOpen(false);
  };

  const openDirectory = (tab: 'ranking' | 'works') => {
    directoryTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusReadingOnClose.current = false;
    setDirectoryTab(tab);
    setDirectoryOpen(true);
  };

  const handleLoadMore = async () => {
    if (worksLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    const requestGeneration = worksRequestGeneration.current;
    setWorksLoadingMore(true);
    setWorksError(null);
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

  const directory = (
    <div className="creator-directory">
      <SelectionGroup><div className="creator-directory-tabs" aria-label="浏览目录">
        <button type="button" aria-pressed={directoryTab === 'works'} onClick={() => setDirectoryTab('works')}>
          <PanelLeft size={14} />观点目录
          <SelectionIndicator active={directoryTab === 'works'} />
        </button>
        <button type="button" aria-pressed={directoryTab === 'ranking'} onClick={() => setDirectoryTab('ranking')}>
          <Award size={14} />博主排行
          <SelectionIndicator active={directoryTab === 'ranking'} />
        </button>
        {!inlineDirectory && <button type="button" className="creator-directory-close" aria-label="关闭目录" onClick={() => setDirectoryOpen(false)}><X size={16} /></button>}
      </div></SelectionGroup>
      {directoryTab === 'ranking' ? (
        <CreatorRankingPanel
          items={rankingItems}
          accounts={accounts}
          selectedCreatorId={selectedCreatorId}
          loading={rankingLoading}
          error={rankingError}
          onSelect={handleCreatorSelect}
          onRetry={() => setRankingReload((value) => value + 1)}
        />
      ) : (
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
      )}
    </div>
  );

  return (
    <main className="creator-insights-view creator-research-view">
      <h1 className="sr-only">博主观点</h1>

      <section className="creator-filter-bar terminal-panel">
        <label className="creator-search">
          <Search size={14} />
          <input
            ref={searchRef}
            aria-label="搜索博主观点"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索作品、观点或标的"
            onKeyDown={(event) => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) setSearch(''); }}
          />
          {search && <button type="button" className="search-clear" aria-label="清除观点搜索" onClick={() => { setSearch(''); searchRef.current?.focus(); }}><X size={14} /></button>}
        </label>
        <SelectionGroup><div className="creator-filter-buttons" aria-label="发布时间">
          {TIME_WINDOWS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={timeWindow === option.value ? 'is-active' : ''}
              aria-pressed={timeWindow === option.value}
              onClick={() => setTimeWindow(option.value)}
            >
              {option.label}
              <SelectionIndicator active={timeWindow === option.value} />
            </button>
          ))}
        </div></SelectionGroup>
        <button type="button" className="creator-filter-toggle" aria-expanded={filtersOpen} aria-controls="creator-extra-filters" onClick={() => setFiltersOpen((value) => !value)}>
          <ListFilter size={14} />筛选{extraFilterCount > 0 && <b>{extraFilterCount}</b>}
        </button>
        {selectedCreatorId && <button type="button" className="creator-selected-filter" onClick={() => setSelectedCreatorId('')} aria-label={'取消博主筛选：' + selectedCreatorName}>{selectedCreatorName}<X size={12} /></button>}
        {!inlineDirectory && <div className="creator-compact-navigation">
          <button type="button" onClick={() => openDirectory('works')}><PanelLeft size={14} />切换作品</button>
          <button type="button" onClick={() => openDirectory('ranking')}><Award size={14} />博主排行</button>
        </div>}
        <AnimatedDisclosure open={filtersOpen} id="creator-extra-filters" className="creator-filter-disclosure">
        <div className="creator-extra-filters">
        <label className="creator-platform-select">
          <span>平台</span>
          <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="">全部平台</option>
            {platforms.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
          </select>
        </label>
        <SelectionGroup><div className="creator-filter-buttons" aria-label="观点方向">
          {DIRECTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={direction === option.value ? 'is-active' : ''}
              aria-pressed={direction === option.value}
              onClick={() => setDirection(option.value)}
            >
              {option.label}
              <SelectionIndicator active={direction === option.value} />
            </button>
          ))}
        </div></SelectionGroup>
        <button type="button" className="creator-clear-filters" onClick={clearFilters}>
          <RotateCcw size={12} />清除筛选
        </button>
        </div>
        </AnimatedDisclosure>
        <div className="creator-research-stats" aria-label="博主观点概览">
          <span>监控博主 <b>{accountsLoading ? '--' : accounts.length}</b></span>
          <span>A股相关作品 <b>{allWorksTotal ?? worksTotal}</b></span>
          <span>已评分博主 <b>{rankingLoading ? '--' : scoredCreatorCount}</b></span>
          <span>等待验证观点 <b>{rankingLoading ? '--' : pendingOpinionCount}</b></span>
        </div>
      </section>

      <div className="creator-research-layout">
        {inlineDirectory ? directory : (
          <DialogPrimitive.Root open={directoryOpen} onOpenChange={setDirectoryOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="creator-navigation-overlay" />
              <DialogPrimitive.Content className="creator-navigation-drawer" onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (focusReadingOnClose.current) readingRef.current?.focus();
                else directoryTrigger.current?.focus();
              }}>
                <DialogPrimitive.Title className="sr-only">博主观点目录</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">选择作品阅读分析，或按博主排行筛选作品</DialogPrimitive.Description>
                {directory}
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        )}
        <div ref={readingRef} className="creator-reading-main" role="region" tabIndex={-1} aria-label="当前作品分析">
        {!worksLoading && ((worksError && works.length === 0) || visibleWorks.length === 0) ? (
          <section className="terminal-panel creator-reading-empty">
            <h2>{worksError ? '作品加载失败' : '当前筛选条件下暂无博主观点'}</h2>
            {worksError && <p>{worksError}</p>}
            <button type="button" onClick={worksError ? () => setWorksReload((value) => value + 1) : clearFilters}>{worksError ? '重新加载作品' : '清除筛选'}</button>
            {hasMore && <button type="button" disabled={worksLoadingMore} onClick={() => void handleLoadMore()}>{worksLoadingMore ? '正在加载...' : '加载更多作品'}</button>}
          </section>
        ) : (
          <CreatorWorkDetailPanel
            work={detail}
            creatorAnalysis={selectedAnalysis}
            loading={worksLoading || detailLoading}
            error={detailError}
            onRetry={() => {
              if (selectedWorkKey) detailCache.current.delete(selectedWorkKey);
              setDetailReload((value) => value + 1);
            }}
            onClose={() => undefined}
            showCloseButton={false}
            navigation={<div className="creator-reading-navigation">
              <span>当前目录 {selectedIndex < 0 ? 0 : selectedIndex + 1} / {visibleWorks.length}</span>
              <button type="button" aria-label="上一篇分析" disabled={worksLoading || selectedIndex <= 0} onClick={() => handleWorkSelect(visibleWorks[selectedIndex - 1].workKey)}><ChevronLeft size={16} /></button>
              <button type="button" aria-label="下一篇分析" disabled={worksLoading || selectedIndex < 0 || selectedIndex >= visibleWorks.length - 1} onClick={() => handleWorkSelect(visibleWorks[selectedIndex + 1].workKey)}><ChevronRight size={16} /></button>
            </div>}
          />
        )}
        </div>
      </div>
    </main>
  );
}

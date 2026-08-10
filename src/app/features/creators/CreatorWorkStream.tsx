import {
  ArrowDownRight,
  ArrowUpRight,
  FileSearch,
  LoaderCircle,
  Minus,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { CreatorWorkSummary } from '../../lib/api';
import type { CreatorDirectionFilter } from './creator-opinion-state';

interface CreatorWorkStreamProps {
  items: CreatorWorkSummary[];
  selectedWorkKey: string;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  directionFilter: CreatorDirectionFilter;
  onSelect: (workKey: string) => void;
  onLoadMore: () => void;
  onClearFilters: () => void;
  onRetry: () => void;
}

function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    douyin: '抖音',
    weibo: '微博',
    wechat: '微信',
    sina_blog: '新浪博客',
    bilibili: '哔哩哔哩',
  };
  return labels[platform] ?? platform.toUpperCase();
}

function directionMeta(direction: string): {
  label: string;
  tone: string;
  Icon: ComponentType<{ size?: number }>;
} {
  if (direction === 'bullish') return { label: '看多', tone: 'bullish', Icon: ArrowUpRight };
  if (direction === 'bearish') return { label: '看空', tone: 'bearish', Icon: ArrowDownRight };
  if (direction === 'neutral') return { label: '中性', tone: 'neutral', Icon: Minus };
  return { label: direction || '未知', tone: 'unknown', Icon: Minus };
}

function publishedLabel(value: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '时间未知';
}

export function CreatorWorkStream({
  items,
  selectedWorkKey,
  loading,
  loadingMore,
  error,
  total,
  hasMore,
  directionFilter,
  onSelect,
  onLoadMore,
  onClearFilters,
  onRetry,
}: CreatorWorkStreamProps) {
  return (
    <section className="terminal-panel creator-work-stream">
      <header className="creator-panel-head">
        <div><FileSearch size={15} /><strong>最新观点流</strong></div>
        <small>{loading ? '更新中' : items.length + ' / ' + total + ' 条作品'}</small>
      </header>
      <div className="creator-stream-summary">
        方向：{directionFilter === 'all' ? '全部' : directionMeta(directionFilter).label}
      </div>

      {loading && <div className="terminal-empty"><span className="loading-pulse" />正在加载博主观点...</div>}
      {!loading && error && (
        <div className="terminal-empty is-error creator-inline-error">
          <TriangleAlert size={16} />
          <span>{error}</span>
          <button type="button" onClick={onRetry}><RefreshCw size={13} />重新加载</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="terminal-empty creator-empty-state">
          <FileSearch size={18} />
          <span>当前筛选条件下暂无博主观点</span>
          <button type="button" onClick={onClearFilters}>清除筛选</button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="creator-work-list terminal-scroll">
          {items.map((work) => (
            <button
              type="button"
              key={work.workKey}
              className={'creator-work-card ' + (selectedWorkKey === work.workKey ? 'is-active' : '')}
              aria-pressed={selectedWorkKey === work.workKey}
              onClick={() => onSelect(work.workKey)}
            >
              <span className="creator-work-meta">
                <b>{work.creatorName}</b>
                <em>{platformLabel(work.platform)}</em>
                <time>{publishedLabel(work.publishedAt)}</time>
              </span>
              <strong className="creator-work-title">{work.title}</strong>
              <span className="creator-work-preview">
                {work.opinions[0]?.claim || work.title || '暂无观点预览'}
              </span>
              <span className="creator-opinion-chips">
                {work.opinions.slice(0, 3).map((opinion) => {
                  const { Icon, label, tone } = directionMeta(opinion.direction);
                  const score = opinion.stanceScore === null
                    ? ''
                    : ' ' + (opinion.stanceScore > 0 ? '+' : '') + opinion.stanceScore;
                  return (
                    <em className={'creator-direction-chip is-' + tone} key={opinion.opinionId}>
                      <Icon size={11} />{label} · {opinion.targetName}{score}
                    </em>
                  );
                })}
                {work.opinions.length > 3 && <em>+{work.opinions.length - 3}</em>}
              </span>
              <small className="creator-work-count">共 {work.opinions.length} 条观点</small>
            </button>
          ))}
          {hasMore && (
            <button
              type="button"
              className="creator-load-more"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? <LoaderCircle className="is-spinning" size={14} /> : null}
              {loadingMore ? '正在加载...' : '加载更多'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

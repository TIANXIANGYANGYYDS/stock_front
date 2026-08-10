import { Award, Database, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { CreatorAccount } from '../../lib/api';
import type { CreatorRankingItem } from './creator-opinion-state';

interface CreatorRankingPanelProps {
  items: CreatorRankingItem[];
  accounts: CreatorAccount[];
  selectedCreatorId: string;
  loading: boolean;
  error: string | null;
  onSelect: (creatorId: string) => void;
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

export function CreatorRankingPanel({
  items,
  accounts,
  selectedCreatorId,
  loading,
  error,
  onSelect,
  onRetry,
}: CreatorRankingPanelProps) {
  const scored = items.filter((item) => item.accuracyScore !== null);
  const accumulating = items.filter((item) => item.accuracyScore === null);

  return (
    <section className="terminal-panel creator-ranking-panel">
      <header className="creator-panel-head">
        <div><Award size={15} /><strong>博主评分排行</strong></div>
        <small>{loading ? '更新中' : scored.length + ' 位已评分'}</small>
      </header>

      {loading && <div className="terminal-empty"><span className="loading-pulse" />正在加载评分排行...</div>}
      {!loading && error && (
        <div className="terminal-empty is-error creator-inline-error">
          <TriangleAlert size={16} />
          <span>{error}</span>
          <button type="button" onClick={onRetry}><RefreshCw size={13} />重新加载</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="terminal-empty"><Database size={17} />暂无可评分博主</div>
      )}

      {!loading && items.length > 0 && (
        <div className="creator-ranking-scroll terminal-scroll">
          <div className="creator-ranking-group">
            {scored.map((item) => {
              const account = accounts.find((candidate) => candidate.creatorId === item.creatorId);
              return (
                <button
                  type="button"
                  key={item.creatorId}
                  className={'creator-ranking-item ' + (selectedCreatorId === item.creatorId ? 'is-active' : '')}
                  aria-pressed={selectedCreatorId === item.creatorId}
                  onClick={() => onSelect(item.creatorId)}
                >
                  <span className={'creator-rank-index creator-rank-' + item.rank}>{String(item.rank).padStart(2, '0')}</span>
                  <span className="creator-rank-main">
                    <strong>{item.creatorName}</strong>
                    <small>
                      {account ? platformLabel(account.platform) : '平台待识别'}
                      {account?.verificationStatus === 'verified' && <ShieldCheck size={11} aria-label="账号已核验" />}
                    </small>
                    <em>{item.effectiveSamples} 个有效样本 · {item.pendingCount} 个待验证</em>
                  </span>
                  <span className="creator-rank-score">
                    <b>{item.accuracyScore?.toFixed(2)}</b>
                    <small>准确率</small>
                    {item.smallSample && <em>样本较少</em>}
                  </span>
                </button>
              );
            })}
          </div>

          {accumulating.length > 0 && (
            <div className="creator-ranking-group is-accumulating">
              <div className="creator-ranking-group-title"><Database size={12} />数据积累中</div>
              {accumulating.map((item) => (
                <button
                  type="button"
                  key={item.creatorId}
                  className={'creator-ranking-item ' + (selectedCreatorId === item.creatorId ? 'is-active' : '')}
                  aria-pressed={selectedCreatorId === item.creatorId}
                  onClick={() => onSelect(item.creatorId)}
                >
                  <span className="creator-rank-index">--</span>
                  <span className="creator-rank-main">
                    <strong>{item.creatorName}</strong>
                    <em>{item.pendingCount} 个待验证</em>
                  </span>
                  <span className="creator-rank-score"><small>数据积累中</small></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

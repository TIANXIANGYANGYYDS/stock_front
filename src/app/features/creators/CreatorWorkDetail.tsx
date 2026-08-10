import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  Minus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { CreatorOpinionAnalysis, CreatorWorkDetail } from '../../lib/api';
import {
  chooseCreatorSourceText,
  mergeOpinionVerification,
  verificationPresentation,
  type VerificationTone,
} from './creator-opinion-state';

interface CreatorWorkDetailPanelProps {
  work: CreatorWorkDetail | null;
  creatorAnalysis: CreatorOpinionAnalysis | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}

function directionMeta(direction: string): {
  label: string;
  tone: string;
  Icon: ComponentType<{ size?: number }>;
} {
  if (direction === 'bullish') return { label: '看多', tone: 'bullish', Icon: ArrowUpRight };
  if (direction === 'bearish') return { label: '看空', tone: 'bearish', Icon: ArrowDownRight };
  if (direction === 'neutral') return { label: '中性', tone: 'neutral', Icon: Minus };
  return { label: direction || '未知方向', tone: 'unknown', Icon: Minus };
}

function VerificationIcon({ tone }: { tone: VerificationTone }) {
  if (tone === 'positive' || tone === 'partial') return <CheckCircle2 size={13} />;
  return <CircleAlert size={13} />;
}

function scoreLabel(score: number | null): string {
  if (score === null) return '';
  return (score > 0 ? '+' : '') + score;
}

export function CreatorWorkDetailPanel({
  work,
  creatorAnalysis,
  loading,
  error,
  onRetry,
  onClose,
}: CreatorWorkDetailPanelProps) {
  const [tab, setTab] = useState<'analysis' | 'source'>('analysis');

  useEffect(() => {
    setTab('analysis');
  }, [work?.workKey]);

  const opinionRows = useMemo(
    () => mergeOpinionVerification(work?.opinions ?? [], creatorAnalysis),
    [creatorAnalysis, work?.opinions],
  );
  const source = work
    ? chooseCreatorSourceText(work)
    : { label: '暂无可读原文', text: '' };

  return (
    <aside className="terminal-panel creator-work-detail" aria-label="作品与观点详情">
      <header className="creator-panel-head">
        <div><Sparkles size={15} /><strong>作品与观点详情</strong></div>
        <button type="button" className="creator-detail-close" onClick={onClose} aria-label="关闭详情"><X size={15} /></button>
      </header>

      {loading && <div className="terminal-empty"><span className="loading-pulse" />正在加载作品详情...</div>}
      {!loading && error && (
        <div className="terminal-empty is-error creator-inline-error">
          <CircleAlert size={16} />
          <span>{error}</span>
          <button type="button" onClick={onRetry}><RefreshCw size={13} />重新加载详情</button>
        </div>
      )}
      {!loading && !error && !work && (
        <div className="terminal-empty"><FileText size={17} />选择一条作品查看完整观点</div>
      )}

      {!loading && !error && work && (
        <>
          <div className="creator-detail-heading">
            <span>{work.creatorName} · {work.platform.toUpperCase()}</span>
            <h2>{work.title}</h2>
            <div>
              <time><Clock3 size={11} />{work.publishedAt.replace('T', ' ').slice(0, 16)}</time>
              {work.canonicalUrl && (
                <a href={work.canonicalUrl} target="_blank" rel="noreferrer noopener">
                  查看原始内容<ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          <div className="creator-detail-tabs" role="tablist" aria-label="详情内容">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'analysis'}
              className={tab === 'analysis' ? 'is-active' : ''}
              onClick={() => setTab('analysis')}
            >
              观点分析
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'source'}
              className={tab === 'source' ? 'is-active' : ''}
              onClick={() => setTab('source')}
            >
              原始内容
            </button>
          </div>

          {tab === 'analysis' && (
            <div className="creator-detail-scroll terminal-scroll">
              <section className="creator-ai-summary">
                <h3><Sparkles size={13} />AI 内容摘要</h3>
                <p>{work.summary || work.opinions[0]?.claim || '暂无摘要'}</p>
                <small>AI 提取仅用于信息整理，不构成投资建议</small>
              </section>

              <div className="creator-opinion-detail-list">
                {opinionRows.length === 0 && <div className="terminal-empty">该作品暂无结构化 A 股观点</div>}
                {opinionRows.map(({ opinion, verification, pending }, index) => {
                  const direction = directionMeta(opinion.direction);
                  const verificationState = opinion.verifiable === false
                    ? { label: '长期/不可量化观点', tone: 'muted' as const }
                    : verificationPresentation(verification?.verdict ?? pending?.verdict ?? null);
                  const strength = opinion.stanceScore === null
                    ? ''
                    : (opinion.stanceScore > 0 ? '+' : '') + opinion.stanceScore;
                  return (
                    <article className="creator-opinion-detail-card" key={opinion.opinionId || index}>
                      <header>
                        <span className={'creator-direction-chip is-' + direction.tone}>
                          <direction.Icon size={12} />{direction.label}
                        </span>
                        <strong>{opinion.targetName}</strong>
                        <span className={'creator-verification-pill is-' + verificationState.tone}>
                          <VerificationIcon tone={verificationState.tone} />
                          {verificationState.label}
                          {verification && scoreLabel(verification.score) && ' ' + scoreLabel(verification.score)}
                        </span>
                      </header>
                      <h3>{opinion.claim || verification?.opinion || '观点正文缺失'}</h3>
                      <div className="creator-opinion-metrics">
                        <span>类型 {opinion.targetType || '未知'}</span>
                        {strength && <span>立场 {strength}</span>}
                        {opinion.confidence !== null && <span>置信度 {(opinion.confidence * 100).toFixed(0)}%</span>}
                        {opinion.horizon && <span>周期 {opinion.horizon}</span>}
                        {opinion.verificationDate && <span>验证日 {opinion.verificationDate}</span>}
                      </div>
                      {opinion.conditions.length > 0 && (
                        <div className="creator-opinion-conditions">
                          <b>成立条件</b>
                          <ul>{opinion.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
                        </div>
                      )}
                      {opinion.metric && <p className="creator-opinion-metric"><b>衡量指标：</b>{opinion.metric}</p>}
                      {opinion.sourceQuote && <blockquote>“{opinion.sourceQuote}”</blockquote>}
                      {verification?.reason && (
                        <div className="creator-verification-reason">
                          <b>验证说明</b>
                          <p>{verification.reason}</p>
                          {verification.verifiedAt && <small>验证时间 {verification.verifiedAt.replace('T', ' ').slice(0, 16)}</small>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'source' && (
            <div className="creator-source-pane terminal-scroll">
              <div><FileText size={13} /><strong>{source.label}</strong></div>
              {source.text
                ? <p>{source.text}</p>
                : <div className="terminal-empty">暂无可读原文</div>}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

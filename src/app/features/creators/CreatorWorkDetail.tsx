import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useWorkspaceState } from '../../hooks/useWorkspaceState';
import { ReadingProgress } from '../../components/ReadingProgress';
import * as m from 'motion/react-m';
import { SelectionGroup, SelectionIndicator, useEntranceMotion } from '../../components/StudioMotion';
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
import type { LucideIcon } from 'lucide-react';
import type { CreatorOpinionAnalysis, CreatorWorkDetail } from '../../lib/api';
import {
  chooseCreatorSourceText,
  effectiveSampleCount,
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
  showCloseButton?: boolean;
  navigation?: ReactNode;
}

function directionMeta(direction: string): {
  label: string;
  tone: string;
  Icon: LucideIcon;
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

function dateTimeLabel(value: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '未提供';
}

export function CreatorWorkDetailPanel({
  work,
  creatorAnalysis,
  loading,
  error,
  onRetry,
  onClose,
  showCloseButton = true,
  navigation,
}: CreatorWorkDetailPanelProps) {
  const [tab, setTab] = useWorkspaceState<'analysis' | 'source'>('creators.detailTab', 'analysis');
  const contentRef = useRef<HTMLDivElement>(null);
  const entrance = useEntranceMotion();
  const summaryEntrance = useEntranceMotion({ lift: true });

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [work?.workKey, tab, loading]);

  const opinionRows = useMemo(
    () => mergeOpinionVerification(work?.opinions ?? [], creatorAnalysis),
    [creatorAnalysis, work?.opinions],
  );
  const source = work
    ? chooseCreatorSourceText(work)
    : { label: '暂无可读原文', text: '' };
  const sampleCount = creatorAnalysis ? effectiveSampleCount(creatorAnalysis) : 0;
  const platformLabels: Record<string, string> = { weibo: '微博', douyin: '抖音', sina_blog: '新浪博客', wechat: '微信', bilibili: '哔哩哔哩' };
  const contentTypeLabels: Record<string, string> = { post: '图文', image_post: '图文', video: '视频', article: '文章', text: '文字' };

  return (
    <section className="terminal-panel creator-work-detail creator-analysis-report" aria-label="作品与观点详情">
      <header className="creator-panel-head">
        <div><Sparkles size={15} /><strong>重点分析</strong></div>
        {navigation}
        {showCloseButton && <button type="button" className="creator-detail-close" onClick={onClose} aria-label="关闭详情"><X size={15} /></button>}
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
          <div className="creator-report-context">
            <div className="creator-report-author">
              <span className="creator-author-mark" aria-hidden="true">{work.creatorName.slice(0, 1)}</span>
              <div><strong>{work.creatorName}</strong><span>{platformLabels[work.platform] || work.platform.toUpperCase()}<time><Clock3 size={11} />{dateTimeLabel(work.publishedAt)}</time></span></div>
            </div>
            <div className="creator-author-evidence">
              {creatorAnalysis?.accuracyScore != null ? <>
                <span>历史准确率 <b>{creatorAnalysis.accuracyScore.toFixed(2)}%</b></span>
                <small>{sampleCount} 个有效样本{sampleCount < 5 && ' · 样本较少'}</small>
              </> : <span>暂无历史评分</span>}
            </div>
          </div>

          <SelectionGroup><div className="creator-detail-tabs" aria-label="详情内容">
            <button
              type="button"
              aria-pressed={tab === 'analysis'}
              className={tab === 'analysis' ? 'is-active' : ''}
              onClick={() => setTab('analysis')}
            >
              观点分析
              <SelectionIndicator active={tab === 'analysis'} underline />
            </button>
            <button
              type="button"
              aria-pressed={tab === 'source'}
              className={tab === 'source' ? 'is-active' : ''}
              onClick={() => setTab('source')}
            >
              原始内容
              <SelectionIndicator active={tab === 'source'} underline />
            </button>
            {work.canonicalUrl && <a href={work.canonicalUrl} target="_blank" rel="noreferrer noopener">原始作品<ExternalLink size={12} /></a>}
          </div></SelectionGroup>

          {tab === 'analysis' && (
            <m.div key={`${work.workKey}:analysis`} ref={contentRef} className="creator-detail-scroll terminal-scroll" {...entrance}>
              <ReadingProgress />
              <m.section className="creator-ai-summary" {...summaryEntrance}>
                <h2><Sparkles size={15} />核心摘要</h2>
                <p>{work.summary || '暂无 AI 摘要'}</p>
                {opinionRows.length > 1 && <nav className="creator-analysis-targets" aria-label="本篇分析标的">
                  {opinionRows.map(({ opinion }, index) => <button type="button" key={opinion.opinionId || index} onClick={() => {
                    const target = contentRef.current?.querySelector<HTMLElement>('[data-opinion-index="' + index + '"]');
                    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
                    target?.focus({ preventScroll: true });
                  }}>{opinion.targetName || '观点 ' + (index + 1)}<ArrowDownRight size={12} /></button>)}
                </nav>}
              </m.section>

              <div className="creator-analysis-section-head"><h2>观点拆解</h2><span>{opinionRows.length} 条结构化观点</span></div>
              <div className="creator-opinion-detail-list">
                {opinionRows.length === 0 && <div className="terminal-empty">该作品暂无结构化 A 股观点</div>}
                {opinionRows.map(({ opinion, verification, pending }, index) => {
                  const direction = directionMeta(opinion.direction);
                  const verificationState = opinion.verifiable === false
                    ? { label: '长期/不可量化观点', tone: 'muted' as const }
                    : verificationPresentation(verification?.verdict ?? pending?.verdict ?? null);
                  const rawVerification = 'raw' in verificationState
                    ? verificationState.raw
                    : '';
                  const strength = opinion.stanceScore === null
                    ? ''
                    : (opinion.stanceScore > 0 ? '+' : '') + opinion.stanceScore;
                  return (
                    <article className="creator-opinion-detail-card" key={opinion.opinionId || index} data-opinion-index={index} tabIndex={-1}>
                      <header>
                        <span className={'creator-direction-chip is-' + direction.tone}>
                          <direction.Icon size={12} />{direction.label}
                        </span>
                        <strong>{opinion.targetName}</strong>
                        <span className={'creator-verification-pill is-' + verificationState.tone}>
                          <VerificationIcon tone={verificationState.tone} />
                          {verificationState.label}
                          {rawVerification && ' · ' + rawVerification}
                          {verification && scoreLabel(verification.score) && ' ' + scoreLabel(verification.score)}
                        </span>
                      </header>
                      <h3>{opinion.claim || verification?.opinion || '观点正文缺失'}</h3>
                      <div className="creator-opinion-metrics">
                        {strength && <span>立场 {strength}</span>}
                        {opinion.confidence !== null && <span>置信度 {(opinion.confidence * 100).toFixed(0)}%</span>}
                        {opinion.horizon && <span>周期 {opinion.horizon}</span>}
                      </div>
                      <div className="creator-opinion-evidence">
                      {(opinion.conditions.length > 0 || opinion.metric) && <section className="creator-opinion-basis">
                      {opinion.conditions.length > 0 && (
                        <div className="creator-opinion-conditions">
                          <b>成立条件</b>
                          <ul>{opinion.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
                        </div>
                      )}
                      {opinion.metric && <p className="creator-opinion-metric"><b>衡量指标：</b>{opinion.metric}</p>}
                      </section>}
                      <section className="creator-verification-reason">
                        <b>{verification ? '验证说明' : '验证进展'}</b>
                        <p>{verification?.reason || (opinion.verifiable === false
                          ? '长期或不可量化的观点，不纳入量化验证。'
                          : verification ? '暂无详细验证说明。'
                            : opinion.verificationDate ? '等待验证日结果，当前尚无验证结论。' : '尚未提供验证结果。')}</p>
                        {opinion.verifiable !== false && opinion.verificationDate && <small>验证日 {opinion.verificationDate}</small>}
                        {verification?.verifiedAt && <small>验证时间 {dateTimeLabel(verification.verifiedAt)}</small>}
                      </section>
                      </div>
                      <details className="creator-opinion-reference">
                        <summary>原文依据与有效期</summary>
                        {opinion.sourceQuote && <blockquote>“{opinion.sourceQuote}”</blockquote>}
                        <p>有效期 {dateTimeLabel(opinion.validFrom)} 至 {dateTimeLabel(opinion.validUntil)}</p>
                        <p>标的类型 {({ stock: '个股', sector: '板块', index: '指数', market: '市场' } as Record<string, string>)[opinion.targetType] || opinion.targetType || '未知'}</p>
                      </details>
                    </article>
                  );
                })}
              </div>
              <p className="creator-analysis-note">AI 提取仅用于信息整理，不构成投资建议</p>
            </m.div>
          )}

          {tab === 'source' && (
            <m.div key={`${work.workKey}:source`} ref={contentRef} className="creator-source-pane terminal-scroll" {...entrance}>
              <ReadingProgress />
              <h2>{work.title}</h2>
              <p className="creator-source-meta">内容类型 {contentTypeLabels[work.contentType] || work.contentType || '未知'}</p>
              <div><FileText size={13} /><strong>{source.label}</strong></div>
              {source.text
                ? <p>{source.text}</p>
                : <div className="terminal-empty">暂无可读原文</div>}
            </m.div>
          )}
        </>
      )}
    </section>
  );
}

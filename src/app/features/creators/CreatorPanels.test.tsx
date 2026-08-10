// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CreatorAccount,
  CreatorOpinionAnalysis,
  CreatorWorkDetail,
  CreatorWorkSummary,
} from '../../lib/api';
import type { CreatorRankingItem } from './creator-opinion-state';
import { CreatorRankingPanel } from './CreatorRankingPanel';
import { CreatorWorkDetailPanel } from './CreatorWorkDetail';
import { CreatorWorkStream } from './CreatorWorkStream';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

async function render(element: React.ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(element));
  return host;
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const match = [...host.querySelectorAll('button')].find(
    (item) => item.textContent?.includes(label),
  );
  if (!match) throw new Error('Missing button: ' + label);
  return match;
}

const account: CreatorAccount = {
  rank: 1,
  creatorId: 'hero',
  displayName: '天津股侠',
  platform: 'weibo',
  accountKey: 'weibo:hero',
  platformAccountId: 'hero',
  handle: '',
  alias: '',
  homepageUrl: 'https://weibo.com/hero',
  enabled: true,
  verificationStatus: 'verified',
  notes: '',
};

const creatorAnalysis: CreatorOpinionAnalysis = {
  creatorId: 'hero',
  creatorName: '天津股侠',
  accuracyScore: 100,
  verifiedOpinions: [{
    opinionId: 'work:1:opinion',
    workKey: 'work:1',
    platform: 'weibo',
    publishedAt: '2026-08-09T16:00:00+08:00',
    targetType: 'sector',
    targetName: '商业航天',
    direction: 'bullish',
    opinion: '商业航天明天可能冲高',
    verificationDate: '2026-08-10',
    verifiedAt: '2026-08-10T15:30:00+08:00',
    verdict: 'corroborated',
    score: 1,
    reason: '板块走势支持该观点。',
  }],
  pendingOpinions: [],
};

const workSummary: CreatorWorkSummary = {
  workKey: 'work:1',
  creatorId: 'hero',
  creatorName: '天津股侠',
  accountId: 'weibo:hero',
  platform: 'weibo',
  title: '商业航天明日展望',
  contentType: 'post',
  publishedAt: '2026-08-09T16:00:00+08:00',
  canonicalUrl: 'https://weibo.com/work/1',
  status: 'finished',
  isAShareRelevant: true,
  opinions: [{
    opinionId: 'work:1:opinion',
    workKey: 'work:1',
    marketScope: 'a_share',
    targetType: 'sector',
    targetId: null,
    targetName: '商业航天',
    direction: 'bullish',
    stanceScore: 60,
    claim: '商业航天明天可能冲高',
    horizon: '1天',
    validFrom: '2026-08-09T16:00:00+08:00',
    validUntil: '2026-08-10T15:00:00+08:00',
    metric: '板块涨跌幅',
    conditions: ['发射预期'],
    confidence: 0.8,
    verifiable: true,
    sourceQuote: '明天有可能冲一把高',
    verificationDate: '2026-08-10',
  }],
};

const workDetail: CreatorWorkDetail = {
  ...workSummary,
  summary: '作者认为商业航天短线存在事件驱动机会。',
  analysisModel: 'qwen3.7-max',
  analyzedAt: '2026-08-09T17:00:00+08:00',
  sourceText: '这是完整的原始正文。',
  extractedText: '提取正文',
  asrText: '',
  ocrText: '',
  mediaUrl: '',
  durationMs: null,
};

describe('CreatorRankingPanel', () => {
  it('renders sample evidence, null accuracy, and creator selection', async () => {
    const onSelect = vi.fn();
    const scored: CreatorRankingItem = {
      creatorId: 'hero',
      creatorName: '天津股侠',
      accuracyScore: 100,
      effectiveSamples: 1,
      pendingCount: 3,
      rank: 1,
      smallSample: true,
      analysis: creatorAnalysis,
    };
    const accumulatingAnalysis: CreatorOpinionAnalysis = {
      creatorId: 'new',
      creatorName: '数据新人',
      accuracyScore: null,
      verifiedOpinions: [],
      pendingOpinions: [],
    };
    const accumulating: CreatorRankingItem = {
      creatorId: 'new',
      creatorName: '数据新人',
      accuracyScore: null,
      effectiveSamples: 0,
      pendingCount: 0,
      rank: null,
      smallSample: false,
      analysis: accumulatingAnalysis,
    };

    const host = await render(
      <CreatorRankingPanel
        items={[scored, accumulating]}
        accounts={[account]}
        selectedCreatorId=""
        loading={false}
        error={null}
        onSelect={onSelect}
        onRetry={vi.fn()}
      />,
    );

    expect(host.textContent).toContain('100.00');
    expect(host.textContent).toContain('1 个有效样本');
    expect(host.textContent).toContain('样本较少');
    expect(host.textContent).toContain('数据积累中');

    await act(async () => button(host, '天津股侠').click());
    expect(onSelect).toHaveBeenCalledWith('hero');
  });
});

describe('CreatorWorkStream', () => {
  it('shows textual direction evidence and exposes selection and pagination', async () => {
    const onSelect = vi.fn();
    const onLoadMore = vi.fn();
    const host = await render(
      <CreatorWorkStream
        items={[workSummary]}
        selectedWorkKey=""
        loading={false}
        loadingMore={false}
        error={null}
        total={30}
        hasMore
        directionFilter="all"
        onSelect={onSelect}
        onLoadMore={onLoadMore}
        onClearFilters={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(host.textContent).toContain('看多');
    expect(host.textContent).toContain('商业航天');
    expect(host.textContent).toContain('共 1 条观点');
    expect(host.textContent).toContain('可验证 1 · 长期/不可量化 0');

    await act(async () => button(host, '商业航天明日展望').click());
    await act(async () => button(host, '加载更多').click());
    expect(onSelect).toHaveBeenCalledWith('work:1');
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});

describe('CreatorWorkDetailPanel', () => {
  it('renders verified analysis and switches to the labeled original source', async () => {
    const host = await render(
      <CreatorWorkDetailPanel
        work={workDetail}
        creatorAnalysis={creatorAnalysis}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(host.textContent).toContain('作者认为商业航天短线存在事件驱动机会');
    expect(host.textContent).toContain('命中');
    expect(host.textContent).toContain('+1');
    expect(host.textContent).toContain('板块走势支持该观点');
    expect(host.textContent).toContain('置信度 80%');

    await act(async () => button(host, '原始内容').click());
    expect(host.textContent).toContain('原始正文');
    expect(host.textContent).toContain('这是完整的原始正文');

    const external = host.querySelector<HTMLAnchorElement>('a[href="https://weibo.com/work/1"]');
    expect(external?.target).toBe('_blank');
    expect(external?.rel).toContain('noreferrer');
    expect(external?.rel).toContain('noopener');
  });

  it('keeps missing summaries honest and exposes unknown verification details', async () => {
    const unknownAnalysis: CreatorOpinionAnalysis = {
      ...creatorAnalysis,
      verifiedOpinions: [{
        ...creatorAnalysis.verifiedOpinions[0],
        verdict: 'backend_new_verdict',
      }],
    };
    const host = await render(
      <CreatorWorkDetailPanel
        work={{ ...workDetail, summary: '' }}
        creatorAnalysis={unknownAnalysis}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(host.querySelector('.creator-ai-summary p')?.textContent).toBe('暂无 AI 摘要');
    expect(host.textContent).toContain('待识别状态 · backend_new_verdict');
    expect(host.textContent).toContain('内容类型 post');
    expect(host.textContent).toContain('有效期 2026-08-09 16:00 至 2026-08-10 15:00');
    expect(button(host, '观点分析').getAttribute('aria-pressed')).toBe('true');

    await act(async () => button(host, '原始内容').click());
    expect(button(host, '原始内容').getAttribute('aria-pressed')).toBe('true');
  });
});

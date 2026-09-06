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

const apiMocks = vi.hoisted(() => ({
  getCreatorAccounts: vi.fn(),
  getCreatorOpinionAnalyses: vi.fn(),
  getCreatorOpinionAnalysis: vi.fn(),
  getCreatorWorks: vi.fn(),
  getCreatorWorkDetail: vi.fn(),
}));

vi.mock('../../lib/api', () => apiMocks);

import { CreatorInsightsView } from './CreatorInsightsView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  Object.values(apiMocks).forEach((mock) => mock.mockReset());
  vi.unstubAllGlobals();
});

async function renderView(): Promise<HTMLElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(<CreatorInsightsView />));
  await flush();
  return host;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
  });
}

function clickButton(host: HTMLElement, label: string): void {
  const match = [...host.querySelectorAll('button')].find(
    (item) => item.textContent?.includes(label),
  );
  if (!match) throw new Error('Missing button: ' + label);
  match.click();
}

function creatorAccount(
  creatorId: string,
  displayName: string,
): CreatorAccount {
  return {
    rank: 1,
    creatorId,
    displayName,
    platform: 'weibo',
    accountKey: 'weibo:' + creatorId,
    platformAccountId: creatorId,
    handle: '',
    alias: '',
    homepageUrl: 'https://weibo.com/' + creatorId,
    enabled: true,
    verificationStatus: 'verified',
    notes: '',
  };
}

function creatorAnalysis(
  creatorId: string,
  creatorName: string,
  accuracyScore: number | null,
): CreatorOpinionAnalysis {
  return {
    creatorId,
    creatorName,
    accuracyScore,
    verifiedOpinions: accuracyScore === null ? [] : [{
      opinionId: creatorId + ':opinion',
      workKey: creatorId + ':work',
      platform: 'weibo',
      publishedAt: '2026-08-09T16:00:00+08:00',
      targetType: 'sector',
      targetName: '商业航天',
      direction: 'bullish',
      opinion: '商业航天走强',
      verificationDate: '2026-08-10',
      verifiedAt: '2026-08-10T15:30:00+08:00',
      verdict: 'corroborated',
      score: 1,
      reason: '走势得到验证',
    }],
    pendingOpinions: [{
      opinionId: creatorId + ':pending',
      workKey: creatorId + ':pending-work',
      platform: 'weibo',
      publishedAt: '2026-08-09T16:00:00+08:00',
      targetType: 'market',
      targetName: 'A股',
      direction: 'neutral',
      opinion: '等待验证观点',
      verificationDate: '2026-08-11',
      verifiedAt: '',
      verdict: null,
      score: null,
      reason: '',
    }],
  };
}

function creatorWork(
  workKey: string,
  creatorId: string,
  title: string,
  direction = 'bullish',
): CreatorWorkSummary {
  return {
    workKey,
    creatorId,
    creatorName: creatorId === 'hero' ? '天津股侠' : '数据新人',
    accountId: 'weibo:' + creatorId,
    platform: 'weibo',
    title,
    contentType: 'post',
    publishedAt: '2026-08-09T16:00:00+08:00',
    canonicalUrl: 'https://weibo.com/' + workKey,
    status: 'finished',
    isAShareRelevant: true,
    opinions: [{
      opinionId: creatorId + ':opinion',
      workKey,
      marketScope: 'a_share',
      targetType: 'sector',
      targetId: null,
      targetName: direction === 'bullish' ? '商业航天' : '创新药',
      direction,
      stanceScore: direction === 'bullish' ? 60 : -60,
      claim: title + '的结构化观点',
      horizon: '1天',
      validFrom: '2026-08-09T16:00:00+08:00',
      validUntil: '2026-08-10T15:00:00+08:00',
      metric: '板块涨跌幅',
      conditions: [],
      confidence: 0.8,
      verifiable: true,
      sourceQuote: '原始引用',
      verificationDate: '2026-08-10',
    }],
  };
}

function detailOf(work: CreatorWorkSummary): CreatorWorkDetail {
  return {
    ...work,
    summary: work.title + '的 AI 摘要',
    analysisModel: 'qwen3.7-max',
    analyzedAt: '2026-08-09T17:00:00+08:00',
    sourceText: work.title + '的完整原文',
    extractedText: '',
    asrText: '',
    ocrText: '',
    mediaUrl: '',
    durationMs: null,
  };
}

function prepareSuccessfulInitialLoad(
  works: CreatorWorkSummary[],
  total = works.length,
): void {
  apiMocks.getCreatorAccounts.mockResolvedValue([
    creatorAccount('hero', '天津股侠'),
    creatorAccount('new', '数据新人'),
  ]);
  apiMocks.getCreatorOpinionAnalyses.mockResolvedValue([
    creatorAnalysis('hero', '天津股侠', 74.46),
    creatorAnalysis('new', '数据新人', null),
  ]);
  apiMocks.getCreatorWorks.mockResolvedValue({
    items: works,
    total,
    page: 1,
    pageSize: 24,
  });
  apiMocks.getCreatorWorkDetail.mockImplementation(async (workKey: string) => {
    const match = works.find((item) => item.workKey === workKey);
    if (!match) throw new Error('作品不存在');
    return detailOf(match);
  });
}

describe('CreatorInsightsView', () => {
  it('keeps the selected platform when filters are closed and reopened without refetching', async () => {
    prepareSuccessfulInitialLoad([creatorWork('hero:work', 'hero', '筛选条件保留')]);
    const host = await renderView();
    const toggle = host.querySelector<HTMLButtonElement>('.creator-filter-toggle')!;
    expect(host.querySelector('#creator-extra-filters')).toBeNull();
    await act(async () => toggle.click());
    const select = host.querySelector<HTMLSelectElement>('#creator-extra-filters select')!;
    const platform = select.options[1].value;
    await act(async () => {
      select.value = platform;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
    expect(apiMocks.getCreatorWorks).toHaveBeenLastCalledWith(expect.objectContaining({ platform }));
    const requests = apiMocks.getCreatorWorks.mock.calls.length;
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('#creator-extra-filters')).toBeNull();
    await act(async () => toggle.click());
    expect(host.querySelector<HTMLSelectElement>('#creator-extra-filters select')?.value).toBe(platform);
    expect(apiMocks.getCreatorWorks).toHaveBeenCalledTimes(requests);
  });

  it('loads accounts, rankings, works, and the first work detail independently', async () => {
    const firstWork = creatorWork('hero:work', 'hero', '商业航天明日展望');
    prepareSuccessfulInitialLoad([firstWork], 847);

    const host = await renderView();

    expect(host.querySelector('.view-heading')).toBeNull();
    expect(host.textContent).toContain('监控博主');
    expect(host.textContent).toContain('847');
    expect(host.textContent).toContain('74.46');
    expect(host.textContent).toContain('商业航天明日展望的 AI 摘要');
    expect(apiMocks.getCreatorAccounts).toHaveBeenCalledTimes(1);
    expect(apiMocks.getCreatorOpinionAnalyses).toHaveBeenCalledTimes(1);
    expect(apiMocks.getCreatorWorks).toHaveBeenCalledTimes(1);
    expect(apiMocks.getCreatorWorkDetail).toHaveBeenCalledWith('hero:work');
  });

  it('keeps the work stream and detail usable when rankings fail', async () => {
    const firstWork = creatorWork('hero:work', 'hero', '商业航天明日展望');
    apiMocks.getCreatorAccounts.mockResolvedValue([]);
    apiMocks.getCreatorOpinionAnalyses.mockRejectedValue(new Error('排行离线'));
    apiMocks.getCreatorWorks.mockResolvedValue({
      items: [firstWork],
      total: 1,
      page: 1,
      pageSize: 24,
    });
    apiMocks.getCreatorWorkDetail.mockResolvedValue(detailOf(firstWork));

    const host = await renderView();

    await act(async () => clickButton(host, '博主排行'));
    expect(host.textContent).toContain('排行离线');
    expect(host.textContent).toContain('商业航天明日展望');
    expect(host.textContent).toContain('商业航天明日展望的 AI 摘要');
  });

  it('toggles a creator filter and reloads only the first works page', async () => {
    const firstWork = creatorWork('hero:work', 'hero', '商业航天明日展望');
    prepareSuccessfulInitialLoad([firstWork]);
    const host = await renderView();

    await act(async () => clickButton(host, '博主排行'));
    await act(async () => clickButton(host, '数据新人'));
    await flush();

    expect(apiMocks.getCreatorWorks).toHaveBeenLastCalledWith(
      expect.objectContaining({ creatorId: 'new', page: 1 }),
    );

    await act(async () => (host.querySelector('[aria-label="取消博主筛选：数据新人"]') as HTMLButtonElement).click());
    await flush();

    expect(apiMocks.getCreatorWorks).toHaveBeenLastCalledWith(
      expect.objectContaining({ creatorId: undefined, page: 1 }),
    );
  });

  it('appends the next page without duplicating the existing work', async () => {
    const firstWork = creatorWork('hero:work', 'hero', '第一页观点');
    const secondWork = creatorWork('new:work', 'new', '第二页观点', 'bearish');
    apiMocks.getCreatorAccounts.mockResolvedValue([]);
    apiMocks.getCreatorOpinionAnalyses.mockResolvedValue([]);
    apiMocks.getCreatorWorks
      .mockResolvedValueOnce({ items: [firstWork], total: 2, page: 1, pageSize: 24 })
      .mockResolvedValueOnce({ items: [firstWork, secondWork], total: 2, page: 2, pageSize: 24 });
    apiMocks.getCreatorWorkDetail.mockImplementation(async (workKey: string) =>
      detailOf(workKey === firstWork.workKey ? firstWork : secondWork));

    const host = await renderView();
    await act(async () => clickButton(host, '加载更多'));
    await flush();

    const cards = [...host.querySelectorAll('.creator-work-card')];
    expect(cards.map((card) => card.textContent).join('|')).toContain('第二页观点');
    expect(cards.filter((card) => card.textContent?.includes('第一页观点'))).toHaveLength(1);
    expect(apiMocks.getCreatorWorks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it('ignores a stale load-more response after server filters change', async () => {
    const firstWork = creatorWork('hero:work', 'hero', '旧筛选第一页');
    const staleWork = creatorWork('hero:stale', 'hero', '旧筛选第二页');
    const filteredWork = creatorWork('new:work', 'new', '新筛选结果', 'bearish');
    let resolveStale: ((value: {
      items: CreatorWorkSummary[];
      total: number;
      page: number;
      pageSize: number;
    }) => void) | undefined;
    const stalePage = new Promise<{
      items: CreatorWorkSummary[];
      total: number;
      page: number;
      pageSize: number;
    }>((resolve) => {
      resolveStale = resolve;
    });
    apiMocks.getCreatorAccounts.mockResolvedValue([
      creatorAccount('hero', '天津股侠'),
      creatorAccount('new', '数据新人'),
    ]);
    apiMocks.getCreatorOpinionAnalyses.mockResolvedValue([
      creatorAnalysis('hero', '天津股侠', 74.46),
      creatorAnalysis('new', '数据新人', null),
    ]);
    apiMocks.getCreatorWorks.mockImplementation(async (filters: { creatorId?: string; page?: number }) => {
      if (filters.creatorId === 'new') {
        return { items: [filteredWork], total: 1, page: 1, pageSize: 24 };
      }
      if (filters.page === 2) return stalePage;
      return { items: [firstWork], total: 2, page: 1, pageSize: 24 };
    });
    apiMocks.getCreatorWorkDetail.mockImplementation(async (workKey: string) => {
      const matches = [firstWork, staleWork, filteredWork];
      return detailOf(matches.find((item) => item.workKey === workKey) ?? firstWork);
    });

    const host = await renderView();
    await act(async () => clickButton(host, '加载更多'));
    await act(async () => clickButton(host, '博主排行'));
    await act(async () => clickButton(host, '数据新人'));
    await flush();

    expect(host.textContent).toContain('新筛选结果');
    await act(async () => resolveStale?.({
      items: [staleWork],
      total: 2,
      page: 2,
      pageSize: 24,
    }));
    await flush();

    expect(host.textContent).toContain('新筛选结果');
    expect(host.textContent).not.toContain('旧筛选第二页');
  });

  it('reuses a cached detail when returning to an already opened work', async () => {
    const firstWork = creatorWork('hero:work', 'hero', '第一条观点');
    const secondWork = creatorWork('new:work', 'new', '第二条观点', 'bearish');
    prepareSuccessfulInitialLoad([firstWork, secondWork]);
    const host = await renderView();

    await act(async () => clickButton(host, '第二条观点'));
    await flush();
    await act(async () => clickButton(host, '第一条观点'));
    await flush();

    expect(apiMocks.getCreatorWorkDetail).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('第一条观点的 AI 摘要');
  });

  it('keeps using detail caches after a failed detail has been retried', async () => {
    const firstWork = creatorWork('hero:work', 'hero', '重试观点');
    const secondWork = creatorWork('new:work', 'new', '切换观点', 'bearish');
    prepareSuccessfulInitialLoad([firstWork, secondWork]);
    apiMocks.getCreatorWorkDetail
      .mockRejectedValueOnce(new Error('详情暂时不可用'))
      .mockImplementation(async (workKey: string) =>
        detailOf(workKey === firstWork.workKey ? firstWork : secondWork));
    const host = await renderView();

    expect(host.textContent).toContain('详情暂时不可用');
    await act(async () => clickButton(host, '重新加载详情'));
    await flush();
    await act(async () => clickButton(host, '切换观点'));
    await flush();
    await act(async () => clickButton(host, '重试观点'));
    await flush();

    expect(apiMocks.getCreatorWorkDetail).toHaveBeenCalledTimes(3);
    expect(host.textContent).toContain('重试观点的 AI 摘要');
  });

  it('shows analysis immediately on narrow screens and opens a directory with correct focus restoration', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      media: '(min-width: 960px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const firstWork = creatorWork('hero:work', 'hero', '窄屏观点');
    const secondWork = creatorWork('new:work', 'new', '下一篇窄屏观点');
    prepareSuccessfulInitialLoad([firstWork, secondWork]);
    const host = await renderView();
    const directoryButton = [...host.querySelectorAll('button')].find(
      (item) => item.textContent === '切换作品',
    ) as HTMLButtonElement;

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('.creator-ai-summary')?.textContent).toContain('窄屏观点的 AI 摘要');
    expect(host.querySelector('.creator-work-card')).toBeNull();

    directoryButton.focus();
    await act(async () => directoryButton.click());
    await flush();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await flush();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(directoryButton);

    await act(async () => directoryButton.click());
    await flush();
    await act(async () => clickButton(document.querySelector('[role="dialog"]') as HTMLElement, '下一篇窄屏观点'));
    await flush();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('.creator-ai-summary')?.textContent).toContain('下一篇窄屏观点的 AI 摘要');
    expect(document.activeElement).toBe(host.querySelector('.creator-reading-main'));
  });

  it('moves between analyses with bounded previous and next controls', async () => {
    const firstWork = creatorWork('hero:work', 'hero', '第一篇分析');
    const secondWork = creatorWork('new:work', 'new', '第二篇分析');
    prepareSuccessfulInitialLoad([firstWork, secondWork]);
    const host = await renderView();
    const previous = host.querySelector<HTMLButtonElement>('[aria-label="上一篇分析"]')!;
    const next = host.querySelector<HTMLButtonElement>('[aria-label="下一篇分析"]')!;
    expect(previous.disabled).toBe(true);
    await act(async () => next.click());
    await flush();
    expect(host.querySelector('.creator-ai-summary')?.textContent).toContain('第二篇分析的 AI 摘要');
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);
    await act(async () => previous.click());
    await flush();
    expect(host.querySelector('.creator-ai-summary')?.textContent).toContain('第一篇分析的 AI 摘要');
    expect(apiMocks.getCreatorWorkDetail).toHaveBeenCalledTimes(2);
  });

  it('keeps the analysis visible after loading more fails and clears the error on retry', async () => {
    const firstWork = creatorWork('hero:work', 'hero', '已读分析');
    prepareSuccessfulInitialLoad([firstWork], 30);
    apiMocks.getCreatorWorks.mockReset()
      .mockResolvedValueOnce({ items: [firstWork], total: 30, page: 1, pageSize: 24 })
      .mockRejectedValueOnce(new Error('分页暂时离线'))
      .mockResolvedValueOnce({ items: [firstWork], total: 1, page: 2, pageSize: 24 });
    const host = await renderView();
    await act(async () => clickButton(host, '加载更多'));
    await flush();
    expect(host.textContent).toContain('分页暂时离线');
    expect(host.querySelector('.creator-ai-summary')?.textContent).toContain('已读分析的 AI 摘要');
    await act(async () => clickButton(host, '加载更多'));
    await flush();
    expect(host.textContent).not.toContain('分页暂时离线');
    expect(host.querySelector('.creator-ai-summary')?.textContent).toContain('已读分析的 AI 摘要');
  });
});

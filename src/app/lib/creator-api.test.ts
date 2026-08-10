import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCreatorAccounts,
  getCreatorOpinionAnalyses,
  getCreatorOpinionAnalysis,
  getCreatorWorkDetail,
  getCreatorWorks,
  mapCreatorAccount,
  mapCreatorOpinionAnalysis,
  mapCreatorWorkDetail,
  mapCreatorWorkSummary,
} from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('creator API mappers', () => {
  it('maps list opinions without inventing a detail summary', () => {
    const work = mapCreatorWorkSummary({
      work_key: 'weibo:1',
      creator_id: 'hero',
      creator_name: '天津股侠',
      account_id: 'weibo:1896820725',
      platform: 'weibo',
      title: '商业航天观点',
      content_type: 'post',
      published_at_beijing: '2026-08-09T16:48:06+08:00',
      canonical_url: 'https://weibo.com/1',
      is_a_share_relevant: true,
      status: { status: 'finished' },
      a_share_opinions: [{
        opinion_id: 'weibo:1:1',
        work_key: 'weibo:1',
        market_scope: 'a_share',
        target_type: 'sector',
        target_name: '商业航天',
        direction: 'bullish',
        stance_score: 40,
        claim: '商业航天明天可能冲高',
        conditions: ['发射预期'],
        confidence: 0.8,
        verifiable: true,
      }],
    });

    expect(work).toMatchObject({
      workKey: 'weibo:1',
      creatorId: 'hero',
      creatorName: '天津股侠',
      platform: 'weibo',
      publishedAt: '2026-08-09T16:48:06+08:00',
      status: 'finished',
      isAShareRelevant: true,
    });
    expect(work.summary).toBeUndefined();
    expect(work.opinions[0]).toMatchObject({
      opinionId: 'weibo:1:1',
      targetName: '商业航天',
      direction: 'bullish',
      stanceScore: 40,
      conditions: ['发射预期'],
      confidence: 0.8,
      verifiable: true,
    });
  });

  it('keeps complete analysis and source fields only in the work detail', () => {
    const work = mapCreatorWorkDetail({
      work_key: 'douyin:7',
      creator_id: 'savage',
      creator_name: '全能的野人',
      platform: 'douyin',
      title: '下周交易模式',
      published_at_beijing: '2026-08-09T18:19:17+08:00',
      canonical_url: 'https://www.douyin.com/video/7',
      analysis: {
        summary: '作者提出进攻、防守和观望三种策略。',
        analysis_model: 'qwen3.7-max',
        analyzed_at: '2026-08-09T11:05:11.551',
      },
      source_text: '原始正文',
      extracted_text: '提取文本',
      asr_text: '语音文本',
      ocr_text: '字幕文本',
      a_share_opinions: [],
    });

    expect(work).toMatchObject({
      summary: '作者提出进攻、防守和观望三种策略。',
      analysisModel: 'qwen3.7-max',
      analyzedAt: '2026-08-09T11:05:11.551',
      sourceText: '原始正文',
      extractedText: '提取文本',
      asrText: '语音文本',
      ocrText: '字幕文本',
    });
  });

  it('preserves null accuracy, numeric scores, and unknown verdicts', () => {
    const analysis = mapCreatorOpinionAnalysis({
      creator_id: 'hero',
      creator_name: '天津股侠',
      accuracy_score: null,
      verified_opinions: [
        {
          opinion_id: 'a',
          work_key: 'weibo:1',
          platform: 'weibo',
          target_type: 'sector',
          target_name: '商业航天',
          direction: 'bullish',
          opinion: '商业航天可能冲高',
          verdict: 'corroborated',
          score: 1,
        },
        {
          opinion_id: 'b',
          work_key: 'weibo:2',
          verdict: 'new_backend_status',
          score: null,
        },
      ],
      pending_opinions: null,
    });

    expect(analysis.accuracyScore).toBeNull();
    expect(analysis.verifiedOpinions.map((item) => [item.verdict, item.score])).toEqual([
      ['corroborated', 1],
      ['new_backend_status', null],
    ]);
    expect(analysis.pendingOpinions).toEqual([]);
  });

  it('maps creator account identity without converting review status', () => {
    expect(mapCreatorAccount({
      rank: 7,
      creator_id: 'tang_hao',
      display_name: '唐昊（唐主任）',
      platform: 'douyin',
      account_key: 'douyin:tangzhuren',
      homepage_url: 'https://www.douyin.com/user/example',
      enabled: true,
      verification_status: 'needs_review',
      notes: '财经身份需要复核。',
    })).toEqual({
      rank: 7,
      creatorId: 'tang_hao',
      displayName: '唐昊（唐主任）',
      platform: 'douyin',
      accountKey: 'douyin:tangzhuren',
      platformAccountId: '',
      handle: '',
      alias: '',
      homepageUrl: 'https://www.douyin.com/user/example',
      enabled: true,
      verificationStatus: 'needs_review',
      notes: '财经身份需要复核。',
    });
  });
});

describe('creator API requests', () => {
  it('sends fixed A-share filters together with encoded list filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [],
      total: 31,
      page: 2,
      page_size: 24,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCreatorWorks({
      creatorId: 'hero id',
      platform: 'weibo',
      keyword: '商业 航天',
      startTime: '2026-08-07T00:00:00.000Z',
      endTime: '2026-08-10T00:00:00.000Z',
      page: 2,
      pageSize: 24,
    })).resolves.toEqual({
      items: [],
      total: 31,
      page: 2,
      pageSize: 24,
    });

    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
    expect(url.pathname).toBe('/backend-api/api/v1/creator-works');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      creator_id: 'hero id',
      platform: 'weibo',
      keyword: '商业 航天',
      page: '2',
      page_size: '24',
      is_a_share_relevant: 'true',
      status: 'finished',
    });
  });

  it('URL-encodes a work key and unwraps its detail response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        work_key: 'douyin:7',
        creator_id: 'savage',
        analysis: { summary: '详情摘要' },
        a_share_opinions: [],
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getCreatorWorkDetail('douyin:7');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/creator-works/douyin%3A7');
    expect(result).toMatchObject({ workKey: 'douyin:7', summary: '详情摘要' });
  });

  it('maps account and analysis collections at the request boundary', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ creator_id: 'hero', display_name: '天津股侠', enabled: true }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ creator_id: 'hero', accuracy_score: 74.46 }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const accounts = await getCreatorAccounts();
    const analyses = await getCreatorOpinionAnalyses();

    expect(accounts[0]).toMatchObject({ creatorId: 'hero', displayName: '天津股侠' });
    expect(analyses[0]).toMatchObject({ creatorId: 'hero', accuracyScore: 74.46 });
  });

  it('returns null only when a creator analysis detail is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCreatorOpinionAnalysis('missing:creator')).resolves.toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/creator-opinion-analyses/missing%3Acreator',
    );
  });
});

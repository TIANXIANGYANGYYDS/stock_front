import { describe, expect, it } from 'vitest';
import type {
  CreatorOpinion,
  CreatorOpinionAnalysis,
  CreatorWorkDetail,
  CreatorWorkSummary,
  VerifiedCreatorOpinion,
} from '../../lib/api';
import {
  appendUniqueWorks,
  buildCreatorRankingItems,
  chooseCreatorSourceText,
  creatorTimeRange,
  filterWorksByDirection,
  mergeOpinionVerification,
  verificationPresentation,
} from './creator-opinion-state';

function verifiedOpinion(
  opinionId: string,
  score: number | null,
  verdict: string | null = score === null ? 'unverified' : 'corroborated',
): VerifiedCreatorOpinion {
  return {
    opinionId,
    workKey: 'work:' + opinionId,
    platform: 'weibo',
    publishedAt: '2026-08-01T09:00:00+08:00',
    targetType: 'sector',
    targetName: '半导体',
    direction: 'bullish',
    opinion: '半导体走强',
    verificationDate: '2026-08-02',
    verifiedAt: score === null ? '' : '2026-08-02T15:30:00+08:00',
    verdict,
    score,
    reason: score === null ? '证据不足' : '走势得到验证',
  };
}

function analysis(
  creatorId: string,
  creatorName: string,
  accuracyScore: number | null,
  scores: Array<number | null>,
  pendingCount = 0,
): CreatorOpinionAnalysis {
  return {
    creatorId,
    creatorName,
    accuracyScore,
    verifiedOpinions: scores.map((score, index) =>
      verifiedOpinion(creatorId + '-verified-' + index, score)),
    pendingOpinions: Array.from({ length: pendingCount }, (_, index) =>
      verifiedOpinion(creatorId + '-pending-' + index, null, null)),
  };
}

function opinion(
  opinionId: string,
  direction: string,
  claim = '观点正文',
): CreatorOpinion {
  return {
    opinionId,
    workKey: 'work:' + opinionId,
    marketScope: 'a_share',
    targetType: 'sector',
    targetId: null,
    targetName: '半导体',
    direction,
    stanceScore: 60,
    claim,
    horizon: '1天',
    validFrom: '2026-08-09T09:00:00+08:00',
    validUntil: '2026-08-10T15:00:00+08:00',
    metric: '板块涨跌幅',
    conditions: [],
    confidence: 0.8,
    verifiable: true,
    sourceQuote: '原话',
    verificationDate: '2026-08-10',
  };
}

function work(
  workKey: string,
  opinions: CreatorOpinion[],
  title = workKey,
): CreatorWorkSummary {
  return {
    workKey,
    creatorId: 'hero',
    creatorName: '天津股侠',
    accountId: 'weibo:hero',
    platform: 'weibo',
    title,
    contentType: 'post',
    publishedAt: '2026-08-09T16:00:00+08:00',
    canonicalUrl: 'https://weibo.com/' + workKey,
    status: 'finished',
    isAShareRelevant: true,
    opinions,
  };
}

describe('creator ranking rules', () => {
  it('uses only numeric verification scores and sorts null accuracy last', () => {
    const rows = buildCreatorRankingItems([
      analysis('few-perfect', '少样本满分', 100, [1, null], 3),
      analysis('deep-sample', '稳定样本', 74.46, Array.from({ length: 20 }, () => 1), 8),
      analysis('accumulating', '积累中', null, [], 2),
    ]);

    expect(rows.map((row) => row.creatorId)).toEqual([
      'few-perfect',
      'deep-sample',
      'accumulating',
    ]);
    expect(rows[0]).toMatchObject({
      rank: 1,
      effectiveSamples: 1,
      pendingCount: 3,
      smallSample: true,
    });
    expect(rows[1]).toMatchObject({
      rank: 2,
      effectiveSamples: 20,
      smallSample: false,
    });
    expect(rows[2]).toMatchObject({
      rank: null,
      accuracyScore: null,
    });
  });

  it('breaks equal accuracy ties with more effective samples', () => {
    const rows = buildCreatorRankingItems([
      analysis('small', '小样本', 80, [1]),
      analysis('large', '大样本', 80, [1, 0.5, -1, 1, 1]),
    ]);

    expect(rows.map((row) => row.creatorId)).toEqual(['large', 'small']);
  });
});

describe('creator verification and time presentation', () => {
  it('maps every known verdict and preserves an unknown backend state', () => {
    expect(verificationPresentation('corroborated')).toMatchObject({ label: '命中', tone: 'positive' });
    expect(verificationPresentation('partially_corroborated')).toMatchObject({ label: '部分命中', tone: 'partial' });
    expect(verificationPresentation('contradicted')).toMatchObject({ label: '观点相反', tone: 'negative' });
    expect(verificationPresentation('not_triggered')).toMatchObject({ label: '条件未触发', tone: 'muted' });
    expect(verificationPresentation('unverified')).toMatchObject({ label: '证据不足', tone: 'muted' });
    expect(verificationPresentation(null)).toMatchObject({ label: '等待验证', tone: 'pending' });
    expect(verificationPresentation('backend_new')).toEqual({
      label: '待识别状态',
      tone: 'pending',
      raw: 'backend_new',
    });
  });

  it('builds fixed rolling UTC ranges and leaves all-time unbounded', () => {
    const now = new Date('2026-08-10T08:00:00.000Z');

    expect(creatorTimeRange('24h', now)).toEqual({
      startTime: '2026-08-09T08:00:00.000Z',
      endTime: '2026-08-10T08:00:00.000Z',
    });
    expect(creatorTimeRange('3d', now)).toEqual({
      startTime: '2026-08-07T08:00:00.000Z',
      endTime: '2026-08-10T08:00:00.000Z',
    });
    expect(creatorTimeRange('all', now)).toEqual({});
  });
});

describe('creator work collection rules', () => {
  it('filters a work when any nested opinion matches the direction', () => {
    const bullish = work('bullish', [opinion('a', 'bullish')]);
    const mixed = work('mixed', [opinion('b', 'neutral'), opinion('c', 'bearish')]);

    expect(filterWorksByDirection([bullish, mixed], 'bearish').map((item) => item.workKey))
      .toEqual(['mixed']);
    expect(filterWorksByDirection([bullish, mixed], 'all')).toEqual([bullish, mixed]);
  });

  it('replaces duplicate keys without moving existing rows and appends new rows', () => {
    const originalA = work('a', [], '旧标题');
    const replacementA = work('a', [], '新标题');
    const b = work('b', []);
    const c = work('c', []);

    expect(appendUniqueWorks([originalA, b], [replacementA, c]).map((item) => [
      item.workKey,
      item.title,
    ])).toEqual([
      ['a', '新标题'],
      ['b', 'b'],
      ['c', 'c'],
    ]);
  });
});

describe('creator detail rules', () => {
  it('chooses source text before extraction, ASR, and OCR', () => {
    const detail = {
      sourceText: '原始正文',
      extractedText: '提取正文',
      asrText: '语音正文',
      ocrText: '字幕正文',
    } as CreatorWorkDetail;

    expect(chooseCreatorSourceText(detail)).toEqual({
      label: '原始正文',
      text: '原始正文',
    });
    expect(chooseCreatorSourceText({
      ...detail,
      sourceText: '',
      extractedText: '',
    })).toEqual({
      label: '语音转写 ASR',
      text: '语音正文',
    });
    expect(chooseCreatorSourceText({
      ...detail,
      sourceText: '',
      extractedText: '',
      asrText: '',
      ocrText: '',
    })).toEqual({
      label: '暂无可读原文',
      text: '',
    });
  });

  it('joins verified and pending records to their opinion IDs', () => {
    const first = opinion('first', 'bullish');
    const second = opinion('second', 'bearish');
    const creatorAnalysis: CreatorOpinionAnalysis = {
      creatorId: 'hero',
      creatorName: '天津股侠',
      accuracyScore: 74.46,
      verifiedOpinions: [verifiedOpinion('first', 1)],
      pendingOpinions: [verifiedOpinion('second', null, null)],
    };

    const rows = mergeOpinionVerification([first, second], creatorAnalysis);

    expect(rows[0]).toMatchObject({
      opinion: { opinionId: 'first' },
      verification: { score: 1, verdict: 'corroborated' },
      pending: null,
    });
    expect(rows[1]).toMatchObject({
      opinion: { opinionId: 'second' },
      verification: null,
      pending: { opinionId: 'second' },
    });
  });
});

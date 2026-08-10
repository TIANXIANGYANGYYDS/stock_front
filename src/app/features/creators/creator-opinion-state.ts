import type {
  CreatorOpinion,
  CreatorOpinionAnalysis,
  CreatorWorkDetail,
  CreatorWorkSummary,
  VerifiedCreatorOpinion,
} from '../../lib/api';

export type CreatorTimeWindow = '24h' | '3d' | '7d' | 'all';
export type CreatorDirectionFilter = 'all' | 'bullish' | 'bearish' | 'neutral';
export type VerificationTone = 'positive' | 'partial' | 'negative' | 'muted' | 'pending';

export interface CreatorRankingItem {
  creatorId: string;
  creatorName: string;
  accuracyScore: number | null;
  effectiveSamples: number;
  pendingCount: number;
  rank: number | null;
  smallSample: boolean;
  analysis: CreatorOpinionAnalysis;
}

export interface VerificationPresentation {
  label: string;
  tone: VerificationTone;
  raw?: string;
}

export interface CreatorSourceText {
  label: string;
  text: string;
}

export interface CreatorOpinionWithVerification {
  opinion: CreatorOpinion;
  verification: VerifiedCreatorOpinion | null;
  pending: VerifiedCreatorOpinion | null;
}

export function effectiveSampleCount(analysis: CreatorOpinionAnalysis): number {
  return analysis.verifiedOpinions.filter(
    (item) => item.score !== null && Number.isFinite(item.score),
  ).length;
}

export function buildCreatorRankingItems(
  analyses: CreatorOpinionAnalysis[],
): CreatorRankingItem[] {
  const sorted = analyses
    .map((analysis) => ({
      creatorId: analysis.creatorId,
      creatorName: analysis.creatorName,
      accuracyScore: analysis.accuracyScore,
      effectiveSamples: effectiveSampleCount(analysis),
      pendingCount: analysis.pendingOpinions.length,
      rank: null,
      smallSample: false,
      analysis,
    }))
    .sort((left, right) => {
      if (left.accuracyScore === null && right.accuracyScore === null) {
        return left.creatorName.localeCompare(right.creatorName, 'zh-CN');
      }
      if (left.accuracyScore === null) return 1;
      if (right.accuracyScore === null) return -1;
      return right.accuracyScore - left.accuracyScore
        || right.effectiveSamples - left.effectiveSamples
        || left.creatorName.localeCompare(right.creatorName, 'zh-CN');
    });

  let scoredRank = 0;
  return sorted.map((item) => {
    if (item.accuracyScore === null) return item;
    scoredRank += 1;
    return {
      ...item,
      rank: scoredRank,
      smallSample: item.effectiveSamples < 5,
    };
  });
}

export function verificationPresentation(verdict: string | null): VerificationPresentation {
  const known: Record<string, VerificationPresentation> = {
    corroborated: { label: '命中', tone: 'positive' },
    partially_corroborated: { label: '部分命中', tone: 'partial' },
    contradicted: { label: '观点相反', tone: 'negative' },
    not_triggered: { label: '条件未触发', tone: 'muted' },
    unverified: { label: '证据不足', tone: 'muted' },
  };
  if (!verdict) return { label: '等待验证', tone: 'pending' };
  return known[verdict] ?? { label: '待识别状态', tone: 'pending', raw: verdict };
}

export function creatorTimeRange(
  window: CreatorTimeWindow,
  now = new Date(),
): { startTime?: string; endTime?: string } {
  if (window === 'all') return {};
  const days = window === '24h' ? 1 : window === '3d' ? 3 : 7;
  const endTime = now.toISOString();
  const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  return { startTime, endTime };
}

export function filterWorksByDirection(
  works: CreatorWorkSummary[],
  direction: CreatorDirectionFilter,
): CreatorWorkSummary[] {
  if (direction === 'all') return works;
  return works.filter((work) =>
    work.opinions.some((opinion) => opinion.direction === direction));
}

export function appendUniqueWorks(
  current: CreatorWorkSummary[],
  incoming: CreatorWorkSummary[],
): CreatorWorkSummary[] {
  const next = [...current];
  const indexes = new Map(next.map((item, index) => [item.workKey, index]));
  incoming.forEach((item) => {
    const existingIndex = indexes.get(item.workKey);
    if (existingIndex === undefined) {
      indexes.set(item.workKey, next.length);
      next.push(item);
      return;
    }
    next[existingIndex] = item;
  });
  return next;
}

export function chooseCreatorSourceText(
  work: Pick<CreatorWorkDetail, 'sourceText' | 'extractedText' | 'asrText' | 'ocrText'>,
): CreatorSourceText {
  const sources = [
    { label: '原始正文', text: work.sourceText },
    { label: '提取文本', text: work.extractedText },
    { label: '语音转写 ASR', text: work.asrText },
    { label: '画面文字 OCR', text: work.ocrText },
  ];
  return sources.find((source) => source.text.trim())
    ?? { label: '暂无可读原文', text: '' };
}

export function mergeOpinionVerification(
  opinions: CreatorOpinion[],
  analysis: CreatorOpinionAnalysis | null | undefined,
): CreatorOpinionWithVerification[] {
  const verified = new Map(
    (analysis?.verifiedOpinions ?? []).map((item) => [item.opinionId, item]),
  );
  const pending = new Map(
    (analysis?.pendingOpinions ?? []).map((item) => [item.opinionId, item]),
  );

  return opinions.map((item) => ({
    opinion: item,
    verification: verified.get(item.opinionId) ?? null,
    pending: pending.get(item.opinionId) ?? null,
  }));
}

import type { MainlineSector, PreopenAnalysisResponse } from '../../lib/api';

const EMPTY_MAIN_LINES: MainlineSector[] = [];

type MarketAnalysisSource = Pick<PreopenAnalysisResponse, 'mainLines' | 'analysisText'>;

export function resolveMainLines(analysis: MarketAnalysisSource | null): MainlineSector[] {
  return analysis?.mainLines ?? EMPTY_MAIN_LINES;
}

export function analysisAdviceText(analysis: MarketAnalysisSource | null): string | null {
  const text = analysis?.analysisText?.trim();
  return text || null;
}

import { LATEST_MARKET_POOL_NAME } from './constants';

const DEFAULT_API_BASE_URL = '/backend-api';
const NEWS_PAGE_SIZE = 200;

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  DEFAULT_API_BASE_URL;

type QueryValue = string | number | boolean | null | undefined;
export type NewsWindowDays = 1 | 3 | 7;
export type RankingWindow = 'hour' | 'day' | '3day' | '7day';

interface RequestOptions {
  signal?: AbortSignal;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function requestJson<T>(
  path: string,
  params?: Record<string, QueryValue>,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}${buildQuery(params)}`, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = (await response.json()) as { detail?: unknown };
      detail = toText(payload.detail);
    } catch {
      detail = '';
    }
    throw new ApiRequestError(
      response.status,
      `接口请求失败: ${response.status}${detail ? ` · ${detail}` : ''}`,
    );
  }

  return (await response.json()) as T;
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNumber(value: unknown, fallback = 0): number {
  return toNullableNumber(value) ?? fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[、,，;；|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const date = new Date(timestamp * 1000);
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function dateFromTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function tradeDateUnixRange(
  tradeDate: string,
  days: NewsWindowDays = 1,
): { startTs: number; endTs: number } | null {
  if (!tradeDate || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) return null;
  const anchorStartTs = Math.floor(Date.parse(`${tradeDate}T00:00:00+08:00`) / 1000);
  if (!Number.isFinite(anchorStartTs)) return null;
  const daySeconds = 24 * 60 * 60;
  return {
    startTs: anchorStartTs - (days - 1) * daySeconds,
    endTs: anchorStartTs + daySeconds - 1,
  };
}

function splitReason(reason: string): string[] {
  return reason
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeSentiment(score: unknown): Sentiment {
  const value = toNullableNumber(score) ?? 0;
  if (value > 20) return 'positive';
  if (value < -20) return 'negative';
  return 'neutral';
}

function calcPercent(current: number, total: number): number {
  return total > 0 ? (current / total) * 100 : 0;
}

function isValidDailyBar(bar: RawStockProjectDailyBar): boolean {
  const values = [bar.open, bar.high, bar.low, bar.close].map(toNullableNumber);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toText(bar.trade_date))) return false;
  if (values.some((value) => value === null || value <= 0)) return false;
  const [open, high, low, close] = values as number[];
  return high >= Math.max(open, close) && low <= Math.min(open, close);
}

function roleLabel(role: unknown): string {
  const labels: Record<string, string> = {
    main_attack: '主攻方向',
    secondary_attack: '次攻方向',
    event_branch: '事件分支',
    defensive: '防御方向',
    watch: '观察方向',
  };
  return labels[toText(role)] || '观察方向';
}

export type Sentiment = 'positive' | 'negative' | 'neutral';
export interface MovingAverages {
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma30: number | null;
  ma60: number | null;
}

export interface VolumeMovingAverages {
  volMa5: number | null;
  volMa10: number | null;
  volMa20: number | null;
  volMa60: number | null;
}

export interface MacdIndicators {
  dif: number | null;
  dea: number | null;
  hist: number | null;
}

export interface BollIndicators {
  mid: number | null;
  upper: number | null;
  lower: number | null;
}

export interface KdjIndicators {
  k: number | null;
  d: number | null;
  j: number | null;
}

export interface RsiIndicators {
  rsi6: number | null;
  rsi12: number | null;
  rsi24: number | null;
}

export interface CciIndicators {
  cci14: number | null;
}

export interface WrIndicators {
  wr6: number | null;
  wr10: number | null;
  wr14: number | null;
}

export interface AtrIndicators {
  atr14: number | null;
}

export interface ChipCostRange {
  low: number | null;
  high: number | null;
  concentration: number | null;
}

export interface ChipChartData {
  x: number[];
  y: number[];
}

export interface ChipIndicators {
  profitRatio: number | null;
  avgCost: number | null;
  cost90: ChipCostRange | null;
  cost70: ChipCostRange | null;
  chart: ChipChartData | null;
}

export interface RawStockProjectSectorAnalysis {
  sector_name?: string;
  sector_llm_analysis?: {
    score?: number;
    reason?: string;
    companies?: unknown;
  } | null;
}

export interface RawStockProjectNews {
  event_id?: string;
  publish_ts?: number;
  publish_time?: string;
  source?: string;
  title?: string;
  content?: string;
  status?: { status?: string; reason?: string } | string;
  sector_llm_analysis?: RawStockProjectSectorAnalysis[] | null;
}

export interface RawStockProjectRanking {
  rank?: number;
  sector_name?: string;
  final_score?: number;
  news_count?: number;
  positive_news_count?: number;
  negative_news_count?: number;
  neutral_news_count?: number;
  latest_publish_ts?: number | null;
}

export interface RawStockProjectDailyBar {
  trade_date?: string;
  code?: string;
  name?: string;
  open?: number;
  close?: number;
  high?: number;
  low?: number;
  volume?: number;
  amount?: number;
  amplitude_pct?: number;
  pct_chg?: number;
  change_amount?: number;
  turnover_pct?: number;
  updated_at?: string;
  ma?: {
    ma5?: number | null;
    ma10?: number | null;
    ma20?: number | null;
    ma30?: number | null;
    ma60?: number | null;
  } | null;
  volume_ma?: {
    vol_ma5?: number | null;
    vol_ma10?: number | null;
    vol_ma20?: number | null;
    vol_ma60?: number | null;
  } | null;
  macd?: {
    dif?: number | null;
    dea?: number | null;
    hist?: number | null;
  } | null;
  boll?: {
    mid?: number | null;
    upper?: number | null;
    lower?: number | null;
  } | null;
  kdj?: {
    k?: number | null;
    d?: number | null;
    j?: number | null;
  } | null;
  rsi?: {
    rsi6?: number | null;
    rsi12?: number | null;
    rsi24?: number | null;
  } | null;
  cci?: { cci14?: number | null } | null;
  wr?: {
    wr6?: number | null;
    wr10?: number | null;
    wr14?: number | null;
  } | null;
  atr?: { atr14?: number | null } | null;
  chip?: {
    profit_ratio?: number | null;
    avg_cost?: number | null;
    cost_90?: {
      low?: number | null;
      high?: number | null;
      concentration?: number | null;
    } | null;
    cost_70?: {
      low?: number | null;
      high?: number | null;
      concentration?: number | null;
    } | null;
    chart?: {
      x?: unknown[] | null;
      y?: unknown[] | null;
    } | null;
  } | null;
}

interface PagedResponse<T> {
  items?: T[];
  total?: number;
  page?: number;
  page_size?: number;
}

interface DetailResponse<T> {
  data?: T;
}

interface RawStockSummary {
  code?: string;
  name?: string;
  latest_trade_date?: string;
  latest_close?: number;
}

interface RawRankingSnapshot {
  snapshot_id?: string;
  biz_date?: string;
  generated_at?: string;
  investment_ranking?: RawStockProjectRanking[];
  heat_ranking?: RawStockProjectRanking[];
}

interface RawStatsResponse {
  news?: { total?: number };
  stocks?: {
    document_count?: number;
    stock_count?: number;
  };
}

interface RawLatestTradeDateResponse {
  data?: {
    latest_trade_date?: string | null;
  } | null;
}

interface RawMorningMainline {
  rank?: number;
  sector_name?: string;
  role?: string;
  confidence?: number;
  reason?: string;
  risks?: unknown;
}

interface RawMorningAnalysis {
  analysis_date?: string;
  trade_date?: string;
  data_quality?: string;
  analysis?: {
    market_bias?: string;
    risk_level?: string;
    risk_summary?: string;
    market_style?: string;
    mainlines?: RawMorningMainline[];
  };
}

export interface RawRealtimeMarketIndex {
  symbol?: unknown;
  name?: unknown;
  market?: unknown;
  price?: unknown;
  previous_close?: unknown;
  change?: unknown;
  change_pct?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  volume?: unknown;
  amount?: unknown;
  source_time?: unknown;
  received_at?: unknown;
  status?: unknown;
  provider?: unknown;
}

interface RawRealtimeMarketIndicesData {
  trading_date?: unknown;
  market_status?: unknown;
  updated_at?: unknown;
  cache_age_ms?: unknown;
  items?: RawRealtimeMarketIndex[] | null;
}

export interface RawRealtimeStockQuote {
  code?: unknown;
  name?: unknown;
  market?: unknown;
  trade_date?: unknown;
  interval?: unknown;
  timestamp?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  volume?: unknown;
  amount?: unknown;
  provider?: unknown;
}

interface RawRealtimeStocksData {
  trading_date?: unknown;
  market_status?: unknown;
  interval?: unknown;
  items?: RawRealtimeStockQuote[] | null;
  missing_codes?: unknown;
}

interface RealtimeDataResponse<T> {
  data?: T | null;
}

export interface RawCreatorAccount {
  rank?: number;
  creator_id?: string;
  display_name?: string;
  platform?: string;
  account_key?: string;
  platform_account_id?: string;
  homepage_url?: string;
  handle?: string;
  alias?: string;
  enabled?: boolean;
  verification_status?: string;
  notes?: string;
}

export interface RawCreatorOpinion {
  opinion_id?: string;
  work_key?: string;
  market_scope?: string;
  target_type?: string;
  target_id?: string | null;
  target_name?: string;
  direction?: string;
  stance_score?: number | string | null;
  claim?: string;
  opinion?: string;
  horizon?: string;
  valid_from?: string;
  valid_until?: string | null;
  metric?: string | null;
  conditions?: unknown;
  confidence?: number | string | null;
  verifiable?: boolean | null;
  source_quote?: string;
  verification_date?: string | null;
}

export interface RawVerifiedCreatorOpinion {
  opinion_id?: string;
  work_key?: string;
  platform?: string;
  published_at_beijing?: string;
  target_type?: string;
  target_name?: string;
  direction?: string;
  opinion?: string;
  verification_date?: string | null;
  verified_at_beijing?: string | null;
  verdict?: string | null;
  score?: number | string | null;
  reason?: string | null;
}

export interface RawCreatorWork {
  work_key?: string;
  a_share_opinions?: RawCreatorOpinion[] | null;
  account_id?: string;
  analysis?: {
    summary?: string;
    analysis_model?: string;
    analyzed_at?: string;
  } | null;
  asr_text?: string;
  canonical_url?: string;
  content_type?: string;
  creator_id?: string;
  creator_name?: string;
  duration_ms?: number | string | null;
  extracted_text?: string;
  is_a_share_relevant?: boolean;
  media_url?: string;
  ocr_text?: string;
  platform?: string;
  published_at?: string;
  published_at_beijing?: string;
  source_text?: string;
  status?: { status?: string; reason?: string | null } | string | null;
  title?: string;
}

export interface RawCreatorOpinionAnalysis {
  creator_id?: string;
  creator_name?: string;
  accuracy_score?: number | string | null;
  verified_opinions?: RawVerifiedCreatorOpinion[] | null;
  pending_opinions?: RawVerifiedCreatorOpinion[] | null;
}

export interface CreatorAccount {
  rank: number;
  creatorId: string;
  displayName: string;
  platform: string;
  accountKey: string;
  platformAccountId: string;
  handle: string;
  alias: string;
  homepageUrl: string;
  enabled: boolean;
  verificationStatus: string;
  notes: string;
}

export interface CreatorOpinion {
  opinionId: string;
  workKey: string;
  marketScope: string;
  targetType: string;
  targetId: string | null;
  targetName: string;
  direction: string;
  stanceScore: number | null;
  claim: string;
  horizon: string;
  validFrom: string;
  validUntil: string;
  metric: string;
  conditions: string[];
  confidence: number | null;
  verifiable: boolean | null;
  sourceQuote: string;
  verificationDate: string;
}

export interface CreatorWorkSummary {
  workKey: string;
  creatorId: string;
  creatorName: string;
  accountId: string;
  platform: string;
  title: string;
  contentType: string;
  publishedAt: string;
  canonicalUrl: string;
  status: string;
  isAShareRelevant: boolean;
  opinions: CreatorOpinion[];
  summary?: string;
}

export interface CreatorWorkDetail extends CreatorWorkSummary {
  summary: string;
  analysisModel: string;
  analyzedAt: string;
  sourceText: string;
  extractedText: string;
  asrText: string;
  ocrText: string;
  mediaUrl: string;
  durationMs: number | null;
}

export interface VerifiedCreatorOpinion {
  opinionId: string;
  workKey: string;
  platform: string;
  publishedAt: string;
  targetType: string;
  targetName: string;
  direction: string;
  opinion: string;
  verificationDate: string;
  verifiedAt: string;
  verdict: string | null;
  score: number | null;
  reason: string;
}

export interface CreatorOpinionAnalysis {
  creatorId: string;
  creatorName: string;
  accuracyScore: number | null;
  verifiedOpinions: VerifiedCreatorOpinion[];
  pendingOpinions: VerifiedCreatorOpinion[];
}

export interface CreatorWorkFilters {
  creatorId?: string;
  platform?: string;
  keyword?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatorWorkResponse {
  items: CreatorWorkSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  time: string;
  publishTime?: string;
  publishTs?: number;
  author: string;
  sentiment: Sentiment;
  relatedStocks: string[];
  relatedSectors?: string[];
  impact: number;
  keyPoints: string[];
  analysisReason?: string;
  subjects?: string[];
}

export interface NewsPagination {
  page: number;
  page_size: number;
  total: number;
  returned: number;
}

export interface NewsResponse {
  tradeDate: string;
  items: NewsItem[];
  pagination: NewsPagination;
}

export interface NewsSentimentOverview {
  tradeDate: string;
  positivePercent: number;
  positiveDelta: number;
  neutralPercent: number;
  neutralDelta: number;
  negativePercent: number;
  negativeDelta: number;
  counts?: {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  };
}

export interface MarketTickerItem {
  name: string;
  code: string;
  value: number | null;
  changePercent: number | null;
  changeValue: number | null;
}

export interface MarketOverviewResponse {
  tradeDate: string;
  updatedAt: string;
  items: MarketTickerItem[];
  stockCount: number;
  newsCount: number;
}

export interface MarketIndexQuote {
  symbol: string;
  name: string;
  market: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  amount: number | null;
  sourceTime: string;
  receivedAt: string;
  status: string;
  provider: string;
}

export interface RealtimeMarketIndicesResponse {
  tradingDate: string;
  marketStatus: string;
  updatedAt: string;
  cacheAgeMs: number | null;
  items: MarketIndexQuote[];
}

export interface RealtimeStockQuote {
  code: string;
  name: string;
  market: string;
  tradeDate: string;
  interval: string;
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  amount: number | null;
  provider: string;
}

export interface RealtimeStocksResponse {
  tradingDate: string;
  marketStatus: string;
  interval: string;
  items: RealtimeStockQuote[];
  missingCodes: string[];
}

export interface StockListItem {
  code: string;
  name: string;
  tradeDate: string;
  close: number | null;
  changePercent: number | null;
  amount: number | null;
}

export interface MainlineSector {
  rank: number;
  title: string;
  priority: 'high' | 'medium' | 'low';
  role?: string;
  confidence?: number;
  reason: string;
  risks?: string[];
}

export interface PreopenAnalysisResponse {
  date: string;
  tradeDate: string;
  analysisText: string;
  mainLines: MainlineSector[];
  marketStyle?: string;
  riskLevel?: string;
  riskSummary?: string;
}

export interface TrendItem {
  rank: number;
  name: string;
  score: number;
  change: number;
  trend: 'up' | 'down';
  newsCount?: number;
}

export interface TrendSeries {
  name: string;
  data: Array<{ date: string; value: number }>;
}

export interface SectorTrendResponse {
  bizDate: string;
  items: TrendItem[];
  series: TrendSeries[];
}

export interface HeatmapItem {
  rank: number;
  name: string;
  count: number;
  growth: number;
  avgSentiment: Sentiment;
  score?: number;
}

export interface NewsHeatmapResponse {
  bizDate: string;
  items: HeatmapItem[];
  series: TrendSeries[];
}

export interface StockKlineBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  amount?: number | null;
  volume?: number | null;
  changeAmount?: number | null;
  changePercent?: number | null;
  amplitudePercent?: number | null;
  turnoverPercent?: number | null;
  ma?: MovingAverages | null;
  volumeMa?: VolumeMovingAverages | null;
  macd?: MacdIndicators | null;
  boll?: BollIndicators | null;
  kdj?: KdjIndicators | null;
  rsi?: RsiIndicators | null;
  cci?: CciIndicators | null;
  wr?: WrIndicators | null;
  atr?: AtrIndicators | null;
  chip?: ChipIndicators | null;
}

export interface SectorStock {
  code: string;
  name: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changeAmount: number | null;
  changePercent: number | null;
  amplitudePercent: number | null;
  amount: number | null;
  volume: number | null;
  turnoverPercent: number | null;
  ma: MovingAverages | null;
  volumeMa: VolumeMovingAverages | null;
  macd: MacdIndicators | null;
  boll: BollIndicators | null;
  kdj: KdjIndicators | null;
  rsi: RsiIndicators | null;
  cci: CciIndicators | null;
  wr: WrIndicators | null;
  atr: AtrIndicators | null;
  chip: ChipIndicators | null;
  kline?: StockKlineBar[];
}

export interface SectorStocksResponse {
  sectorName: string;
  tradeDate: string;
  items: SectorStock[];
}

export interface MappedStockProjectRanking {
  rank: number;
  name: string;
  score: number;
  newsCount: number;
  sentiment: Sentiment;
  date: string;
}

export function mapRealtimeMarketIndex(
  raw: RawRealtimeMarketIndex,
): MarketIndexQuote {
  return {
    symbol: toText(raw.symbol),
    name: toText(raw.name, toText(raw.symbol, '未知指数')),
    market: toText(raw.market),
    price: toNullableNumber(raw.price),
    previousClose: toNullableNumber(raw.previous_close),
    change: toNullableNumber(raw.change),
    changePercent: toNullableNumber(raw.change_pct),
    open: toNullableNumber(raw.open),
    high: toNullableNumber(raw.high),
    low: toNullableNumber(raw.low),
    volume: toNullableNumber(raw.volume),
    amount: toNullableNumber(raw.amount),
    sourceTime: toText(raw.source_time),
    receivedAt: toText(raw.received_at),
    status: toText(raw.status, 'unknown'),
    provider: toText(raw.provider, 'unknown'),
  };
}

export function mapRealtimeStockQuote(
  raw: RawRealtimeStockQuote,
): RealtimeStockQuote {
  return {
    code: toText(raw.code),
    name: toText(raw.name, toText(raw.code, '未知股票')),
    market: toText(raw.market),
    tradeDate: toText(raw.trade_date),
    interval: toText(raw.interval, '1m'),
    timestamp: toText(raw.timestamp),
    open: toNullableNumber(raw.open),
    high: toNullableNumber(raw.high),
    low: toNullableNumber(raw.low),
    close: toNullableNumber(raw.close),
    volume: toNullableNumber(raw.volume),
    amount: toNullableNumber(raw.amount),
    provider: toText(raw.provider, 'unknown'),
  };
}

export async function getRealtimeMarketIndices(
  signal?: AbortSignal,
): Promise<RealtimeMarketIndicesResponse> {
  const response = await requestJson<RealtimeDataResponse<RawRealtimeMarketIndicesData>>(
    '/api/v1/market/indices/realtime',
    undefined,
    { signal },
  );
  const data = response.data ?? {};
  return {
    tradingDate: toText(data.trading_date),
    marketStatus: toText(data.market_status, 'unknown'),
    updatedAt: toText(data.updated_at),
    cacheAgeMs: toNullableNumber(data.cache_age_ms),
    items: (data.items ?? []).map(mapRealtimeMarketIndex),
  };
}

export async function getRealtimeStocks(
  codes: string[],
  interval = '1m',
  signal?: AbortSignal,
): Promise<RealtimeStocksResponse> {
  const normalizedCodes = [...new Set(codes.map((code) => code.trim()).filter(Boolean))];
  const response = await requestJson<RealtimeDataResponse<RawRealtimeStocksData>>(
    '/api/v1/stocks/realtime',
    { codes: normalizedCodes.join(','), interval },
    { signal },
  );
  const data = response.data ?? {};
  return {
    tradingDate: toText(data.trading_date),
    marketStatus: toText(data.market_status, 'unknown'),
    interval: toText(data.interval, interval),
    items: (data.items ?? []).map(mapRealtimeStockQuote),
    missingCodes: toStringArray(data.missing_codes),
  };
}

export async function getRealtimeStock(
  code: string,
  interval = '1m',
  signal?: AbortSignal,
): Promise<RealtimeStocksResponse> {
  const response = await requestJson<RealtimeDataResponse<RawRealtimeStocksData>>(
    `/api/v1/stocks/${encodeURIComponent(code.trim())}/realtime`,
    { interval },
    { signal },
  );
  const data = response.data ?? {};
  return {
    tradingDate: toText(data.trading_date),
    marketStatus: toText(data.market_status, 'unknown'),
    interval: toText(data.interval, interval),
    items: (data.items ?? []).map(mapRealtimeStockQuote),
    missingCodes: toStringArray(data.missing_codes),
  };
}

function creatorWorkStatus(value: RawCreatorWork['status']): string {
  if (value && typeof value === 'object') return toText(value.status);
  return toText(value);
}

export function mapCreatorAccount(raw: RawCreatorAccount): CreatorAccount {
  return {
    rank: toNumber(raw.rank, 0),
    creatorId: toText(raw.creator_id),
    displayName: toText(raw.display_name, toText(raw.creator_id, '未知博主')),
    platform: toText(raw.platform, 'unknown'),
    accountKey: toText(raw.account_key),
    platformAccountId: toText(raw.platform_account_id),
    handle: toText(raw.handle),
    alias: toText(raw.alias),
    homepageUrl: toText(raw.homepage_url),
    enabled: raw.enabled === true,
    verificationStatus: toText(raw.verification_status, 'unknown'),
    notes: toText(raw.notes),
  };
}

export function mapCreatorOpinion(raw: RawCreatorOpinion): CreatorOpinion {
  return {
    opinionId: toText(raw.opinion_id),
    workKey: toText(raw.work_key),
    marketScope: toText(raw.market_scope),
    targetType: toText(raw.target_type, 'unknown'),
    targetId: toText(raw.target_id) || null,
    targetName: toText(raw.target_name, '未指定标的'),
    direction: toText(raw.direction, 'unknown'),
    stanceScore: toNullableNumber(raw.stance_score),
    claim: toText(raw.claim || raw.opinion),
    horizon: toText(raw.horizon),
    validFrom: toText(raw.valid_from),
    validUntil: toText(raw.valid_until),
    metric: toText(raw.metric),
    conditions: toStringArray(raw.conditions),
    confidence: toNullableNumber(raw.confidence),
    verifiable: typeof raw.verifiable === 'boolean' ? raw.verifiable : null,
    sourceQuote: toText(raw.source_quote),
    verificationDate: toText(raw.verification_date),
  };
}

function mapVerifiedCreatorOpinion(raw: RawVerifiedCreatorOpinion): VerifiedCreatorOpinion {
  return {
    opinionId: toText(raw.opinion_id),
    workKey: toText(raw.work_key),
    platform: toText(raw.platform, 'unknown'),
    publishedAt: toText(raw.published_at_beijing),
    targetType: toText(raw.target_type, 'unknown'),
    targetName: toText(raw.target_name, '未指定标的'),
    direction: toText(raw.direction, 'unknown'),
    opinion: toText(raw.opinion),
    verificationDate: toText(raw.verification_date),
    verifiedAt: toText(raw.verified_at_beijing),
    verdict: toText(raw.verdict) || null,
    score: toNullableNumber(raw.score),
    reason: toText(raw.reason),
  };
}

export function mapCreatorWorkSummary(raw: RawCreatorWork): CreatorWorkSummary {
  const opinions = (raw.a_share_opinions ?? []).map(mapCreatorOpinion);
  return {
    workKey: toText(raw.work_key),
    creatorId: toText(raw.creator_id),
    creatorName: toText(raw.creator_name, toText(raw.creator_id, '未知博主')),
    accountId: toText(raw.account_id),
    platform: toText(raw.platform, 'unknown'),
    title: toText(raw.title, opinions[0]?.claim || '未命名作品'),
    contentType: toText(raw.content_type, 'unknown'),
    publishedAt: toText(raw.published_at_beijing || raw.published_at),
    canonicalUrl: toText(raw.canonical_url),
    status: creatorWorkStatus(raw.status),
    isAShareRelevant: raw.is_a_share_relevant === true,
    opinions,
  };
}

export function mapCreatorWorkDetail(raw: RawCreatorWork): CreatorWorkDetail {
  return {
    ...mapCreatorWorkSummary(raw),
    summary: toText(raw.analysis?.summary),
    analysisModel: toText(raw.analysis?.analysis_model),
    analyzedAt: toText(raw.analysis?.analyzed_at),
    sourceText: toText(raw.source_text),
    extractedText: toText(raw.extracted_text),
    asrText: toText(raw.asr_text),
    ocrText: toText(raw.ocr_text),
    mediaUrl: toText(raw.media_url),
    durationMs: toNullableNumber(raw.duration_ms),
  };
}

export function mapCreatorOpinionAnalysis(
  raw: RawCreatorOpinionAnalysis,
): CreatorOpinionAnalysis {
  return {
    creatorId: toText(raw.creator_id),
    creatorName: toText(raw.creator_name, toText(raw.creator_id, '未知博主')),
    accuracyScore: toNullableNumber(raw.accuracy_score),
    verifiedOpinions: (raw.verified_opinions ?? []).map(mapVerifiedCreatorOpinion),
    pendingOpinions: (raw.pending_opinions ?? []).map(mapVerifiedCreatorOpinion),
  };
}

export async function getCreatorAccounts(): Promise<CreatorAccount[]> {
  const response = await requestJson<PagedResponse<RawCreatorAccount>>(
    '/api/v1/creator-accounts',
  );
  return (response.items ?? []).map(mapCreatorAccount);
}

export async function getCreatorWorks(
  filters: CreatorWorkFilters = {},
): Promise<CreatorWorkResponse> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 24);
  const response = await requestJson<PagedResponse<RawCreatorWork>>(
    '/api/v1/creator-works',
    {
      creator_id: filters.creatorId,
      platform: filters.platform,
      keyword: filters.keyword,
      start_time: filters.startTime,
      end_time: filters.endTime,
      page,
      page_size: pageSize,
      is_a_share_relevant: true,
      status: 'finished',
    },
  );

  return {
    items: (response.items ?? []).map(mapCreatorWorkSummary),
    total: toNumber(response.total, 0),
    page: toNumber(response.page, page),
    pageSize: toNumber(response.page_size, pageSize),
  };
}

export async function getCreatorWorkDetail(workKey: string): Promise<CreatorWorkDetail> {
  const response = await requestJson<DetailResponse<RawCreatorWork>>(
    '/api/v1/creator-works/' + encodeURIComponent(workKey),
  );
  return mapCreatorWorkDetail(response.data ?? {});
}

export async function getCreatorOpinionAnalyses(): Promise<CreatorOpinionAnalysis[]> {
  const response = await requestJson<PagedResponse<RawCreatorOpinionAnalysis>>(
    '/api/v1/creator-opinion-analyses',
    { page: 1, page_size: 200 },
  );
  return (response.items ?? []).map(mapCreatorOpinionAnalysis);
}

export async function getCreatorOpinionAnalysis(
  creatorId: string,
): Promise<CreatorOpinionAnalysis | null> {
  try {
    const response = await requestJson<DetailResponse<RawCreatorOpinionAnalysis>>(
      '/api/v1/creator-opinion-analyses/' + encodeURIComponent(creatorId),
    );
    return response.data ? mapCreatorOpinionAnalysis(response.data) : null;
  } catch (error) {
    if (error instanceof Error && /接口请求失败:\s*404\b/.test(error.message)) return null;
    throw error;
  }
}

export function mapStockProjectNews(raw: RawStockProjectNews, index = 0): NewsItem {
  const analyses = (raw.sector_llm_analysis ?? []).filter(
    (item) => !!toText(item.sector_name),
  );
  const scored = analyses
    .map((item) => ({ item, score: toNullableNumber(item.sector_llm_analysis?.score) ?? 0 }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const strongest = scored[0];
  const impact = strongest?.score ?? 0;
  const reason = toText(strongest?.item.sector_llm_analysis?.reason);
  const sectors = uniqueStrings(analyses.map((item) => toText(item.sector_name)));
  const companies = uniqueStrings(
    analyses.flatMap((item) => toStringArray(item.sector_llm_analysis?.companies)),
  );
  const publishTs = toNumber(raw.publish_ts, 0);
  const content = toText(raw.content);
  const title = toText(raw.title, content.slice(0, 32) || '未命名资讯');
  const keyPoints = splitReason(reason);

  return {
    id: toText(raw.event_id, `${publishTs}-${index}`),
    title,
    summary: reason || content.slice(0, 120) || title,
    content: content || reason || title,
    source: toText(raw.source, '未知来源'),
    time: toText(raw.publish_time) || formatTimestamp(publishTs),
    publishTime: toText(raw.publish_time) || undefined,
    publishTs: publishTs || undefined,
    author: toText(raw.source, '系统'),
    sentiment: normalizeSentiment(impact),
    relatedStocks: companies,
    relatedSectors: sectors,
    impact,
    keyPoints: keyPoints.length ? keyPoints : sectors,
    analysisReason: reason || undefined,
    subjects: sectors,
  };
}

export function mapStockProjectRanking(
  raw: RawStockProjectRanking,
  index = 0,
): MappedStockProjectRanking {
  const score = toNumber(raw.final_score, 0);
  const positive = toNumber(raw.positive_news_count, 0);
  const negative = toNumber(raw.negative_news_count, 0);
  const sentiment = positive > negative
    ? 'positive'
    : negative > positive
      ? 'negative'
      : normalizeSentiment(score);

  return {
    rank: toNumber(raw.rank, index + 1),
    name: toText(raw.sector_name, `板块${index + 1}`),
    score,
    newsCount: toNumber(raw.news_count, 0),
    sentiment,
    date: dateFromTimestamp(toNumber(raw.latest_publish_ts, 0)),
  };
}

export function mapStockProjectDailyBar(raw: RawStockProjectDailyBar): StockKlineBar {
  return {
    date: toText(raw.trade_date),
    open: toNumber(raw.open, 0),
    high: toNumber(raw.high, 0),
    low: toNumber(raw.low, 0),
    close: toNumber(raw.close, 0),
    amount: toNullableNumber(raw.amount),
    volume: toNullableNumber(raw.volume),
    changeAmount: toNullableNumber(raw.change_amount),
    changePercent: toNullableNumber(raw.pct_chg),
    ...(raw.amplitude_pct !== undefined
      ? { amplitudePercent: toNullableNumber(raw.amplitude_pct) }
      : {}),
    ...(raw.turnover_pct !== undefined
      ? { turnoverPercent: toNullableNumber(raw.turnover_pct) }
      : {}),
    ...(raw.ma ? {
      ma: {
        ma5: toNullableNumber(raw.ma.ma5),
        ma10: toNullableNumber(raw.ma.ma10),
        ma20: toNullableNumber(raw.ma.ma20),
        ma30: toNullableNumber(raw.ma.ma30),
        ma60: toNullableNumber(raw.ma.ma60),
      },
    } : {}),
    ...(raw.volume_ma ? {
      volumeMa: {
        volMa5: toNullableNumber(raw.volume_ma.vol_ma5),
        volMa10: toNullableNumber(raw.volume_ma.vol_ma10),
        volMa20: toNullableNumber(raw.volume_ma.vol_ma20),
        volMa60: toNullableNumber(raw.volume_ma.vol_ma60),
      },
    } : {}),
    ...(raw.macd ? {
      macd: {
        dif: toNullableNumber(raw.macd.dif),
        dea: toNullableNumber(raw.macd.dea),
        hist: toNullableNumber(raw.macd.hist),
      },
    } : {}),
    ...(raw.boll ? {
      boll: {
        mid: toNullableNumber(raw.boll.mid),
        upper: toNullableNumber(raw.boll.upper),
        lower: toNullableNumber(raw.boll.lower),
      },
    } : {}),
    ...(raw.kdj ? {
      kdj: {
        k: toNullableNumber(raw.kdj.k),
        d: toNullableNumber(raw.kdj.d),
        j: toNullableNumber(raw.kdj.j),
      },
    } : {}),
    ...(raw.rsi ? {
      rsi: {
        rsi6: toNullableNumber(raw.rsi.rsi6),
        rsi12: toNullableNumber(raw.rsi.rsi12),
        rsi24: toNullableNumber(raw.rsi.rsi24),
      },
    } : {}),
    ...(raw.cci ? { cci: { cci14: toNullableNumber(raw.cci.cci14) } } : {}),
    ...(raw.wr ? {
      wr: {
        wr6: toNullableNumber(raw.wr.wr6),
        wr10: toNullableNumber(raw.wr.wr10),
        wr14: toNullableNumber(raw.wr.wr14),
      },
    } : {}),
    ...(raw.atr ? { atr: { atr14: toNullableNumber(raw.atr.atr14) } } : {}),
    ...(raw.chip ? {
      chip: {
        profitRatio: toNullableNumber(raw.chip.profit_ratio),
        avgCost: toNullableNumber(raw.chip.avg_cost),
        cost90: raw.chip.cost_90 ? {
          low: toNullableNumber(raw.chip.cost_90.low),
          high: toNullableNumber(raw.chip.cost_90.high),
          concentration: toNullableNumber(raw.chip.cost_90.concentration),
        } : null,
        cost70: raw.chip.cost_70 ? {
          low: toNullableNumber(raw.chip.cost_70.low),
          high: toNullableNumber(raw.chip.cost_70.high),
          concentration: toNullableNumber(raw.chip.cost_70.concentration),
        } : null,
        chart: raw.chip.chart ? {
          x: (raw.chip.chart.x ?? []).map((value) => toNullableNumber(value) ?? Number.NaN),
          y: (raw.chip.chart.y ?? []).map((value) => toNullableNumber(value) ?? Number.NaN),
        } : null,
      },
    } : {}),
  };
}

export const mapKlineBar = mapStockProjectDailyBar;

export function extractSectorCompanies(
  newsItems: RawStockProjectNews[],
  sectorName: string,
): string[] {
  const target = sectorName.trim();
  return uniqueStrings(
    newsItems.flatMap((news) =>
      (news.sector_llm_analysis ?? [])
        .filter((item) => toText(item.sector_name) === target)
        .flatMap((item) => toStringArray(item.sector_llm_analysis?.companies)),
    ),
  );
}

async function fetchNewsPage(params?: Record<string, QueryValue>): Promise<PagedResponse<RawStockProjectNews>> {
  return requestJson<PagedResponse<RawStockProjectNews>>('/api/v1/news', {
    page: 1,
    page_size: NEWS_PAGE_SIZE,
    ...params,
  });
}

export async function getNews(params: {
  tradeDate: string;
  windowDays?: NewsWindowDays;
  sector?: string;
  source?: string;
  search?: string;
  sentiment?: Sentiment | null;
  sort?: string;
  page?: number;
  pageSize?: number;
  days?: number;
}): Promise<NewsResponse> {
  const tradeDateRange = tradeDateUnixRange(params.tradeDate, params.windowDays ?? 1);
  if (!tradeDateRange) throw new Error(`无效交易日: ${params.tradeDate}`);
  const raw = await fetchNewsPage({
    source: params.source,
    sector_name: params.sector,
    keyword: params.search,
    start_ts: tradeDateRange.startTs,
    end_ts: tradeDateRange.endTs,
  });
  let items = (raw.items ?? []).map(mapStockProjectNews);

  items = items.filter((item) => {
    const publishTs = item.publishTs ?? 0;
    return publishTs >= tradeDateRange.startTs && publishTs <= tradeDateRange.endTs;
  });
  if (params.sentiment) {
    items = items.filter((item) => item.sentiment === params.sentiment);
  }
  if (params.sort === 'impact_desc') {
    items.sort((a, b) => b.impact - a.impact);
  } else if (params.sort === 'impact_asc') {
    items.sort((a, b) => a.impact - b.impact);
  } else {
    items.sort((a, b) => (b.publishTs ?? 0) - (a.publishTs ?? 0));
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 50);
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    tradeDate: params.tradeDate,
    items: pageItems,
    pagination: {
      page,
      page_size: pageSize,
      total: items.length,
      returned: pageItems.length,
    },
  };
}

export async function getNewsSentimentOverview(tradeDate: string): Promise<NewsSentimentOverview> {
  const tradeDateRange = tradeDateUnixRange(tradeDate);
  if (!tradeDateRange) throw new Error(`无效交易日: ${tradeDate}`);
  const currentStart = tradeDateRange.startTs;
  const previousStart = currentStart - 24 * 60 * 60;
  const endTs = tradeDateRange.endTs;
  const raw = await fetchNewsPage({ start_ts: previousStart, end_ts: endTs });
  const items = (raw.items ?? []).map(mapStockProjectNews);
  const current = { positive: 0, neutral: 0, negative: 0 };
  const previous = { positive: 0, neutral: 0, negative: 0 };

  items.forEach((item) => {
    const timestamp = item.publishTs ?? 0;
    if (timestamp >= currentStart && timestamp <= endTs) current[item.sentiment] += 1;
    else if (timestamp >= previousStart && timestamp < currentStart) previous[item.sentiment] += 1;
  });

  const currentTotal = current.positive + current.neutral + current.negative;
  const previousTotal = previous.positive + previous.neutral + previous.negative;
  const positivePercent = calcPercent(current.positive, currentTotal);
  const neutralPercent = calcPercent(current.neutral, currentTotal);
  const negativePercent = calcPercent(current.negative, currentTotal);

  return {
    tradeDate,
    positivePercent,
    positiveDelta: positivePercent - calcPercent(previous.positive, previousTotal),
    neutralPercent,
    neutralDelta: neutralPercent - calcPercent(previous.neutral, previousTotal),
    negativePercent,
    negativeDelta: negativePercent - calcPercent(previous.negative, previousTotal),
    counts: { ...current, total: currentTotal },
  };
}

export async function getLatestTradeDate(): Promise<string | null> {
  const response = await requestJson<RawLatestTradeDateResponse>('/api/v1/market/latest-trade-date');
  const tradeDate = toText(response.data?.latest_trade_date);
  return /^\d{4}-\d{2}-\d{2}$/.test(tradeDate) ? tradeDate : null;
}

export async function getMarketOverview(tradeDate: string): Promise<MarketOverviewResponse> {
  const [stats, market] = await Promise.all([
    requestJson<RawStatsResponse>('/api/v1/stats'),
    requestJson<PagedResponse<RawStockProjectDailyBar>>(
      `/api/v1/stock-daily/${encodeURIComponent(tradeDate)}`,
      { page: 1, page_size: 5, adjust: 'qfq', sort_by: 'pct_chg', sort_order: 'desc' },
    ),
  ]);
  const updatedAt = (market.items ?? []).map((item) => toText(item.updated_at)).filter(Boolean).sort().at(-1) || '';

  return {
    tradeDate,
    updatedAt,
    items: (market.items ?? []).map((item, index) => ({
      name: toText(item.name, `股票${index + 1}`),
      code: toText(item.code),
      value: toNullableNumber(item.close),
      changePercent: toNullableNumber(item.pct_chg),
      changeValue: toNullableNumber(item.change_amount),
    })),
    stockCount: toNumber(stats.stocks?.stock_count, 0),
    newsCount: toNumber(stats.news?.total, 0),
  };
}

export async function getPreopenAnalysis(tradeDate: string): Promise<PreopenAnalysisResponse> {
  const path = `/api/v1/morning-analyses/${encodeURIComponent(tradeDate)}`;
  let response: DetailResponse<RawMorningAnalysis>;
  try {
    response = await requestJson<DetailResponse<RawMorningAnalysis>>(path);
  } catch (error) {
    if (error instanceof Error && /接口请求失败:\s*404\b/.test(error.message)) {
      return { date: tradeDate, tradeDate, analysisText: '', mainLines: [] };
    }
    throw error;
  }
  const raw = response.data ?? {};
  const analysis = raw.analysis ?? {};
  const analysisText = [toText(analysis.market_style), toText(analysis.risk_summary)]
    .filter(Boolean)
    .join('\n');
  const mainLines: MainlineSector[] = (analysis.mainlines ?? []).map((item, index) => {
    const rank = toNumber(item.rank, index + 1);
    const risks = toStringArray(item.risks);
    return {
      rank,
      title: toText(item.sector_name, `板块${rank}`),
      priority: rank === 1 ? 'high' : rank <= 2 ? 'medium' : 'low',
      role: roleLabel(item.role),
      confidence: toNumber(item.confidence, 0),
      reason: toText(item.reason),
      risks,
    };
  });

  return {
    date: toText(raw.analysis_date || raw.trade_date, tradeDate),
    tradeDate: toText(raw.trade_date || raw.analysis_date, tradeDate),
    analysisText,
    mainLines,
    ...(analysis.market_style ? { marketStyle: toText(analysis.market_style) } : {}),
    ...(analysis.risk_level ? { riskLevel: toText(analysis.risk_level) } : {}),
    ...(analysis.risk_summary ? { riskSummary: toText(analysis.risk_summary) } : {}),
  };
}

function rankingGeneratedTimestamp(snapshot: RawRankingSnapshot): number {
  const generatedAt = toText(snapshot.generated_at);
  if (!generatedAt) return 0;
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(generatedAt)
    ? generatedAt
    : `${generatedAt}+08:00`;
  const parsed = Date.parse(zoned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rankingPointLabel(snapshot: RawRankingSnapshot): string {
  return toText(snapshot.generated_at).replace('T', ' ').slice(0, 16) || toText(snapshot.biz_date);
}

function selectRankingSnapshots(
  snapshots: RawRankingSnapshot[],
  bizDate: string,
  window: RankingWindow,
): RawRankingSnapshot[] {
  const eligible = snapshots
    .filter((snapshot) => toText(snapshot.biz_date) <= bizDate && rankingGeneratedTimestamp(snapshot) > 0)
    .sort((left, right) => rankingGeneratedTimestamp(left) - rankingGeneratedTimestamp(right));
  const latest = eligible.at(-1);
  if (!latest) return [];

  if (window === 'hour') {
    const latestTs = rankingGeneratedTimestamp(latest);
    return eligible.filter((snapshot) => {
      const timestamp = rankingGeneratedTimestamp(snapshot);
      return timestamp >= latestTs - 60 * 60 * 1000 && timestamp <= latestTs;
    });
  }

  const days = window === 'day' ? 1 : window === '3day' ? 3 : 7;
  const anchorStart = Date.parse(`${bizDate}T00:00:00+08:00`);
  const rangeStart = anchorStart - (days - 1) * 24 * 60 * 60 * 1000;
  const rangeEnd = anchorStart + 24 * 60 * 60 * 1000 - 1;
  return eligible.filter((snapshot) => {
    const snapshotDate = Date.parse(`${toText(snapshot.biz_date)}T12:00:00+08:00`);
    return snapshotDate >= rangeStart && snapshotDate <= rangeEnd;
  });
}

async function getRankingSnapshots(bizDate: string, window: RankingWindow): Promise<RawRankingSnapshot[]> {
  try {
    const response = await requestJson<PagedResponse<RawRankingSnapshot>>('/api/v1/news-rankings', {
      page: 1,
      page_size: 200,
    });
    return selectRankingSnapshots(response.items ?? [], bizDate, window);
  } catch (error) {
    if (error instanceof Error && /接口请求失败:\s*404\b/.test(error.message)) return [];
    throw error;
  }
}

function buildRankingSeries(
  snapshots: RawRankingSnapshot[],
  field: 'investment_ranking' | 'heat_ranking',
  names: string[],
): TrendSeries[] {
  return names.map((name) => ({
    name,
    data: snapshots.flatMap((snapshot) => {
      const match = (snapshot[field] ?? []).find((item) => toText(item.sector_name) === name);
      const value = toNullableNumber(match?.final_score);
      return value === null ? [] : [{ date: rankingPointLabel(snapshot), value }];
    }),
  }));
}

export async function getSectorTrend(
  bizDate: string,
  window: RankingWindow = 'day',
): Promise<SectorTrendResponse> {
  const snapshots = await getRankingSnapshots(bizDate, window);
  const latest = snapshots.at(-1) ?? {};
  const mapped = (latest.investment_ranking ?? []).map(mapStockProjectRanking);
  const first = snapshots[0]?.investment_ranking ?? [];
  return {
    bizDate,
    items: mapped.map((item) => ({
      rank: item.rank,
      name: item.name,
      score: item.score,
      change: item.score - toNumber(
        first.find((candidate) => toText(candidate.sector_name) === item.name)?.final_score,
        item.score,
      ),
      trend: item.score - toNumber(
        first.find((candidate) => toText(candidate.sector_name) === item.name)?.final_score,
        item.score,
      ) >= 0 ? 'up' : 'down',
      newsCount: item.newsCount,
    })),
    series: buildRankingSeries(snapshots, 'investment_ranking', mapped.map((item) => item.name)),
  };
}

export async function getNewsHeatmap(
  bizDate: string,
  window: RankingWindow = 'day',
): Promise<NewsHeatmapResponse> {
  const snapshots = await getRankingSnapshots(bizDate, window);
  const latest = snapshots.at(-1) ?? {};
  const mapped = (latest.heat_ranking ?? []).map(mapStockProjectRanking);
  return {
    bizDate,
    items: mapped.map((item) => ({
      rank: item.rank,
      name: item.name,
      count: item.newsCount,
      growth: 0,
      avgSentiment: item.sentiment,
      score: item.score,
    })),
    series: buildRankingSeries(snapshots, 'heat_ranking', mapped.map((item) => item.name)),
  };
}

async function resolveCompanyStocks(companies: string[]): Promise<RawStockSummary[]> {
  const resolved = await Promise.all(companies.slice(0, 12).map(async (company) => {
    try {
      const response = await requestJson<PagedResponse<RawStockSummary>>('/api/v1/stocks', {
        page: 1,
        page_size: 10,
        keyword: company,
        adjust: 'qfq',
      });
      return (response.items ?? []).find((item) => toText(item.name) === company) ?? response.items?.[0] ?? null;
    } catch {
      return null;
    }
  }));

  const seen = new Set<string>();
  return resolved.filter((item): item is RawStockSummary => {
    const code = toText(item?.code);
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  }).slice(0, 4);
}

function buildSectorStock(
  summary: RawStockSummary,
  rawBars: RawStockProjectDailyBar[],
): SectorStock | null {
  const validBars = rawBars
    .filter(isValidDailyBar)
    .sort((a, b) => toText(a.trade_date).localeCompare(toText(b.trade_date)));
  if (!validBars.length) return null;

  const latest = validBars[validBars.length - 1];
  const latestBar = mapStockProjectDailyBar(latest);
  return {
    code: toText(summary.code || latest.code),
    name: toText(summary.name || latest.name, toText(summary.code, '未知股票')),
    tradeDate: toText(latest.trade_date),
    open: toNumber(latest.open, 0),
    high: toNumber(latest.high, 0),
    low: toNumber(latest.low, 0),
    close: toNumber(latest.close, 0),
    changeAmount: toNullableNumber(latest.change_amount),
    changePercent: toNullableNumber(latest.pct_chg),
    amplitudePercent: toNullableNumber(latest.amplitude_pct),
    amount: toNullableNumber(latest.amount),
    volume: toNullableNumber(latest.volume),
    turnoverPercent: toNullableNumber(latest.turnover_pct),
    ma: latestBar.ma ?? null,
    volumeMa: latestBar.volumeMa ?? null,
    macd: latestBar.macd ?? null,
    boll: latestBar.boll ?? null,
    kdj: latestBar.kdj ?? null,
    rsi: latestBar.rsi ?? null,
    cci: latestBar.cci ?? null,
    wr: latestBar.wr ?? null,
    atr: latestBar.atr ?? null,
    chip: latestBar.chip ?? null,
    kline: validBars.map(mapStockProjectDailyBar),
  };
}

export async function getStockList(
  tradeDate: string,
  keyword = '',
  signal?: AbortSignal,
): Promise<StockListItem[]> {
  const normalizedKeyword = keyword.trim();
  if (normalizedKeyword) {
    const response = await requestJson<PagedResponse<RawStockSummary>>('/api/v1/stocks', {
      page: 1,
      page_size: 50,
      keyword: normalizedKeyword,
      adjust: 'qfq',
    }, { signal });
    return (response.items ?? []).map((item) => ({
      code: toText(item.code),
      name: toText(item.name, toText(item.code, '未知股票')),
      tradeDate: toText(item.latest_trade_date),
      close: toNullableNumber(item.latest_close),
      changePercent: null,
      amount: null,
    }));
  }

  const response = await requestJson<PagedResponse<RawStockProjectDailyBar>>(
    `/api/v1/stock-daily/${encodeURIComponent(tradeDate)}`,
    { page: 1, page_size: 50, adjust: 'qfq', sort_by: 'amount', sort_order: 'desc' },
    { signal },
  );
  return (response.items ?? []).map((item) => ({
    code: toText(item.code),
    name: toText(item.name, toText(item.code, '未知股票')),
    tradeDate: toText(item.trade_date, tradeDate),
    close: toNullableNumber(item.close),
    changePercent: toNullableNumber(item.pct_chg),
    amount: toNullableNumber(item.amount),
  }));
}

export async function getStockDetail(
  code: string,
  tradeDate: string,
  signal?: AbortSignal,
): Promise<SectorStock | null> {
  const response = await requestJson<PagedResponse<RawStockProjectDailyBar>>(
    `/api/v1/stocks/${encodeURIComponent(code)}/daily`,
    { page: 1, page_size: 120, adjust: 'qfq', end_date: tradeDate },
    { signal },
  );
  const latest = response.items?.[0];
  return buildSectorStock({ code, name: toText(latest?.name, code) }, response.items ?? []);
}

export async function getSectorStocks(
  sectorName: string,
  requestedTradeDate: string,
): Promise<SectorStocksResponse> {
  if (sectorName === LATEST_MARKET_POOL_NAME) {
    const tradeDate = requestedTradeDate;

    const latestResponse = await requestJson<PagedResponse<RawStockProjectDailyBar>>(
      `/api/v1/stock-daily/${encodeURIComponent(tradeDate)}`,
      { page: 1, page_size: 12, adjust: 'qfq', sort_by: 'pct_chg', sort_order: 'desc' },
    );
    const summaries: RawStockSummary[] = (latestResponse.items ?? []).map((item) => ({
      code: toText(item.code),
      name: toText(item.name),
      latest_trade_date: toText(item.trade_date),
      latest_close: toNullableNumber(item.close) ?? undefined,
    }));
    const stockResults = await Promise.allSettled(summaries.map(async (summary) => {
      const code = toText(summary.code);
      const response = await requestJson<PagedResponse<RawStockProjectDailyBar>>(
        `/api/v1/stocks/${encodeURIComponent(code)}/daily`,
        { page: 1, page_size: 120, adjust: 'qfq', end_date: tradeDate },
      );
      return buildSectorStock(summary, response.items ?? []);
    }));
    const items = stockResults
      .filter((result): result is PromiseFulfilledResult<SectorStock | null> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((item): item is SectorStock => item !== null);
    return { sectorName, tradeDate, items };
  }

  const newsRange = tradeDateUnixRange(requestedTradeDate);
  if (!newsRange) throw new Error(`无效交易日: ${requestedTradeDate}`);
  const newsResponse = await fetchNewsPage({
    sector_name: sectorName,
    status: 'finished',
    start_ts: newsRange.startTs,
    end_ts: newsRange.endTs,
  });
  const companies = extractSectorCompanies(newsResponse.items ?? [], sectorName);
  const summaries = await resolveCompanyStocks(companies);

  const stockResults = await Promise.allSettled(summaries.map(async (summary) => {
    const code = toText(summary.code);
    const response = await requestJson<PagedResponse<RawStockProjectDailyBar>>(
      `/api/v1/stocks/${encodeURIComponent(code)}/daily`,
      { page: 1, page_size: 120, adjust: 'qfq', end_date: requestedTradeDate },
    );
    return buildSectorStock(summary, response.items ?? []);
  }));

  const items = stockResults
    .filter((result): result is PromiseFulfilledResult<SectorStock | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((item): item is SectorStock => item !== null);

  return {
    sectorName,
    tradeDate: items[0]?.tradeDate || '',
    items,
  };
}

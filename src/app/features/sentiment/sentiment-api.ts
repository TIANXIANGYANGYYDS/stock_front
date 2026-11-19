import { ApiRequestError, requestJson, requestResponse, type QueryValue } from '../../lib/api';
import type { SentimentScope, BoardType, DashboardData, Envelope, EventPage, LadderData, SentimentMeta, StockDetail, StreamMessage, ThemeDetail, TimeseriesData } from './sentiment-contract';

const PREFIX = '/api/v1/sentiment';
export class SentimentContractError extends Error {}
export type CommonQuery = { trade_date?: string; scope?: SentimentScope; snapshot_id?: string };
const get = async <T>(path: string, query: CommonQuery & Record<string, QueryValue>, signal?: AbortSignal): Promise<Envelope<T>> => {
  const scope = query.scope ?? 'all_a';
  const result = await requestJson<Envelope<T>>(PREFIX + path, { ...query, scope }, { signal, cache: 'no-store' });
  if (!result?.meta?.snapshot_id || !result.meta.trade_date || !result.data || result.meta.scope !== scope) {
    throw new SentimentContractError('接口响应与短线情绪契约不一致，请检查服务版本。');
  }
  const data = result.data as Record<string, unknown>;
  if (path === '/dashboard' && data.boards == null) data.boards = [];
  if ((path === '/dashboard' && (!data.market || !Array.isArray(data.boards) || !Array.isArray(data.themes) || !Array.isArray(data.recent_events)))
    || (path === '/ladder' && !Array.isArray(data.groups))
    || ((path === '/events' || path === '/timeseries') && !Array.isArray(data.items))) {
    throw new SentimentContractError('接口数据结构与短线情绪契约不一致。');
  }
  if ((query.trade_date && result.meta.trade_date !== query.trade_date) || (query.snapshot_id && result.meta.snapshot_id !== query.snapshot_id)) {
    throw new ApiRequestError(409, '关联请求返回了不同交易日或快照。');
  }
  return result;
};
export const sentimentApi = {
  dashboard: (query: CommonQuery = {}, signal?: AbortSignal) => get<DashboardData>('/dashboard', query, signal),
  ladder: (query: CommonQuery & { theme_id?: string; status?: 'limit_up' | 'opened' | 'touched'; min_streak?: number; board_type?: BoardType; group_by?: 'theme' | 'market' } = {}, signal?: AbortSignal) => get<LadderData>('/ladder', query, signal),
  theme: (id: string, query: CommonQuery & { page?: number; page_size?: number; sort?: 'board_strength' | 'change_ratio' } = {}, signal?: AbortSignal) => get<ThemeDetail>(`/themes/${encodeURIComponent(id)}`, query, signal),
  stock: (code: string, query: CommonQuery = {}, signal?: AbortSignal) => get<StockDetail>(`/stocks/${encodeURIComponent(code)}`, query, signal),
  events: (query: CommonQuery & { after?: string; limit?: number; theme_id?: string; code?: string; event_type?: string } = {}, signal?: AbortSignal) => get<EventPage>('/events', query, signal),
  timeseries: (query: CommonQuery & { interval?: '1m' | '5m' | '1d'; start_date?: string; end_date?: string; theme_id?: string } = {}, signal?: AbortSignal) => get<TimeseriesData>('/timeseries', query, signal),
};
export const snapshotQuery = (meta: SentimentMeta): CommonQuery => ({ trade_date: meta.trade_date, snapshot_id: meta.snapshot_id, scope: meta.scope });

/** A 409 restarts the entire pair once. Other errors are never blindly retried here. */
export async function atConsistentSnapshot<T>(tradeDate: string | undefined, query: (meta: SentimentMeta, attempt: number) => Promise<Envelope<T>>, signal?: AbortSignal, scope: SentimentScope = 'all_a', known?: Envelope<DashboardData>) {
  for (let attempt = 0; ; attempt++) {
    const dashboard = attempt === 0 && known?.meta.scope === scope && known.meta.trade_date === tradeDate
      ? known : await sentimentApi.dashboard({ trade_date: tradeDate, scope }, signal);
    try { return { dashboard, response: await query(dashboard.meta, attempt) }; }
    catch (error) { if (!(error instanceof ApiRequestError && error.status === 409 && attempt === 0) || signal?.aborted) throw error; }
  }
}
export function loadSentimentSnapshot(tradeDate?: string, signal?: AbortSignal, scope: SentimentScope = 'all_a') {
  return atConsistentSnapshot(tradeDate, meta => sentimentApi.ladder({ ...snapshotQuery(meta), status: 'touched', group_by: 'market' }, signal), signal, scope);
}
export function sentimentError(error: unknown, object = '数据') {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) return `${object}不存在（404）。若最新总览也不可用，请确认服务已部署情绪接口并完成初始化。`;
    if (error.status === 409) return '快照更新较快，本次一致性重试仍冲突，请刷新后再试。';
    if (error.status === 422) return '查询参数被服务拒绝（422），已停止自动重试。请检查日期或筛选条件。';
    if (error.status === 503) return '服务暂无可用快照（503），正在等待数据发布。';
  }
  return error instanceof Error ? error.message : '数据请求失败，请稍后重试。';
}
export const retryable = (error: unknown) => !(error instanceof SentimentContractError) && (!(error instanceof ApiRequestError) || error.status >= 500);

/** Handles multiline data, CRLF, chunk boundaries and the stream's own message IDs. */
export function createSseDecoder(emit: (message: { event: string; data: string; id?: string }) => void) {
  let buffer = '', event = '', data: string[] = [], id: string | undefined;
  const line = (value: string) => {
    if (!value) {
      if (data.length) emit({ event: event || 'message', data: data.join('\n'), id });
      event = ''; data = []; id = undefined; return;
    }
    if (value.startsWith(':')) return;
    const colon = value.indexOf(':');
    const field = colon < 0 ? value : value.slice(0, colon);
    let content = colon < 0 ? '' : value.slice(colon + 1);
    if (content.startsWith(' ')) content = content.slice(1);
    if (field === 'event') event = content;
    else if (field === 'data') data.push(content);
    else if (field === 'id' && !content.includes('\0')) id = content;
  };
  return (chunk: string) => {
    buffer += chunk;
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) { line(buffer.slice(0, newline).replace(/\r$/, '')); buffer = buffer.slice(newline + 1); }
  };
}
export async function connectSentimentStream(signal: AbortSignal, lastId: string | undefined, onMessage: (message: StreamMessage) => void, scope: SentimentScope = 'all_a', known?: Envelope<DashboardData>) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  let watchdog: ReturnType<typeof setTimeout>;
  const touch = () => { clearTimeout(watchdog); watchdog = setTimeout(abort, 25000); };
  touch();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await requestResponse(`${PREFIX}/stream`, { scope, dashboard_id: known?.meta.snapshot_id }, {
      signal: controller.signal, cache: 'no-store', headers: { Accept: 'text/event-stream', ...(lastId ? { 'Last-Event-ID': lastId } : {}) },
    });
    if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw new SentimentContractError('实时接口未返回 SSE 数据流。');
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const feed = createSseDecoder(message => {
      if (!['snapshot', 'resync', 'update', 'heartbeat', 'unavailable', 'stocks_snapshot'].includes(message.event)) return;
      let payload;
      try { payload = JSON.parse(message.data); } catch { throw new SentimentContractError('实时消息不是有效 JSON。'); }
      if (message.event === 'stocks_snapshot') {
        // 只将已加载的总览与同一天、同范围、同一版本的股票首帧组合。
        if (!known || known.meta.scope !== scope || payload?.meta?.scope !== scope ||
            known.meta.trade_date !== payload.meta.trade_date || known.meta.snapshot_id !== payload.meta.snapshot_id ||
            payload.data?.replace_all !== true || !Array.isArray(payload.data.stocks_upsert)) {
          throw new SentimentContractError('实时首帧与已加载总览版本不一致。');
        }
        payload.data.dashboard = known.data;
        message.event = 'snapshot';
      }
      if (message.event !== 'unavailable' && !payload?.meta?.snapshot_id) throw new SentimentContractError('实时消息缺少快照信息。');
      if (message.event !== 'unavailable' && payload.meta.scope !== scope) throw new SentimentContractError('实时消息的观测范围与订阅不一致。');
      if (['snapshot', 'resync', 'update'].includes(message.event) && (!payload?.data?.dashboard || !Array.isArray(payload.data.stocks_upsert))) throw new SentimentContractError('实时消息结构与契约不一致。');
      if (['snapshot', 'resync'].includes(message.event) && payload.data.replace_all !== true) throw new SentimentContractError('完整实时快照缺少替换标志。');
      if (payload?.data?.dashboard && payload.data.dashboard.boards == null) payload.data.dashboard.boards = [];
      onMessage({ type: message.event, id: message.id, payload } as StreamMessage);
    });
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) throw new Error('实时连接已断开，等待重连。');
      touch(); feed(decoder.decode(value, { stream: true }));
    }
  } finally {
    clearTimeout(watchdog!); signal.removeEventListener('abort', abort);
    await reader?.cancel().catch(() => undefined); reader?.releaseLock();
  }
}

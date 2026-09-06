import { ApiRequestError } from '../../lib/api';
import { QuantContractError, quantHttpMessage } from './quant-api';
import type { QuantObservationState, QuantSignalStatus, QuantDataStatus, QuantRecording } from './quant-types';

export type QuantTone = 'accent' | 'positive' | 'negative' | 'warning' | 'danger' | 'neutral';
export interface QuantStatusPresentation { label: string; tone: QuantTone }

export const OBSERVATION_STATES: Record<QuantObservationState, QuantStatusPresentation> = {
  watching: { label: '观察中', tone: 'neutral' },
  holding: { label: '持仓观察', tone: 'accent' },
  signal_confirmed: { label: '已产生信号', tone: 'accent' },
  pending_execution: { label: '待成交', tone: 'warning' },
  filled: { label: '已模拟成交', tone: 'positive' },
  rejected: { label: '未执行', tone: 'neutral' },
  not_triggered: { label: '未触发', tone: 'neutral' },
  unknown: { label: '状态待更新', tone: 'neutral' },
};

export const SIGNAL_STATUSES: Record<QuantSignalStatus, QuantStatusPresentation> = {
  pending_execution: { label: '待成交', tone: 'warning' },
  filled: { label: '已模拟成交', tone: 'positive' },
  rejected: { label: '未执行', tone: 'neutral' },
  cancelled: { label: '已取消', tone: 'neutral' },
  unknown: { label: '状态待更新', tone: 'neutral' },
};

const DATA_STATUSES: Record<QuantDataStatus, QuantStatusPresentation> = {
  waiting_open: { label: '等待开盘', tone: 'neutral' },
  waiting_data: { label: '等待数据', tone: 'neutral' },
  fresh: { label: '数据完整', tone: 'accent' },
  partial: { label: '数据部分完整', tone: 'warning' },
  closed: { label: '收盘数据完整', tone: 'accent' },
  closed_partial: { label: '收盘数据部分完整', tone: 'warning' },
  error: { label: '数据异常', tone: 'danger' },
  unknown: { label: '状态待更新', tone: 'neutral' },
};
const RUN_STATUSES: Record<string, QuantStatusPresentation> = {
  waiting_open: { label: '等待开盘', tone: 'neutral' },
  monitoring: { label: '运行中', tone: 'accent' },
  closed: { label: '已收盘', tone: 'neutral' },
  error: { label: '运行异常', tone: 'danger' },
};
const unknownStatus: QuantStatusPresentation = { label: '状态待更新', tone: 'neutral' };
const lookup = (map: Record<string, QuantStatusPresentation>, value: string | null | undefined) =>
  value && Object.hasOwn(map, value) ? map[value] : unknownStatus;
export const quantStatusPresentation = (value?: string | null) => lookup(SIGNAL_STATUSES, value);
export const quantObservationPresentation = (value?: string | null) => lookup(OBSERVATION_STATES, value);
export const quantRunStatusPresentation = (value?: string | null) => lookup(RUN_STATUSES, value);
export const quantDataStatusPresentation = (value?: string | null) => lookup(DATA_STATUSES, value);

// Fine statuses are an open string vocabulary, independent of the generic enums.
export const DETAIL_STATUSES: Record<string, QuantStatusPresentation> = {
  ...OBSERVATION_STATES, ...SIGNAL_STATUSES,
  confirming: { label: '连续确认中', tone: 'warning' },
  deferred_exit: { label: '延期退出', tone: 'warning' },
  rejected_adx: { label: '趋势条件未通过', tone: 'neutral' },
  rejected_limit_up: { label: '涨停未执行买入', tone: 'neutral' },
  rejected_insufficient_cash: { label: '独立账户资金不足', tone: 'warning' },
  deferred_t1: { label: '当日不可卖，等待后续执行', tone: 'warning' },
  deferred_limit_down: { label: '跌停暂不可卖，等待后续执行', tone: 'warning' },
};
export function quantDetailPresentation(value?: string | null): QuantStatusPresentation {
  return value && Object.hasOwn(DETAIL_STATUSES, value) ? DETAIL_STATUSES[value]
    : { label: value ? `待识别状态（${value}）` : '—', tone: 'neutral' };
}
export function quantPositionPresentation(value?: boolean | null): QuantStatusPresentation {
  return value === true ? { label: '持仓', tone: 'accent' }
    : value === false ? { label: '空仓', tone: 'neutral' } : { label: '持仓状态待确认', tone: 'neutral' };
}
export const formatQuantDecimal = (value: number | null | undefined) => finite(value)
  ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 8 }).format(value) : '—';

export function quantActionPresentation(action?: string | null, observation = false): QuantStatusPresentation {
  if (action === 'buy') return { label: observation ? '买入观察' : '买入', tone: 'positive' };
  if (action === 'sell') return { label: observation ? '卖出观察' : '卖出', tone: 'negative' };
  if (action === 'hold' && observation) return { label: '持仓观察', tone: 'accent' };
  return { label: '—', tone: 'neutral' };
}

export const isQuantReasonField = (field: string) => field === 'reason' || field.endsWith('_reason');
export function formatQuantReason(value: unknown, status?: unknown): string {
  // A completed fill must not be described as an unmet condition. Never render the raw business reason.
  if (status === 'filled' || value === null || value === undefined || value === '') return '—';
  return '不满足';
}

export function recordingLabel(mode?: QuantRecording['mode']): string {
  if (mode === 'historical_replay') return '真实历史行情补录';
  if (mode === 'live') return '实时运行';
  return '未注明';
}

const SHANGHAI_DATE_TIME = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const moneyFormat = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const priceFormat = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

export function parseQuantDateTime(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  let normalized = value.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) normalized += '+08:00';
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function formatQuantDateTime(value: string | null | undefined): string {
  const timestamp = parseQuantDateTime(value);
  if (timestamp === null) return '—';
  const p = Object.fromEntries(SHANGHAI_DATE_TIME.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

export const formatQuantNumber = (value: number | null | undefined) => finite(value) ? numberFormat.format(value) : '—';
export const formatQuantMoney = (value: number | null | undefined) => finite(value) ? moneyFormat.format(value) : '—';
export const formatQuantPrice = (value: number | null | undefined) => finite(value) ? priceFormat.format(value) : '—';

export function formatQuantPnl(value: number | null | undefined): string {
  if (!finite(value)) return '—';
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}¥${moneyFormat.format(Math.abs(value))}`;
}

export function formatQuantRatio(value: number | null | undefined): string {
  if (!finite(value)) return '—';
  const percent = value * 100;
  // Early days in a full-account replay can have very small, but nonzero, returns.
  const digits = percent !== 0 && Math.abs(percent) < 0.01
    ? Math.min(8, Math.max(4, 2 - Math.floor(Math.log10(Math.abs(percent))))) : 2;
  const rounded = Number(percent.toFixed(digits));
  if (percent !== 0 && rounded === 0) return `${percent > 0 ? '+' : ''}${percent.toExponential(2)}%`;
  return `${rounded > 0 ? '+' : ''}${(Object.is(rounded, -0) ? 0 : rounded).toFixed(digits)}%`;
}

export function pnlTone(value: number | null | undefined): QuantTone {
  if (!finite(value) || value === 0) return 'neutral';
  return value > 0 ? 'positive' : 'negative';
}

export const isQuantDataIncomplete = (status?: string | null) => status === 'partial' || status === 'closed_partial';

export function quantErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return '';
  if (error instanceof ApiRequestError) return quantHttpMessage(error.status);
  if (error instanceof QuantContractError) return error.message;
  return '量化数据加载失败，请检查连接后重试。';
}

export const EXECUTION_HISTORY_CONFLICT_MESSAGE = '成交历史持续更新，已停止自动重试，请手动刷新。';
export function quantExecutionRangeErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 409) return EXECUTION_HISTORY_CONFLICT_MESSAGE;
  if (error instanceof ApiRequestError && error.status === 404) return '所选策略不存在或已不可用（404），请重新选择策略。';
  return quantErrorMessage(error);
}


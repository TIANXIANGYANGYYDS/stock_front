import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  ChevronsUpDown,
  DatabaseZap,
  Inbox,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  formatQuantDateTime,
  formatQuantNumber,
  formatQuantMoney,
  formatQuantPnl,
  formatQuantRatio,
  isQuantDataIncomplete,
  pnlTone,
  quantDataStatusPresentation,
  quantRunStatusPresentation,
  quantStatusPresentation,
  quantObservationPresentation,
  quantDetailPresentation,
  type QuantTone,
} from './quant-format';
import { nextQuantSort, type QuantSortDirection, type QuantSortState } from './quant-sort';
import type { QuantRuntime, QuantSummary } from './quant-types';

export function QuantSafetyNotice() {
  return (
    <div className="quant-safety-notice" role="note">
      <ShieldCheck size={16} aria-hidden="true" />
      <strong>模拟账户</strong>
      <span>展示策略观察、买卖信号与模拟成交</span>
      <em>金额：人民币元 · 价格：元/股 · 数量：股</em>
    </div>
  );
}

export function QuantStatusBadge({
  value,
  kind = 'signal',
}: {
  value: string | null | undefined;
  kind?: 'signal' | 'observation' | 'run' | 'data' | 'detail';
}) {
  const presentation = kind === 'run'
    ? quantRunStatusPresentation(value)
    : kind === 'data'
      ? quantDataStatusPresentation(value)
      : kind === 'detail' ? quantDetailPresentation(value)
        : kind === 'observation' ? quantObservationPresentation(value) : quantStatusPresentation(value);
  return (
    <span className={`quant-status is-${presentation.tone}`}>
      {presentation.label}
    </span>
  );
}

export function QuantActionBadge({
  label,
  tone,
}: {
  label: string;
  tone: QuantTone;
}) {
  return <span className={`quant-status is-${tone}`}>{label}</span>;
}

export function QuantSortableHeader<Key extends string>({
  label,
  column,
  sort,
  onSortChange,
  defaultDirection = 'asc',
}: {
  label: string;
  column: Key;
  sort: QuantSortState<Key>;
  onSortChange: (sort: QuantSortState<Key>) => void;
  defaultDirection?: QuantSortDirection;
}) {
  const active = sort.key === column;
  const ariaSort = active
    ? sort.direction === 'asc' ? 'ascending' : 'descending'
    : 'none';
  const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th role="columnheader" aria-sort={ariaSort}>
      <button
        type="button"
        className={`quant-sort-button${active ? ' is-active' : ''}`}
        onClick={() => onSortChange(nextQuantSort(sort, column, defaultDirection))}
        title={`${label}，点击切换排序`}
      >
        <span>{label}</span>
        <Icon size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

export function QuantTableFrame({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="quant-table-frame">
      <div
        className={`quant-table-scroll ${className}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}

/** Keep the complete Shanghai timestamp while allowing a compact two-line cell. */
export function QuantTableTime({ value }: { value: string | null | undefined }) {
  const formatted = formatQuantDateTime(value);
  if (formatted === '—') return <span>—</span>;
  const [date, time] = formatted.split(' ');
  return <time className="quant-table-time" dateTime={value ?? undefined}><span>{date}</span>{' '}<span>{time}</span></time>;
}

export function QuantFilterStatus({ pending }: { pending: boolean }) {
  return pending ? <div className="quant-filter-pending" role="status">筛选已修改，点击“查询”后更新列表</div> : null;
}

export function QuantLoadingState({ label = '正在加载量化数据...' }: { label?: string }) {
  return (
    <div className="quant-state quant-loading-state" role="status">
      <div className="quant-skeleton-lines" aria-hidden="true"><i /><i /><i /></div>
      <span>{label}</span>
    </div>
  );
}

export function QuantAccountsUnavailable() {
  return <div className="quant-quality is-warning" role="alert"><DatabaseZap size={17} aria-hidden="true" /><div><strong>逐股账本不可用</strong><span>当前快照缺少逐股账本，无法确定账户列表与数量。这不代表账户数为 0。</span></div></div>;
}

export function QuantEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="quant-state" role="status">
      <Inbox size={22} aria-hidden="true" />
      <strong>{title}</strong>
      {description && <span>{description}</span>}
      {action}
    </div>
  );
}

export function QuantErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="quant-state is-error" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{message}</span>
      <button type="button" className="quant-button" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" />重试
      </button>
    </div>
  );
}

export function QuantInlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="quant-inline-alert is-error" role="alert">
      <AlertTriangle size={15} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>重试</button>
    </div>
  );
}

export function QuantDataQualityNotice({
  runtime,
  onRetry,
  compact = false,
}: {
  runtime: QuantRuntime | null | undefined;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (!runtime) return null;
  const dataStatus = runtime.data_status;
  const incompleteCount = runtime.incomplete_code_count;
  const incompleteCodes = Array.isArray(runtime.incomplete_codes) ? runtime.incomplete_codes : [];
  const showIncomplete = isQuantDataIncomplete(dataStatus)
    || (typeof incompleteCount === 'number' && incompleteCount > 0);

  if (dataStatus === 'error') {
    return (
      <div className={`quant-quality is-error${compact ? ' is-compact' : ''}`} role="alert">
        <AlertTriangle size={17} aria-hidden="true" />
        <div>
          <strong>量化数据异常</strong>
          <span>当前记录可能不完整，请刷新后核对。空列表不代表当天没有业务记录。</span>
        </div>
        {onRetry && (
          <button type="button" className="quant-button" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />重试
          </button>
        )}
      </div>
    );
  }

  if (!showIncomplete) return null;
  return (
    <div className={`quant-quality is-warning${compact ? ' is-compact' : ''}`} role="status">
      <DatabaseZap size={17} aria-hidden="true" />
      <div>
        <strong>当前交易日数据部分完整，账户估值和业务列表可能不完整。</strong>
        <span>受影响股票 {formatQuantNumber(incompleteCount)} 只</span>
        {incompleteCodes.length > 0 && (
          <details>
            <summary>查看不完整股票代码</summary>
            <div className="quant-code-list">
              {incompleteCodes.map((code) => <code key={code}>{code}</code>)}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

interface MetricItem {
  label: string;
  value: string;
  tone?: QuantTone;
  secondary?: string;
  note?: string;
}

export function QuantPnlPair({
  amount,
  ratio,
}: {
  amount: number | null | undefined;
  ratio: number | null | undefined;
}) {
  const tone = pnlTone(amount ?? ratio);
  return (
    <span className={`quant-pnl-pair is-${tone}`}>
      <strong>{formatQuantPnl(amount)}</strong>
      <small>{formatQuantRatio(ratio)}</small>
    </span>
  );
}

export function QuantMetricGrid({ summary }: { summary: QuantSummary | null | undefined }) {
  const metrics: MetricItem[] = [
    { label: '总资产（元）', value: formatQuantMoney(summary?.total_assets) },
    { label: '纳入统计的本金（元）', value: formatQuantMoney(summary?.initial_capital) },
    { label: '现金余额（元）', value: formatQuantMoney(summary?.cash_balance) },
    { label: '持仓市值（元）', value: formatQuantMoney(summary?.market_value) },
    { label: '累计盈亏 / 收益率', value: formatQuantPnl(summary?.total_pnl), secondary: formatQuantRatio(summary?.total_return), tone: pnlTone(summary?.total_pnl) },
    { label: '账户当日盈亏 / 收益率', value: formatQuantPnl(summary?.account_day_pnl), secondary: formatQuantRatio(summary?.account_day_return), tone: pnlTone(summary?.account_day_pnl) },
    { label: '累计已实现盈亏', value: formatQuantPnl(summary?.realized_pnl), tone: pnlTone(summary?.realized_pnl) },
    { label: '当前持仓浮盈亏', value: formatQuantPnl(summary?.unrealized_pnl), tone: pnlTone(summary?.unrealized_pnl) },
    { label: '当日买入金额（元）', value: formatQuantMoney(summary?.buy_notional) },
    { label: '当日卖出金额（元）', value: formatQuantMoney(summary?.sell_notional) },
    { label: '当日总成交金额（元）', value: formatQuantMoney(summary?.turnover) },
    { label: '当日成交费用（元）', value: formatQuantMoney(summary?.total_fees) },
    { label: '当日买入笔数', value: formatQuantNumber(summary?.buy_count) },
    { label: '当日卖出笔数', value: formatQuantNumber(summary?.sell_count) },
    { label: '持仓股票数', value: formatQuantNumber(summary?.holding_count) },
  ];
  return (
    <div className="quant-metric-grid">
      {metrics.map((metric) => (
        <div className="quant-metric" key={metric.label}>
          <span>{metric.label}</span>
          <strong className={`is-${metric.tone ?? 'neutral'}`}>{metric.value}</strong>
          {metric.secondary && <small className={`is-${metric.tone ?? 'neutral'}`}>{metric.secondary}</small>}
          {metric.note && <small>{metric.note}</small>}
        </div>
      ))}
    </div>
  );
}

export function QuantSection({
  title,
  meta,
  action,
  children,
  className = '',
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`quant-section ${className}`.trim()}>
      <div className="quant-section-head">
        <div><h2>{title}</h2>{meta && <span>{meta}</span>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function QuantPager({
  page,
  pageSize,
  total,
  loading,
  onPageChange,
  onPageSizeChange,
  position = 'bottom',
}: {
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  position?: 'top' | 'bottom';
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [targetPage, setTargetPage] = useState(String(page));
  useEffect(() => setTargetPage(String(page)), [page]);
  return (
    <nav className={`quant-pager is-${position}`} aria-label={position === 'top' ? '顶部分页' : '底部分页'}>
      <span className="quant-pager-count">{total > 0 && `第 ${formatQuantNumber((page - 1) * pageSize + 1)}–${formatQuantNumber(Math.min(page * pageSize, total))} 条 · `}共 {formatQuantNumber(total)} 条</span>
      <label>
        每页
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          disabled={loading}
        >
          {[20, 50, 100, 200].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <button type="button" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>上一页</button>
      <strong>{page} / {totalPages}</strong>
      <button type="button" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页</button>
      {totalPages > 1 && (
        <form className="quant-page-jump" onSubmit={(event) => {
          event.preventDefault();
          const next = Number(targetPage);
          if (!loading && Number.isInteger(next) && next >= 1 && next <= totalPages && next !== page) onPageChange(next);
        }}>
          <label>跳至<input aria-label="跳转页码" type="number" inputMode="numeric" min={1} max={totalPages} step={1} required value={targetPage} disabled={loading} onChange={(event) => setTargetPage(event.target.value)} />页</label>
          <button type="submit" disabled={loading}>跳转</button>
        </form>
      )}
    </nav>
  );
}

/** Keep page controls reachable at both ends and return to the new records on explicit changes. */
export function QuantPagedResults({ children, resetKey, label, total, ...pager }: {
  children: ReactNode;
  resetKey: string;
  label: string;
  total: number | null;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const previousKey = useRef(resetKey);
  const pendingScroll = useRef(false);
  useLayoutEffect(() => {
    if (previousKey.current !== resetKey) pendingScroll.current = true;
    previousKey.current = resetKey;
    if (!pendingScroll.current) return;
    anchor.current?.focus({ preventScroll: true });
    anchor.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    // Async pages briefly show a loading state; align again once the new rows (or error) arrive.
    if (!pager.loading) pendingScroll.current = false;
  }, [resetKey, pager.loading]);
  const showPager = total !== null && !pager.loading;
  return <div ref={anchor} className="quant-paged-results" tabIndex={-1} role="region" aria-label={label} aria-busy={pager.loading}>
    {showPager && <QuantPager {...pager} total={total} position="top" />}
    {children}
    {showPager && total > 0 && <QuantPager {...pager} total={total} position="bottom" />}
  </div>;
}

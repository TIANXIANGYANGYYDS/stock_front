// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { QuantFieldList, QuantRecordDetailButton, QuantRecordDetails } from './QuantDetails';
import { QuantRecordTable } from './QuantRecordTable';
import { QuantRecordsPage } from './QuantRecordsPage';
import { QuantDailyPage } from './QuantDailyPage';
import { formatQuantField } from './quant-field-format';
import { quantDetailPresentation } from './quant-format';
import { dailyFixture, jsonResponse, overviewFixture, pageFixture } from './quant-test-fixtures';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; vi.unstubAllGlobals(); document.body.innerHTML = ''; });
function setup() { const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); return host; }
const text = (markup: string) => { const element = document.createElement('div'); element.innerHTML = markup; return element.textContent; };

it.each([
  ['total_return', 0.0123, '+1.23%'], ['estimated_net_return', -0.0123, '-1.23%'], ['net_return', 0, '0.00%'], ['gross_total_return', null, '—'],
  ['notional', 0, '0.00'], ['capital_inflow', 0, '0.00'], ['capital_inflow', null, '—'],
  ['return_basis', 'traded_accounts_initial_capital', '曾实际买入账户的初始本金（含已清仓账户）'],
  ['shares', 0, '0'], ['adx_14', 19.29032611, '19.29032611'], ['provisional_dea', null, '—'],
  ['condition_met', false, '否'], ['has_position', null, '持仓状态待确认'], ['has_position', false, '空仓'], ['code', '000001', '000001'],
  ['execution_at', '2026-09-03T17:00:00Z', '2026-09-04 01:00:00'], ['factor_completed_date', '2026-09-03', '2026-09-03'],
])('formats %s without changing financial scopes or losing zero/null', (key, value, expected) => {
  expect(formatQuantField(key as string, value)).toBe(expected);
});

it('uses a neutral fallback for unknown fine states', () => {
  expect(quantDetailPresentation('future_state')).toEqual({ label: '待识别状态（future_state）', tone: 'neutral' });
  expect(quantDetailPresentation('deferred_t1').label).toBe('当日不可卖，等待后续执行');
});

it('hides strategy conditions and confirmations while preserving observation status', () => {
  const html = renderToStaticMarkup(<QuantRecordDetails resource="observations" item={{ code: '000001', state: 'rejected', state_detail: 'rejected_adx', reason: '<img src=x onerror=alert(1)>', condition_met: true,
    consecutive_confirmations: 3, required_confirmations: 3, adx_buy_allowed: false, provisional_dea: null }} />);
  const host = document.createElement('div'); host.innerHTML = html;
  expect(host.querySelector('img')).toBeNull();
  expect(host.textContent).not.toContain('<img src=x onerror=alert(1)>');
  expect(host.textContent).toContain('原因不满足');
  expect(host.textContent).toContain('未执行'); expect(host.textContent).toContain('趋势条件未通过');
  expect(host.textContent).not.toContain('条件是否满足'); expect(host.textContent).not.toContain('连续确认次数');
  expect(host.textContent).not.toContain('趋势条件允许买入'); expect(host.textContent).not.toContain('指标与确认');
});

it('hides business reasons in tables, details, attempts and nested fields without describing filled records as unmet', () => {
  const reason = '不可展示的策略判断与阈值';
  const records = [
    { code: '000001', status: 'rejected' as const, reason, exit_reason: reason, attempts: [{ status: 'deferred_t1', reason }] },
    { code: '000002', status: 'filled' as const, reason },
    { code: '000003', status: 'unknown' as const, reason: null },
  ];
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<QuantRecordTable resource="signals" items={records} sort={{ key: '', direction: 'asc' }} onSortChange={vi.fn()} />);
  expect([...host.querySelectorAll('.quant-record-reason')].map(node => node.textContent)).toEqual(['不满足', '—', '—']);
  expect(host.innerHTML).not.toContain(reason);
  const details = renderToStaticMarkup(<><QuantRecordDetails resource="signals" item={records[0]} /><QuantRecordDetails resource="signals" item={records[1]} />
    <QuantFieldList model="StrategyDetail" data={{ buy_filter: { reason: { nested: reason } } }} /></>);
  expect(details).not.toContain(reason);
  expect(text(details)).toContain('原因不满足');
  expect(text(details)).toContain('原因—');
  expect(formatQuantField('exit_reason', reason)).toBe('不满足');
});

it('distinguishes cumulative attempts from bounded saved attempts and leaves unfilled fields unavailable', () => {
  const html = renderToStaticMarkup(<QuantRecordDetails resource="signals" item={{ code: '000001', status: 'pending_execution', status_detail: 'deferred_t1', execution_at: null, execution_price: null, shares: null,
    attempt_count: 12, attempts: [{ attempt_at: '2026-09-04T01:33:00Z', status: 'deferred_t1', reference_open: 0, reason: '当日不可卖' }], estimated_net_return: -0.0123 }} />);
  const content = text(html);
  expect(content).toContain('累计尝试 12 次 · 已保存 1 条明细');
  expect(content).toContain('2026-09-04 09:33:00'); expect(content).toContain('参考开盘价（元/股）0.00');
  expect(content).toContain('模拟成交时间—'); expect(content).toContain('模拟成交价（元/股）—');
  expect(content).toContain('估算净收益率（非已实现）-1.23%'); expect(content).not.toContain('已模拟成交');
});

it('keeps only public identity and data quality even when callers request strategy fields explicitly', () => {
  const snapshot = overviewFixture({ strategy: { id: 'unexpected-internal-id', name: 'unpublished-name', execution_kind: 'shadow_simulation', macd_parameters: [20, 100, 30], buy_filter: { indicator: 'ADX', minimum: 20, strategy_id: 'unexpected-internal-id' } },
    execution_rule: { commission_rate: 0.0001, slippage_rate: 0.0005, settlement: 'T+1' }, runtime: { data_status: 'error', last_error: '<script>example()</script>' } });
  const identity = { id: 'strategy_1', name: '策略1' };
  const html = renderToStaticMarkup(<>
    <QuantFieldList model="StrategyDetail" data={snapshot.strategy} identity={identity} />
    <QuantFieldList model="StrategyDetail" data={snapshot.strategy} fields={['buy_filter', 'macd_parameters']} identity={identity} />
    <QuantFieldList model="ExecutionRule" data={snapshot.execution_rule} />
    <QuantFieldList model="Runtime" data={snapshot.runtime} />
  </>);
  expect(html).not.toContain('unpublished-name'); expect(html).not.toContain('unexpected-internal-id');
  const content = text(html);
  expect(content).toContain('策略1'); expect(content).toContain('strategy_1'); expect(content).toContain('数据异常');
  for (const hidden of ['MACD', 'ADX', '最低阈值', '佣金费率', 'example()', '买入过滤条件']) expect(content).not.toContain(hidden);
});

it('excludes unknown root response fields instead of rendering raw response dumps', () => {
  const content = text(renderToStaticMarkup(<QuantFieldList model="Observation" data={{ code: '000001', provisional_dif: 1.23, internal_strategy_id: 'unpublished-identity' }} />));
  expect(content).toContain('000001'); expect(content).not.toContain('盘中 DIF'); expect(content).not.toContain('unpublished-identity');
});

it('does not expose strategy metrics in signal or exit details, including full-record views', () => {
  const signal = renderToStaticMarkup(<QuantRecordDetails resource="signals" item={{ code: '000001', status: 'filled', execution_price: 4.002,
    minimum_shrink_ratio: 0.1789, confirmation_count: 3, adx_14: 23.9876, provisional_dif: 1.2345 }} />);
  const exit = renderToStaticMarkup(<QuantRecordDetails resource="exit-decisions" item={{ code: '000001', action: 'hold', reason: 'private rule',
    original_sell: true, adx: 23.9876, adx_state: 'strong', provisional_histogram: 1.2345, estimated_net_return: 0.0123 }} />);
  for (const forbidden of ['23.9876', '1.2345', '0.1789', 'ADX', '确认次数', '收缩比例', '原始卖出条件', 'private rule']) {
    expect(signal + exit).not.toContain(forbidden);
  }
  expect(text(signal)).toContain('4.002'); expect(text(exit)).toContain('+1.23%'); expect(text(exit)).toContain('继续持有');
});

it('keeps empty and unknown account positions distinct and displays all asset fields', () => {
  const content = text(renderToStaticMarkup(<QuantRecordTable resource="accounts" items={[
    { code: '000001', has_position: false, shares: 0, initial_capital: 100000, cash_balance: 100000, market_value: 0, total_assets: 100000, total_pnl: 0, total_return: 0, realized_pnl: 0, unrealized_pnl: 0 },
    { code: '000002', has_position: null, shares: null },
  ]} sort={{ key: '', direction: 'asc' }} onSortChange={vi.fn()} />));
  expect(content).toContain('空仓'); expect(content).toContain('持仓状态待确认'); expect(content).toContain('100,000.00'); expect(content).toContain('¥0.000.00%');
});

it('opens an accessible public detail dialog and closes it with Escape', async () => {
  const host = setup();
  await act(async () => root!.render(<QuantRecordDetailButton resource="signals" item={{ code: '000001', name: '示例股票', status: 'rejected', status_detail: 'rejected_adx', attempt_count: 0, attempts: [] }} title="买卖信号" identity={{ id: 'strategy_1', name: '策略1' }} />));
  await act(async () => host.querySelector('button')!.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('策略1 · 示例股票');
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('趋势条件未通过');
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('does not render unavailable accounts as an empty result or a zero-count pager', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ...pageFixture([]), available: false })));
  const host = setup(); await act(async () => root!.render(<QuantRecordsPage resource="accounts" snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} />));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('逐股账本不可用');
  expect(host.querySelector('.quant-pager')).toBeNull(); expect(host.textContent).not.toContain('暂无账户记录');
});

it('sends false for empty accounts, resets pagination and permits clearing that filter', async () => {
  const fetch = vi.fn(async (url: string) => { const query = new URL(url, 'http://test').searchParams; return jsonResponse({ ...pageFixture([], Number(query.get('page')), Number(query.get('page_size'))), available: true }); });
  vi.stubGlobal('fetch', fetch); const host = setup();
  await act(async () => root!.render(<QuantRecordsPage resource="accounts" snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} />));
  await act(async () => { const select = host.querySelector<HTMLSelectElement>('[aria-label="账户持仓"]')!; select.value = 'false'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetch.mock.lastCall![0]).toContain('has_position=false'); expect(fetch.mock.lastCall![0]).toContain('page=1');
  const clear = [...host.querySelectorAll('button')].find(item => item.textContent === '清空筛选')!;
  expect(clear.disabled).toBe(false); await act(async () => clear.click());
  expect(fetch.mock.lastCall![0]).not.toContain('has_position=');
});

it('makes all new pools available from one full snapshot without fetching again', async () => {
  const fetch = vi.fn().mockResolvedValue(jsonResponse({ data: dailyFixture({ accounts: { available: false, count: 0, items: [] },
    preselection_pool: { count: 1, items: [{ code: '000001', name: '买入候选样本', status: 'not_triggered', reason: '候选原因' }] },
    sell_candidate_pool: { count: 1, items: [{ code: '000002', name: '卖出候选样本', reason: '卖出原因' }] },
    exit_decisions: { count: 1, items: [{ code: '000003', name: '退出判断样本', action: 'hold', allow_delay: false, estimated_net_return: 0 }] },
  }) }));
  vi.stubGlobal('fetch', fetch); const host = setup();
  await act(async () => root!.render(<QuantDailyPage snapshot={overviewFixture()} onSnapshotConflict={vi.fn()} />));
  for (const [resource, expected] of [['preselections', '买入候选样本'], ['sell-candidates', '卖出候选样本'], ['exit-decisions', '退出判断样本'], ['accounts', '逐股账本不可用']]) {
    await act(async () => { const select = host.querySelector<HTMLSelectElement>('[aria-label="完整记录业务列表"]')!; select.value = resource; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.textContent).toContain(expected);
  }
  expect(host.querySelector('.quant-pager')).toBeNull(); expect(fetch).toHaveBeenCalledTimes(1);
});

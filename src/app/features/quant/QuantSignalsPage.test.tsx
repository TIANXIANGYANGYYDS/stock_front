import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QuantRecordTable, quantTableConfig } from './QuantRecordTable';
import { QuantStatusBadge } from './QuantCommon';
import type { QuantListResource, QuantResourceItems } from './quant-types';

function render<R extends QuantListResource>(resource: R, items: QuantResourceItems[R][]) {
  return renderToStaticMarkup(<QuantRecordTable resource={resource} items={items} sort={quantTableConfig(resource).defaultSort} onSortChange={vi.fn()} />).replace(/<[^>]+>/g, '');
}

describe('public record semantics', () => {
  it('preserves stock codes and signal zero values, while leaving unavailable execution fields empty', () => {
    const text = render('signals', [{ code: '000001', name: '股票', action: 'buy', status: 'pending_execution', signal_at: '2026-09-04T01:39:00Z', signal_price: 0, execution_at: null, execution_price: null, shares: null }]);
    expect(text).toContain('000001'); expect(text).toContain('待成交');
    expect(text).toContain('2026-09-04 09:39:00'); expect(text).toContain('0.00');
    expect(text).toMatch(/—.*—.*—/); expect(text).not.toContain('已模拟成交');
  });

  it('renders each signal status with only the public label', () => {
    const labels = { pending_execution: '待成交', filled: '已模拟成交', rejected: '未执行', cancelled: '已取消', unknown: '状态待更新' } as const;
    for (const [status, label] of Object.entries(labels)) {
      const text = renderToStaticMarkup(<QuantStatusBadge kind="signal" value={status} />);
      expect(text).toContain(label);
      expect(text).not.toContain('title=');
    }
    const fallback = renderToStaticMarkup(<QuantStatusBadge value="server_only_state" />);
    expect(fallback).toContain('状态待更新'); expect(fallback).not.toContain('server_only_state');
  });

  it('distinguishes holding observations from buy/sell signals', () => {
    const text = render('observations', [{ code: '000001', action: 'hold', state: 'holding', data_status: 'waiting_data' }]);
    expect(text).toContain('持仓观察'); expect(text).toContain('等待数据');
    expect(text).not.toContain('已模拟成交');
  });

  it('uses execution notional and total_fees directly, preserving zero tax', () => {
    const text = render('executions', [{ code: '000001', action: 'buy', execution_price: 2, shares: 100, notional: 321.23, commission: 5, stamp_duty: 0, total_fees: 6.78, cash_flow: -328.01 }]);
    expect(text).toContain('321.23'); expect(text).toContain('6.78'); expect(text).toContain('0.00'); expect(text).toContain('-328.01');
    expect(text).not.toContain('200.00');
  });

  it('uses account daily returns, backend cost and valuation, and both sellability flags', () => {
    const text = render('holdings', [{ code: '000001', shares: 0, entry_execution_price: 10, cost_basis: 1001, mark_price: 12, market_value: 1200,
      total_pnl: 199, total_return: 0.1988, account_day_pnl: -12, account_day_return: -0.0123,
      market_day_pnl: 99999, market_day_return: 0.99, t1_locked: true, sellable_today: false, marked_at: null }]);
    expect(text).toContain('1,001.00'); expect(text).toContain('-¥12.00'); expect(text).toContain('-1.23%');
    expect(text).toContain('+19.88%'); expect(text).toContain('T+1 锁定');
    expect(text).not.toContain('99,999'); expect(text).not.toContain('+99.00%');
    expect(render('holdings', [{ code: '000002', t1_locked: false, sellable_today: true }])).toContain('今日可卖');
    expect(render('holdings', [{ code: '000002', t1_locked: false, sellable_today: false }])).toContain('今日不可卖');
  });

  it('renders completed trade times, prices and net pnl without deducting fees again', () => {
    const text = render('closed-trades', [{ code: '000001', entry_execution_at: '2026-09-03T01:39:00Z', exit_execution_at: '2026-09-04T02:39:00Z',
      entry_execution_price: 10, exit_execution_price: 11, shares: 100, total_fees: 12, net_pnl: 88, net_return: 0.088 }]);
    expect(text).toContain('2026-09-03 09:39:00'); expect(text).toContain('2026-09-04 10:39:00');
    expect(text).toContain('+¥88.00'); expect(text).toContain('+8.80%');
    expect(text).not.toContain('+¥76.00');
  });
});


import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../lib/api';
import { getQuantDailyResult, getQuantOverview, getQuantPage, getQuantPerformance, getQuantStrategies } from './quant-api';
import { dailyFixture, jsonResponse, overviewFixture, pageFixture } from './quant-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('public quant API contract', () => {
  it('loads the catalog and resolves overview.data via the shared base and cancellation', async () => {
    const snapshot = overviewFixture();
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ items: [snapshot.strategy], total: 1 }))
      .mockResolvedValueOnce(jsonResponse({ data: snapshot }));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    expect((await getQuantStrategies()).items).toEqual([snapshot.strategy]);
    expect(await getQuantOverview('strategy_1', '2026-09-04', { signal: controller.signal })).toEqual(snapshot);
    expect(fetch.mock.calls[0][0]).toBe('/backend-api/api/v1/quant/strategies');
    expect(fetch.mock.calls[1][0]).toBe('/backend-api/api/v1/quant/strategies/strategy_1/overview?trade_date=2026-09-04');
    expect(fetch.mock.calls[1][1].signal).toBe(controller.signal);
    expect(fetch.mock.calls[0][1].cache).toBe('no-store');
    expect(fetch.mock.calls[1][1].cache).toBe('no-store');
  });

  it.each(['accounts', 'observations', 'signals', 'executions', 'holdings', 'closed-trades', 'preselections', 'sell-candidates', 'exit-decisions'] as const)('reads the direct %s page and pins snapshot, date, code and pagination', async resource => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ ...pageFixture([{ code: '000001' }], 1, 200), ...(resource === 'accounts' ? { available: true } : {}) }));
    vi.stubGlobal('fetch', fetch);
    const result = await getQuantPage('strategy_1', resource, { tradeDate: '2026-09-04', snapshotId: 'snapshot-a', code: '000001', pageSize: 999, action: 'buy', status: 'filled', state: 'watching' });
    const url = new URL(fetch.mock.calls[0][0], 'http://test');
    expect(url.pathname).toBe('/backend-api/api/v1/quant/strategies/strategy_1/' + resource);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ trade_date: '2026-09-04', snapshot_id: 'snapshot-a', code: '000001', page: '1', page_size: '200' });
    expect(url.searchParams.has('state')).toBe(resource === 'observations');
    expect(url.searchParams.has('status')).toBe(resource === 'signals' || resource === 'preselections');
    expect(result.items[0].code).toBe('000001');
    expect(result.snapshot_id).toBe('snapshot-a');
  });

  it.each(['observations', 'signals'] as const)('passes generic and fine %s filters as independent intersecting parameters', async resource => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(pageFixture([])));
    vi.stubGlobal('fetch', fetch);
    await getQuantPage('strategy_1', resource, { state: 'rejected', status: 'rejected', stateDetail: 'rejected_adx', statusDetail: 'rejected_adx' });
    const query = new URL(fetch.mock.calls[0][0], 'http://test').searchParams;
    expect(Object.fromEntries(query)).toEqual(resource === 'observations'
      ? { page: '1', page_size: '50', state: 'rejected', state_detail: 'rejected_adx' }
      : { page: '1', page_size: '50', status: 'rejected', status_detail: 'rejected_adx' });
  });

  it('keeps false account filters and the unavailable ledger metadata', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ ...pageFixture([]), available: false }));
    vi.stubGlobal('fetch', fetch);
    expect((await getQuantPage('strategy_1', 'accounts', { hasPosition: false })).available).toBe(false);
    expect(fetch.mock.calls[0][0]).toContain('has_position=false');
  });

  it('requires the v1.1 account availability flag instead of inferring an empty ledger', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(pageFixture([]))));
    await expect(getQuantPage('strategy_1', 'accounts')).rejects.toThrow('可用状态缺失');
  });

  it.each([404, 409, 503])('preserves HTTP %s without exposing server diagnostics', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'server-private-diagnostic' }, status)));
    const error = await getQuantOverview('strategy_1').catch(error => error);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.status).toBe(status);
    expect(error.message).not.toContain('server-private-diagnostic');
  });

  it('rejects malformed pages instead of turning failures into empty records', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: pageFixture([]) }))
      .mockResolvedValueOnce(jsonResponse({ ...pageFixture([]), total: 12 }))
      .mockResolvedValueOnce(jsonResponse(pageFixture([], 1, 50, overviewFixture({ snapshot_id: 'changed' }))));
    vi.stubGlobal('fetch', fetch);
    await expect(getQuantPage('strategy_1', 'signals')).rejects.toThrow();
    await expect(getQuantPage('strategy_1', 'signals')).rejects.toThrow('分页数据不完整');
    await expect(getQuantPage('strategy_1', 'signals', { snapshotId: 'snapshot-a' })).rejects.toMatchObject({ status: 409 });
  });

  it('loads performance pages and daily.data without legacy fallback fields', async () => {
    const daily = dailyFixture();
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ strategy_id: 'strategy_1', strategy_name: '策略1', items: [], total: 0, page: 2, page_size: 50 }))
      .mockResolvedValueOnce(jsonResponse({ data: daily }));
    vi.stubGlobal('fetch', fetch);
    expect((await getQuantPerformance('strategy_1', { startDate: '2026-09-03', endDate: '2026-09-04', page: 2 })).items).toEqual([]);
    expect(fetch.mock.calls[0][0]).toContain('start_date=2026-09-03&end_date=2026-09-04');
    expect(await getQuantDailyResult('strategy_1', '2026-09-04')).toEqual(daily);
    expect(fetch.mock.calls[1][0]).toBe('/backend-api/api/v1/quant/strategies/strategy_1/daily-results/2026-09-04');
  });

  it('rejects other strategy identities and incomplete full snapshots', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: overviewFixture({ strategy_id: 'unselected-id' }) }))
      .mockResolvedValueOnce(jsonResponse({ data: { ...dailyFixture(), closed_trades: null } }));
    vi.stubGlobal('fetch', fetch);
    await expect(getQuantOverview('strategy_1')).rejects.toThrow('策略数据不匹配');
    await expect(getQuantDailyResult('strategy_1', '2026-09-04')).rejects.toThrow('业务列表缺失');
  });
});


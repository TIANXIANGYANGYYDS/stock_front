import { afterEach, describe, expect, it, vi } from 'vitest';
import example from '../../../../docs/短线情绪响应示例.json';
import { ApiRequestError } from '../../lib/api';
import { sentimentApi } from './sentiment-api';
import type { SentimentMeta, SentimentStock, ThemeDetail } from './sentiment-contract';
import type { LiveFilters } from './sentiment-live-model';
import { compareThemeMembers, loadThemeMembers, selectThemeMembers } from './sentiment-members';

const meta = example.dashboard.meta as SentimentMeta;
const filters: LiveFilters = { query: '', height: null, board: '', status: 'all' };
const stock = (code: string, patch: Partial<SentimentStock> = {}): SentimentStock => ({ ...structuredClone(example.stock.data) as SentimentStock, code, board_type: 'sz_mainboard', intraday_streak: 0, is_limit_up: false, touched_up: false, limit_status: 'not_touched', change_ratio: .03, board_run: { window_days: null, limit_up_days: null, label: null, is_final: false }, ...patch });
const run = (days: number) => ({ window_days: days + 2, limit_up_days: days, label: `${days + 2}天${days}板`, is_final: false });
const page = (number: number, total: number, items: SentimentStock[], snapshot = meta.snapshot_id) => ({ meta: { ...meta, snapshot_id: snapshot }, data: { members: { page: number, page_size: 200, total, items } } as ThemeDetail });
afterEach(() => vi.restoreAllMocks());
describe('theme top seven from all members', () => {
  it('places valid popularity after boards and before return, with unavailable ranks last', () => {
    const popularity = (rank: number | null, status = 'ranked') => ({ provider: 'ths', status, rank, heat: null, rank_change: '供应商原值' } as SentimentStock['popularity']);
    const rows = [stock('000001', { popularity: popularity(1, 'stale'), change_ratio: .2 }), stock('000002', { popularity: popularity(50), change_ratio: .01 }), stock('000003', { popularity: popularity(3), change_ratio: -.01 }), stock('000004', { intraday_streak: 2, popularity: popularity(null, 'missing') }), stock('000005', { board_run: run(3), popularity: popularity(null, 'not_ranked') })];
    expect(rows.sort(compareThemeMembers).map(s => s.code)).toEqual(['000004', '000005', '000003', '000002', '000001']);
  });
  it('ranks continuous boards, multi-day board count and return in that order, not sealing time or target height', () => {
    const rows = [stock('000006', { change_ratio: .08 }), stock('000005', { change_ratio: .03 }),
      stock('000004', { board_run: run(2), target_streak: 10, limit_status: 'opened' }),
      stock('000003', { board_run: run(3), change_ratio: .01 }),
      stock('000002', { intraday_streak: 2, board_run: run(8), first_seal_at: '2026-09-03T09:25:00+08:00' }),
      stock('000001', { intraday_streak: 4, board_run: run(4), change_ratio: .001, first_seal_at: null })];
    expect(rows.sort(compareThemeMembers).map(row => row.code)).toEqual(['000001', '000002', '000003', '000004', '000006', '000005']);
    const tied = [stock('000002', { first_seal_at: '2026-09-03T09:25:00+08:00' }), stock('000001')];
    expect(tied.sort(compareThemeMembers).map(row => row.code)).toEqual(['000001', '000002']);
  });
  it('fills seven from normal members when only three touched a limit', () => {
    const rows = Array.from({ length: 12 }, (_, i) => stock(String(i).padStart(6, '0'), { change_ratio: .01 * (12 - i), ...(i < 3 ? { touched_up: true, is_limit_up: true, intraday_streak: i + 1 } : {}) }));
    const result = selectThemeMembers(rows.sort(compareThemeMembers), filters, '农业', meta).slice(0, 7);
    expect(result).toHaveLength(7); expect(result.filter(row => row.touched_up)).toHaveLength(3);
    expect(result.map(row => row.code)).toEqual(['000002', '000001', '000000', '000003', '000004', '000005', '000006']);
    expect(selectThemeMembers(rows, { ...filters, status: 'touched' }, '农业', meta)).toHaveLength(3);
  });
  it('preserves server order and excluded/missing members while applying only explicit scope and user filters', () => {
    const ordinary = stock('302001', { board_type: 'chinext' });
    const members = [ordinary, ordinary, stock('000002', { valid: false }), stock('000003', { eligible: false }), stock('000004', { is_stale: true }), stock('000005')];
    expect(selectThemeMembers(members, filters, '农业', meta).map(row => row.code)).toEqual(['302001', '000002', '000003', '000004', '000005']);
    expect(selectThemeMembers(members, { ...filters, board: 'chinext', query: '302001' }, '农业', meta)).toEqual([ordinary]);
    expect(selectThemeMembers(members, filters, '农业', { ...meta, scope: 'hs_mainboard', included_boards: undefined }).map(row => row.code)).toEqual(['000002', '000003', '000004', '000005']);
    expect(selectThemeMembers(members, { ...filters, height: 2 }, '农业', meta)).toEqual([]);
  });
  it('keeps missing ranking values distinct from zero and never edits supplied facts', () => {
    const unknown = stock('000001', { intraday_streak: null, change_ratio: null });
    const zero = stock('000002', { intraday_streak: 0, change_ratio: 0 });
    expect([unknown, zero].sort(compareThemeMembers)).toEqual([zero, unknown]);
    expect(unknown.intraday_streak).toBeNull(); expect(unknown.change_ratio).toBeNull();
  });
  it('reads every page for filtering without reordering the server result', async () => {
    const first = Array.from({ length: 200 }, (_, i) => stock(String(i).padStart(6, '0'), { change_ratio: .1 }));
    const leader = stock('000900', { intraday_streak: 6, change_ratio: -.01 });
    const request = vi.spyOn(sentimentApi, 'theme').mockResolvedValueOnce(page(1, 201, first)).mockResolvedValueOnce(page(2, 201, [leader]));
    const result = await loadThemeMembers('theme', meta, new AbortController().signal);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][1]).toMatchObject({ scope: 'all_a', trade_date: meta.trade_date, snapshot_id: meta.snapshot_id, page: 2, page_size: 200 });
    expect(selectThemeMembers(result.data.items, { ...filters, query: '000900' }, '农业', meta)[0].code).toBe('000900');
    expect(result.data.items[0].code).toBe('000000');
    expect(result.data.items).toHaveLength(201);
  });
  it('discards partial pages and surfaces a conflict for whole-workspace resynchronization', async () => {
    const first = Array.from({ length: 200 }, (_, i) => stock(String(i).padStart(6, '0')));
    const request = vi.spyOn(sentimentApi, 'theme').mockResolvedValueOnce(page(1, 201, first)).mockRejectedValueOnce(new ApiRequestError(409, 'changed')).mockResolvedValueOnce(page(1, 1, [stock('002222')], 'rebuilt'));
    vi.spyOn(sentimentApi, 'dashboard').mockResolvedValue({ ...example.dashboard, meta: { ...meta, snapshot_id: 'rebuilt' } } as never);
    await expect(loadThemeMembers('theme', meta, new AbortController().signal)).rejects.toMatchObject({ status: 409 });
    expect(request.mock.calls.map(call => call[1]?.page)).toEqual([1, 2]);
    expect(sentimentApi.dashboard).not.toHaveBeenCalled();
  });
  it('rejects truncated member pages instead of presenting a partial ranking as top seven', async () => {
    vi.spyOn(sentimentApi, 'theme').mockResolvedValue(page(1, 100, [stock('000001')]));
    await expect(loadThemeMembers('theme', meta, new AbortController().signal)).rejects.toThrow('未完整返回');
  });
});

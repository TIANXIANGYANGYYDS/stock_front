import { describe, expect, it, vi } from 'vitest';
import { loadQuantRecords } from './quant-records';
import type { QuantListParams } from './quant-api';

const rows = Array.from({ length: 205 }, (_, index) => ({ id: index }));
const response = (page: number, pageSize = 200, total = rows.length) => ({
  strategy_id: 'strategy-a', strategy_name: '策略1', snapshot_id: 'snapshot-a', trade_date: '2026-09-04', total, page, page_size: pageSize,
  items: rows.slice((page - 1) * pageSize, Math.min(page * pageSize, total)),
});

describe('complete quant records', () => {
  it('collects all pages, pins the resolved date, preserves filters and cancellation, and keeps response order', async () => {
    const controller = new AbortController();
    const loader = vi.fn(async (_strategy: string, params: QuantListParams) => response(params.page!, params.pageSize!));
    const result = await loadQuantRecords(loader, 'strategy-a', { action: 'buy', status: 'filled' }, { signal: controller.signal });
    expect(result.items).toEqual(rows);
    expect(result.total).toBe(205);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenLastCalledWith('strategy-a', {
      tradeDate: '2026-09-04', snapshotId: 'snapshot-a', action: 'buy', status: 'filled', page: 2, pageSize: 200,
    }, { signal: controller.signal });
  });

  it('honors the server page size and accepts an empty filtered result', async () => {
    const loader = vi.fn(async (_strategy: string, params: QuantListParams) => response(params.page!, 50));
    expect((await loadQuantRecords(loader, 'strategy-a', {})).items).toHaveLength(205);
    expect(loader).toHaveBeenCalledTimes(5);
    expect(loader.mock.lastCall?.[1].pageSize).toBe(50);
    expect((await loadQuantRecords(async () => response(1, 200, 0), 'strategy-a', {})).items).toEqual([]);
  });

  it('rejects failed, truncated or changing pages instead of exposing a partly sorted list', async () => {
    const loader = vi.fn().mockResolvedValueOnce(response(1)).mockRejectedValueOnce(new Error('断开连接'));
    await expect(loadQuantRecords(loader, 'strategy-a', {})).rejects.toThrow('断开连接');
    const changed = vi.fn().mockResolvedValueOnce(response(1)).mockResolvedValueOnce({ ...response(2), total: 206 });
    await expect(loadQuantRecords(changed, 'strategy-a', {})).rejects.toThrow('发生变化');
    await expect(loadQuantRecords(async () => ({ ...response(1), items: [] }), 'strategy-a', {})).rejects.toThrow('未加载完整');
    const truncated = vi.fn().mockResolvedValueOnce(response(1)).mockResolvedValueOnce({ ...response(2), items: [] });
    await expect(loadQuantRecords(truncated, 'strategy-a', {})).rejects.toThrow('未加载完整');
  });

  it('stops fetching when cancelled even if the page loader ignores the abort signal', async () => {
    const controller = new AbortController();
    const loader = vi.fn(async () => { controller.abort(); return response(1); });
    await expect(loadQuantRecords(loader, 'strategy-a', {}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../../../../docs/短线情绪响应示例.json';
import type { SentimentMeta, SentimentStock, ThemeDetail } from './sentiment-contract';
import { sentimentApi } from './sentiment-api';
import { ApiRequestError } from '../../lib/api';
import { ThemeCard } from './SentimentLadder';
import { SentimentPublication } from './SentimentPublication';
import { isFinal, memberQuality } from './sentiment-publication';
import { clockTime } from './sentiment-model';

vi.mock('./ThemeSecondsChart', () => ({ ThemeSecondsChart: (props: { stocks: SentimentStock[]; asOf: string; archiveAsOf: string; publication: string }) => <div data-testid="chart">{JSON.stringify(props)}</div> }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const retained = example.retained_dashboard.meta as SentimentMeta;
const detail = (meta = retained) => ({ meta, data: { ...structuredClone(example.retained_theme.data), members: {
  total: 96, page: 1, page_size: 7, sort: 'board_strength', items: Array.from({ length: 7 }, (_, i) => ({ ...structuredClone(example.stock.data),
    code: String(i).padStart(6, '0'), intraday_streak: 0, touched_up: false, limit_status: 'not_touched',
    eligible: i !== 0, excluded_reason: i === 0 ? 'st' : null, valid: i !== 6, change_ratio: i === 6 ? null : .01,
  })),
} } as ThemeDetail });
const card = (meta = retained, onConflict = vi.fn()) => <ThemeCard theme={detail(meta).data} meta={meta} filters={{ query: '', status: 'all', board: '', height: null }} index={0} favorite={false} historical={false} connected={false} onStock={vi.fn()} onTheme={vi.fn()} onFavorite={vi.fn()} onConflict={onConflict} />;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
describe('server-retained observations', () => {
  it('renders seven server-ranked members on a fresh stale retained snapshot, including excluded and missing rows', async () => {
    const read = vi.spyOn(sentimentApi, 'theme').mockResolvedValue(detail());
    const history = vi.spyOn(sentimentApi, 'timeseries');
    await act(async () => root.render(card()));
    const chart = JSON.parse(host.querySelector('[data-testid="chart"]')!.textContent!);
    expect(chart.stocks.map((s: SentimentStock) => s.code)).toEqual(['000000', '000001', '000002', '000003', '000004', '000005', '000006']);
    expect(chart.stocks[0].eligible).toBe(false); expect(memberQuality(chart.stocks[0])).toBe('不参与统计：ST');
    expect(chart.stocks[6].change_ratio).toBeNull();
    expect(chart.asOf).toBe(retained.as_of); expect(chart.archiveAsOf).toBe(retained.processed_as_of);
    expect(read.mock.calls[0][1]).toMatchObject({ snapshot_id: retained.snapshot_id, page_size: 7, sort: 'board_strength' });
    expect(read.mock.calls[0][1]?.snapshot_id).not.toBe(retained.retained_from_snapshot_id);
    expect(history).not.toHaveBeenCalled();
    expect(host.textContent).toContain('非最终收盘结果'); expect(host.textContent).toContain('前 7 / 96');
  });
  it('refreshes chart and members for same-ID finalization, without marking the retained observation as final', async () => {
    const final = { ...retained, is_final: true, is_retained: false, data_mode: 'daily_final' as const,
      as_of: `${retained.trade_date}T15:00:00+08:00`, finalization: { status: 'finalized' as const, pending_reasons: [] } };
    const read = vi.spyOn(sentimentApi, 'theme').mockResolvedValueOnce(detail()).mockResolvedValueOnce(detail(final));
    await act(async () => root.render(card()));
    const initial = JSON.parse(host.querySelector('[data-testid="chart"]')!.textContent!);
    await act(async () => root.render(card(final)));
    const next = JSON.parse(host.querySelector('[data-testid="chart"]')!.textContent!);
    expect(read).toHaveBeenCalledTimes(2); expect(next.publication).not.toBe(initial.publication);
    expect(next.asOf).toBe(final.as_of); expect(host.textContent).not.toContain('非最终收盘结果');
  });
  it('rebases the workspace once on conflict, does not retry the old ID, and resumes after a new publication', async () => {
    const resync = vi.fn();
    const read = vi.spyOn(sentimentApi, 'theme').mockRejectedValueOnce(new ApiRequestError(409, 'changed'));
    await act(async () => root.render(card(retained, resync)));
    expect(resync).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1);
    await act(async () => root.render(card({ ...retained, age_seconds: 9999 }, resync)));
    expect(read).toHaveBeenCalledTimes(1);
    const next = { ...retained, snapshot_id: 'new:opaque:version' }; read.mockResolvedValue(detail(next));
    await act(async () => root.render(card(next, resync)));
    expect(read).toHaveBeenCalledTimes(2); expect(host.querySelector('[data-testid="chart"]')).not.toBeNull();
  });
  it('explains actual Shanghai observation time, known/unknown reasons, and does not infer finalization from the clock', async () => {
    await act(async () => root.render(<SentimentPublication meta={{ ...retained, finalization: { status: 'pending', pending_reasons: ['daily_summary_missing', 'future_reason'] } }} />));
    expect(host.textContent).toContain('10:00:00'); expect(host.textContent).not.toContain('15:04:58');
    expect(host.textContent).toContain('每日汇总尚未就绪'); expect(host.textContent).toContain('future_reason');
    expect(clockTime('2026-10-15T06:56:58Z')).toBe('14:56:58'); expect(isFinal(retained)).toBe(false);
    await act(async () => root.render(<SentimentPublication meta={{ ...retained, is_retained: false, data_mode: 'observed_snapshots', retention_reason: 'no_same_day_usable_observation' }} />));
    expect(host.textContent).toContain('当天没有可保留的有效观察');
  });
});

// @vitest-environment jsdom
import { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import example from '../../../../docs/短线情绪响应示例.json';
import type { Envelope, SentimentMeta, TimeseriesData } from './sentiment-contract';
import { sentimentApi } from './sentiment-api';
import { SentimentHistory } from './SentimentHistory';
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
  ComposedChart: ({ data, children }: PropsWithChildren<{ data: unknown }>) => <div><output>{JSON.stringify(data)}</output>{children}</div>,
  Line: ({ connectNulls }: { connectNulls: boolean }) => <i data-connect-nulls={String(connectNulls)} />,
  Bar: () => null, CartesianGrid: () => null, ReferenceLine: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null,
}));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
it('loads actual five-minute windows, shows candidate/support separately and never multiplies emotion facts', async () => {
  const meta = example.dashboard.meta as SentimentMeta;
  const stats = { ...example.dashboard.data.market, emotion: { ...example.dashboard.data.market.emotion, state: '过冷', candidate_state: '微冷', support: null, facts: { B: 10.46, M: -1.72 }, entry: { test: null }, evaluated_at: `${meta.trade_date}T06:55:00+00:00`, is_carried_to_close: true } };
  const response = { meta, data: { items: [{ timestamp: `${meta.trade_date}T14:55:00+08:00`, as_of: `${meta.trade_date}T14:55:03+08:00`, market: stats }] } } as Envelope<TimeseriesData>;
  const read = vi.spyOn(sentimentApi, 'timeseries').mockResolvedValue(response);
  await act(async () => root.render(<SentimentHistory meta={meta} tradeDate={meta.trade_date} />));
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === '五分钟环境')!.click());
  expect(read.mock.calls.at(-1)?.[0]).toMatchObject({ interval: '5m', snapshot_id: meta.snapshot_id });
  expect(host.textContent).toContain('候选 微冷 · 尚未切换'); expect(host.textContent).toContain('保持证据：未知');
  expect(host.textContent).toContain('14:55:00'); expect(host.textContent).toContain('10.46'); expect(host.textContent).not.toContain('1046');
  expect(host.querySelector('.sent-window-list b')?.textContent).toBe('过冷');
  expect(read).toHaveBeenCalledTimes(2);
});
it('retains all returned minutes beyond retained as_of, preserves nulls and gaps, and rereads at finalization', async () => {
  const meta = example.retained_dashboard.meta as SentimentMeta;
  const data = { meta, data: { items: ['10:00:00', '10:01:00', '11:00:00', '15:00:00'].map((time, i) => ({
    timestamp: `${meta.trade_date}T${time}+08:00`, as_of: `${meta.trade_date}T${time}+08:00`,
    market: { values: { limit_up: i === 3 ? null : i + 1, broken: i === 3 ? null : 2 } },
  })) } } as Envelope<TimeseriesData>;
  const read = vi.spyOn(sentimentApi, 'timeseries').mockResolvedValue(data);
  await act(async () => root.render(<SentimentHistory meta={meta} tradeDate={meta.trade_date} />));
  const rows = JSON.parse(host.querySelector('output')!.textContent!);
  expect(rows.find((r: { up: number }) => r.up === 3)).toBeDefined(); expect(rows.at(-1).up).toBeNull();
  expect(rows.filter((r: { up: number | null }) => r.up === null)).toHaveLength(3);
  expect([...host.querySelectorAll('i[data-connect-nulls]')].every(i => i.dataset.connectNulls === 'false')).toBe(true);
  expect(read.mock.calls[0][0]).toMatchObject({ snapshot_id: meta.snapshot_id, scope: 'all_a', interval: '1m' });
  const final = { ...meta, is_final: true, finalization: { status: 'finalized' as const, pending_reasons: [] } };
  await act(async () => root.render(<SentimentHistory meta={final} tradeDate={meta.trade_date} />));
  expect(read).toHaveBeenCalledTimes(2);
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === '近 20 日')!.click());
  expect(read.mock.calls.at(-1)?.[0].interval).toBe('1d');
});

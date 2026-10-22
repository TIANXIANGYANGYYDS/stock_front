// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../../../../docs/短线情绪响应示例.json';
import { ApiRequestError } from '../../lib/api';
import { sentimentApi } from './sentiment-api';
import { SentimentEvents } from './SentimentPanels';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const event = (id: string) => ({ ...example.stock.data.events.items[0], event_id: id });
const page = (id: string, more = false) => ({ meta: example.dashboard.meta, data: { items: [event(id)], next_cursor: id, has_more: more } });
const render = (scope: 'all_a' | 'hs_mainboard' = 'all_a') => root.render(<SentimentEvents scope={scope} tradeDate={example.dashboard.meta.trade_date} onStock={vi.fn()} onTheme={vi.fn()} onMarket={vi.fn()} />);
const click = async (label: string) => act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent === label)!.click(); });
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.spyOn(sentimentApi, 'dashboard').mockResolvedValue(example.dashboard as never);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
describe('event pagination recovery', () => {
  it('rebases a 409 onto a new dashboard and drops the old cursor and loaded events', async () => {
    const events = vi.spyOn(sentimentApi, 'events').mockResolvedValueOnce(page('all_a:old', true) as never).mockRejectedValueOnce(new ApiRequestError(409, 'future cursor')).mockResolvedValueOnce(page('all_a:rebuilt') as never);
    await act(async () => render()); await click('继续读取历史');
    expect(events).toHaveBeenCalledTimes(3);
    expect(events.mock.calls[1][0]?.after).toBe('all_a:old');
    expect(events.mock.calls[2][0]).toMatchObject({ scope: 'all_a', snapshot_id: example.dashboard.meta.snapshot_id });
    expect(events.mock.calls[2][0]?.after).toBeUndefined();
    expect(host.querySelectorAll('.sent-event')).toHaveLength(1);
    expect(host.querySelector('.sent-event')?.getAttribute('title')).toContain('all_a:rebuilt');
  });
  it('stops on 422 and retries from the first page only after explicit retry', async () => {
    const events = vi.spyOn(sentimentApi, 'events').mockResolvedValueOnce(page('bad-cursor', true) as never).mockRejectedValueOnce(new ApiRequestError(422, 'wrong range')).mockResolvedValueOnce(page('fresh') as never);
    await act(async () => render()); await click('继续读取历史');
    expect(host.textContent).toContain('422'); expect(events).toHaveBeenCalledTimes(2);
    await click('重试'); expect(events).toHaveBeenCalledTimes(3);
    expect(events.mock.calls[2][0]?.after).toBeUndefined();
  });
  it('clears pagination and old events when the scope changes on the same date', async () => {
    const events = vi.spyOn(sentimentApi, 'events').mockResolvedValueOnce(page('all_a:old', true) as never).mockResolvedValueOnce(page('legacy', true) as never);
    await act(async () => render());
    vi.mocked(sentimentApi.dashboard).mockResolvedValue({ ...example.dashboard, meta: { ...example.dashboard.meta, scope: 'hs_mainboard' } } as never);
    await act(async () => render('hs_mainboard'));
    expect(events.mock.calls[1][0]).toMatchObject({ scope: 'hs_mainboard', after: undefined });
    expect(host.querySelectorAll('.sent-event')).toHaveLength(1);
    expect(host.querySelector('.sent-event')?.getAttribute('title')).toContain('legacy');
  });
});

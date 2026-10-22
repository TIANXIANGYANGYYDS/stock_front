// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../../../../docs/短线情绪响应示例.json';
const mocks = vi.hoisted(() => ({ mounted: vi.fn(), stopped: vi.fn(), overview: vi.fn() }));
vi.mock('./useSentiment', async importOriginal => ({ ...await importOriginal<typeof import('./useSentiment')>(), useSentiment: () => ({ snapshot: { meta: example.dashboard.meta, dashboard: { ...example.dashboard.data, themes: ['农业', '传媒', '消费'].map((name, index) => ({ ...example.dashboard.data.themes[0], theme_id: `theme-${index}`, name })) }, stocks: {}, events: [] }, connection: 'live', error: null, refresh: vi.fn() }) }));
vi.mock('./SentimentLadder', () => ({
  ThemeCard: ({ theme, filters }: { theme: { theme_id: string; name: string }; filters: { status: string } }) => { useEffect(() => { mocks.mounted(theme.theme_id); return () => mocks.stopped(theme.theme_id); }, [theme.theme_id]); return <article className="sent-theme-card">{theme.name}|{filters.status}</article>; },
  MarketLadder: () => <div>market</div>,
}));
vi.mock('./SentimentOverview', () => ({ SentimentOverview: () => { mocks.overview(); return <div>expanded overview</div>; } }));
vi.mock('./SentimentBoards', () => ({ SentimentBoards: () => null }));
vi.mock('./SentimentPanels', () => ({ SentimentEvents: () => null, SentimentFeedback: () => null }));
vi.mock('./SentimentDetails', () => ({ SentimentDetails: () => null }));
import { SentimentWorkspace } from './SentimentWorkspace';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.clearAllMocks(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const click = async (label: string) => act(async () => { host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click(); });
describe('single-theme observation workspace', () => {
  it('mounts only the selected all-member chart and unmounts it when switching themes', async () => {
    await act(async () => root.render(<SentimentWorkspace />));
    expect(host.querySelectorAll('.sent-theme-card')).toHaveLength(1);
    expect(host.querySelector('.sent-theme-card')?.textContent).toBe('农业|all');
    expect(mocks.mounted).toHaveBeenCalledTimes(1); expect(mocks.overview).not.toHaveBeenCalled();
    await click('选择题材传媒');
    expect(host.querySelectorAll('.sent-theme-card')).toHaveLength(1);
    expect(host.querySelector('.sent-theme-card')?.textContent).toBe('传媒|all');
    expect(mocks.stopped).toHaveBeenCalledWith('theme-0');
    expect(mocks.mounted).toHaveBeenLastCalledWith('theme-1');
  });
  it('keeps favorites in the picker and loads the overview only after opening it', async () => {
    await act(async () => root.render(<SentimentWorkspace />));
    await click('加入自选传媒');
    await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent === '自选')!.click(); });
    expect(host.querySelectorAll('.sent-picker-select')).toHaveLength(1);
    expect(host.querySelector('.sent-theme-card')?.textContent).toBe('传媒|all');
    await act(async () => host.querySelector<HTMLButtonElement>('.sent-overview-toggle')!.click());
    expect(mocks.overview).toHaveBeenCalled();
    await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent === '市场梯队')!.click(); });
    expect(host.querySelectorAll('.sent-theme-card')).toHaveLength(0);
  });
});

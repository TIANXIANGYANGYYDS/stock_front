// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getPreopenAnalysis: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  getPreopenAnalysis: apiMocks.getPreopenAnalysis,
}));

import { MarketAnalysis } from './MarketAnalysis';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  apiMocks.getPreopenAnalysis.mockResolvedValue({
    analysisDate: '2026-08-11',
    tradeDate: '2026-08-10',
    analysisText: '结构性防守\n流动性收缩风险延续',
    marketStyle: '结构性防守',
    riskLevel: 'high',
    riskSummary: '流动性收缩风险延续',
    mainLines: [{
      rank: 1,
      title: '软件开发',
      priority: 'high',
      role: '主攻方向',
      confidence: 70,
      reason: '国产替代逻辑强化',
      risks: ['冲高回落', '成交不足'],
    }],
  });
});

afterEach(() => {
  apiMocks.getPreopenAnalysis.mockReset();
  document.body.innerHTML = '';
});

describe('MarketAnalysis details', () => {
  it('opens the complete morning mainline detail instead of navigating to a stock', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<MarketAnalysis analysisDate="2026-08-11" />));
    await act(async () => Promise.resolve());

    expect(apiMocks.getPreopenAnalysis).toHaveBeenCalledWith('2026-08-11');
    expect(host.textContent).toContain('盘前分析日期：2026-08-11');
    expect(host.textContent).not.toContain('接口返回日期与当前交易日');

    const mainline = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('软件开发'));
    if (!mainline) throw new Error('Missing morning mainline');
    await act(async () => mainline.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('软件开发');
    expect(dialog?.textContent).toContain('主攻方向');
    expect(dialog?.textContent).toContain('置信度 70');
    expect(dialog?.textContent).toContain('国产替代逻辑强化');
    expect(dialog?.textContent).toContain('冲高回落');
    expect(dialog?.textContent).toContain('结构性防守');

    await act(async () => root.unmount());
  });

  it('requests an explicitly supplied historical analysis date', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<MarketAnalysis analysisDate="2026-08-11" />));
    await act(async () => root.render(<MarketAnalysis analysisDate="2026-08-01" />));

    expect(apiMocks.getPreopenAnalysis).toHaveBeenLastCalledWith('2026-08-01');

    await act(async () => root.unmount());
  });
});

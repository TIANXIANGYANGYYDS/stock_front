// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  getPreopenAnalysis: vi.fn().mockResolvedValue({
    date: '2026-08-07',
    tradeDate: '2026-08-07',
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
  }),
}));

import { MarketAnalysis } from './MarketAnalysis';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MarketAnalysis details', () => {
  it('opens the complete morning mainline detail instead of navigating to a stock', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<MarketAnalysis preferredTradeDate="2026-08-07" />));
    await act(async () => Promise.resolve());

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
});

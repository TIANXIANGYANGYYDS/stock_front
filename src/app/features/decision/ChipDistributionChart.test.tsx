// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ChipDistributionChart } from './ChipDistributionChart';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ChipDistributionChart SVG rendering contract', () => {
  it('uses user-space stroke gradients so zero-height density lines remain visible', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ChipDistributionChart
          tradeDate="2026-08-07"
          currentPrice={10}
          chip={{
            profitRatio: 0.5,
            avgCost: 9.8,
            cost90: null,
            cost70: null,
            chart: { x: [2, 6], y: [9, 11] },
          }}
        />,
      );
    });

    const gradients = [...host.querySelectorAll('linearGradient')];
    expect(gradients).toHaveLength(2);
    gradients.forEach((gradient) => {
      expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
    });
    expect(host.querySelectorAll('.chip-density-line')).toHaveLength(2);

    await act(async () => root.unmount());
  });
});

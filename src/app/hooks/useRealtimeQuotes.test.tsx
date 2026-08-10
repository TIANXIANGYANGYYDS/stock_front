// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getRealtimeMarketIndices: vi.fn(),
  getRealtimeStocks: vi.fn(),
  getRealtimeStock: vi.fn(),
}));

vi.mock('../lib/api', () => apiMocks);

import {
  useRealtimeMarketIndices,
  useRealtimeStock,
  useRealtimeStocks,
} from './useRealtimeQuotes';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  Object.values(apiMocks).forEach((mock) => mock.mockReset());
});

async function render(element: React.ReactNode): Promise<void> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(element));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function BatchHarness({ codes }: { codes: string[] }) {
  useRealtimeStocks(codes);
  return null;
}

function SingleHarness({ code }: { code: string }) {
  useRealtimeStock(code);
  return null;
}

function IndicesHarness() {
  useRealtimeMarketIndices();
  return null;
}

const closedStocks = {
  tradingDate: '2026-08-10',
  marketStatus: 'closed',
  interval: '1m',
  items: [],
  missingCodes: [],
};

describe('realtime quote domain hooks', () => {
  it('normalizes, de-duplicates, and sorts batch stock codes', async () => {
    apiMocks.getRealtimeStocks.mockResolvedValue(closedStocks);

    await render(<BatchHarness codes={[' 600519 ', '000001', '600519', '']} />);

    expect(apiMocks.getRealtimeStocks).toHaveBeenCalledTimes(1);
    expect(apiMocks.getRealtimeStocks).toHaveBeenCalledWith(
      ['000001', '600519'],
      '1m',
      expect.any(AbortSignal),
    );
  });

  it('does not request empty batch or single-stock queries', async () => {
    await render(<BatchHarness codes={['', '   ']} />);
    expect(apiMocks.getRealtimeStocks).not.toHaveBeenCalled();
    await act(async () => root?.unmount());
    root = null;

    await render(<SingleHarness code="" />);
    expect(apiMocks.getRealtimeStock).not.toHaveBeenCalled();
  });

  it('forwards the selected stock and market-index signals to their API functions', async () => {
    apiMocks.getRealtimeStock.mockResolvedValue(closedStocks);
    apiMocks.getRealtimeMarketIndices.mockResolvedValue({
      tradingDate: '2026-08-10',
      marketStatus: 'closed',
      updatedAt: '2026-08-10T15:00:00+08:00',
      cacheAgeMs: 0,
      items: [],
    });

    await render(<SingleHarness code=" 600519 " />);
    expect(apiMocks.getRealtimeStock).toHaveBeenCalledWith(
      '600519',
      '1m',
      expect.any(AbortSignal),
    );
    await act(async () => root?.unmount());
    root = null;

    await render(<IndicesHarness />);
    expect(apiMocks.getRealtimeMarketIndices).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});

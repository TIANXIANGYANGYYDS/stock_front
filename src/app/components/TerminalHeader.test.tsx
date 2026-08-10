// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TerminalHeader } from './TerminalHeader';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TerminalHeader market index strip', () => {
  it('shows market index identities and never presents ordinary stocks as indices', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <TerminalHeader
          activeView="decision"
          tradeDate="2026-08-07"
          marketLoading={false}
          marketError={null}
          onViewChange={vi.fn()}
        />,
      );
    });

    expect(host.textContent).toContain('上证指数');
    expect(host.textContent).toContain('大盘指数');
    expect(host.textContent).toContain('深证成指');
    expect(host.textContent).toContain('创业板指');
    expect(host.textContent).toContain('科创50');
    expect(host.textContent).toContain('沪深300');
    expect(host.textContent).toContain('指数接口待接入');

    await act(async () => root.unmount());
  });

  it('exposes a fourth creator workspace navigation action', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onViewChange = vi.fn();

    await act(async () => {
      root.render(
        <TerminalHeader
          activeView="decision"
          tradeDate="2026-08-07"
          marketLoading={false}
          marketError={null}
          onViewChange={onViewChange}
        />,
      );
    });

    const creatorButton = [...host.querySelectorAll('button')].find(
      (item) => item.textContent?.includes('博主观点'),
    );
    expect(creatorButton).toBeTruthy();
    await act(async () => creatorButton?.click());
    expect(onViewChange).toHaveBeenCalledWith('creators');

    await act(async () => root.unmount());
  });
});

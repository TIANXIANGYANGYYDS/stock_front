// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { StockListItem } from '../../lib/api';
import { StockNavigator } from './StockNavigator';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const items: StockListItem[] = [
  { code: '000001', name: '平安银行', tradeDate: '2026-08-07', close: 11.2, changePercent: 1.1, amount: 10 },
  { code: '600000', name: '浦发银行', tradeDate: '2026-08-07', close: 10.8, changePercent: -0.8, amount: 9 },
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('StockNavigator', () => {
  it('keeps search and selected stock as visible user-controlled state', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    function Harness() {
      const [query, setQuery] = useState('');
      const [selectedCode, setSelectedCode] = useState('000001');
      return (
        <>
          <StockNavigator
            items={items}
            query={query}
            selectedCode={selectedCode}
            loading={false}
            error={null}
            onQueryChange={setQuery}
            onSelect={setSelectedCode}
          />
          <output>{query}|{selectedCode}</output>
        </>
      );
    }

    await act(async () => root.render(<Harness />));
    const input = host.querySelector('input');
    if (!input) throw new Error('Missing stock search input');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '浦发');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const stockButton = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('浦发银行'));
    if (!stockButton) throw new Error('Missing stock row');
    await act(async () => stockButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(host.querySelector('output')?.textContent).toBe('浦发|600000');
    expect(stockButton.className).toContain('is-active');

    await act(async () => root.unmount());
  });

  it('keeps prior stock buttons visible while a replacement query is loading', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <StockNavigator
        items={items}
        query="平安"
        selectedCode="000001"
        loading
        error={null}
        onQueryChange={() => undefined}
        onSelect={() => undefined}
      />,
    ));

    expect(host.textContent).toContain('查询中');
    expect([...host.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      expect.stringContaining('平安银行'),
      expect.stringContaining('浦发银行'),
    ]);

    await act(async () => root.unmount());
  });

  it('shows the retained list and failure notice when a replacement query fails', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <StockNavigator
        items={items}
        query="平安"
        selectedCode="000001"
        loading={false}
        error="网络异常"
        onQueryChange={() => undefined}
        onSelect={() => undefined}
      />,
    ));

    expect(host.textContent).toContain('查询失败，保留上次结果');
    expect(host.textContent).toContain('平安银行');
    expect(host.textContent).toContain('浦发银行');

    await act(async () => root.unmount());
  });
});

// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TerminalHeader } from './TerminalHeader';
import type { RealtimeMarketIndicesResponse } from '../lib/api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TerminalHeader market index strip', () => {
  const realtimeIndices: RealtimeMarketIndicesResponse = {
    tradingDate: '2026-08-10',
    marketStatus: 'open',
    updatedAt: '2026-08-10T01:30:05Z',
    cacheAgeMs: 0,
    items: [
      {
        symbol: '000300.SH', name: '沪深300', market: 'SH', price: 4620,
        previousClose: 4620, change: 0, changePercent: 0, open: 4620, high: 4620,
        low: 4620, volume: 1, amount: 1, sourceTime: '', receivedAt: '',
        status: 'live', provider: 'tencent',
      },
      {
        symbol: '399001.SZ', name: '深证成指', market: 'SZ', price: 12450,
        previousClose: 12500, change: -50, changePercent: -0.4, open: 12500, high: 12510,
        low: 12400, volume: 1, amount: 1, sourceTime: '', receivedAt: '',
        status: 'live', provider: 'tencent',
      },
      {
        symbol: '000001.SH', name: '上证指数', market: 'SH', price: 3966.59,
        previousClose: 3940.04, change: 26.55, changePercent: 0.67, open: 3943.82,
        high: 3967.59, low: 3938.63, volume: 1, amount: 1, sourceTime: '',
        receivedAt: '', status: 'live', provider: 'tencent',
      },
      {
        symbol: '399006.SZ', name: '创业板指', market: 'SZ', price: 2800,
        previousClose: 2790, change: 10, changePercent: 0.36, open: 2790, high: 2810,
        low: 2780, volume: 1, amount: 1, sourceTime: '', receivedAt: '',
        status: 'live', provider: 'tencent',
      },
      {
        symbol: '000688.SH', name: '科创50', market: 'SH', price: 1050,
        previousClose: 1040, change: 10, changePercent: 0.96, open: 1040, high: 1060,
        low: 1035, volume: 1, amount: 1, sourceTime: '', receivedAt: '',
        status: 'live', provider: 'tencent',
      },
    ],
  };

  it('renders live indices in canonical order with A-share tones and Shanghai time', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <TerminalHeader
          activeView="decision"
          tradeDate="2026-08-07"
          realtimeIndices={realtimeIndices}
          indicesLoading={false}
          indicesDelayed={false}
          indicesError={null}
          onViewChange={vi.fn()}
        />,
      );
    });

    const tickers = [...host.querySelectorAll('.index-ticker')];
    expect(tickers.map((item) => item.textContent)).toEqual([
      expect.stringContaining('上证指数'),
      expect.stringContaining('深证成指'),
      expect.stringContaining('创业板指'),
      expect.stringContaining('科创50'),
      expect.stringContaining('沪深300'),
    ]);
    expect(tickers[0].textContent).toContain('3966.59');
    expect(tickers[0].textContent).toContain('+26.55');
    expect(tickers[0].textContent).toContain('+0.67%');
    expect(tickers[0].className).toContain('is-rise');
    expect(tickers[1].className).toContain('is-fall');
    expect(tickers[4].className).toContain('is-flat');
    expect(host.textContent).toContain('行情数据日期');
    expect(host.textContent).toContain('2026-08-10');
    expect(host.textContent).toContain('更新 09:30:05');
    expect(host.textContent).not.toContain('接口待接入');

    await act(async () => root.unmount());
  });

  it('keeps all successful index quotes visible as the last quote after market close', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <TerminalHeader
        activeView="decision"
        tradeDate="2026-08-07"
        realtimeIndices={{ ...realtimeIndices, marketStatus: 'closed' }}
        indicesLoading={false}
        indicesDelayed={false}
        indicesError={null}
        onViewChange={vi.fn()}
      />,
    ));

    const tickers = [...host.querySelectorAll('.index-ticker')];
    expect(tickers).toHaveLength(5);
    expect(tickers.map((item) => item.textContent)).toEqual([
      expect.stringContaining('3966.59'),
      expect.stringContaining('12450.00'),
      expect.stringContaining('2800.00'),
      expect.stringContaining('1050.00'),
      expect.stringContaining('4620.00'),
    ]);
    expect(host.textContent).toContain('已闭市');
    expect(host.textContent).toContain('最后行情');
    expect(host.textContent).toContain('更新 09:30:05');
    expect(host.querySelector('.market-session small')?.className).not.toContain('is-delayed');

    await act(async () => root.unmount());
  });

  it('keeps stale values visible while marking closed and delayed states', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <TerminalHeader
        activeView="decision"
        tradeDate="2026-08-07"
        realtimeIndices={{ ...realtimeIndices, marketStatus: 'closed' }}
        indicesLoading={false}
        indicesDelayed
        indicesError="数据可能延迟"
        onViewChange={vi.fn()}
      />,
    ));

    expect(host.textContent).toContain('已闭市');
    expect(host.textContent).toContain('数据可能延迟');
    expect(host.textContent).toContain('最后行情');
    expect(host.textContent).toContain('3966.59');

    await act(async () => root.unmount());
  });

  it('treats the backend stale market status as delayed while retaining quotes', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <TerminalHeader
        activeView="decision"
        tradeDate="2026-08-07"
        realtimeIndices={{ ...realtimeIndices, marketStatus: 'stale' }}
        indicesLoading={false}
        indicesDelayed={false}
        indicesError={null}
        onViewChange={vi.fn()}
      />,
    ));

    expect(host.textContent).toContain('数据延迟');
    expect(host.textContent).toContain('数据可能延迟');
    expect(host.textContent).toContain('3966.59');
    expect(host.querySelector('.market-session small')?.className).toContain('is-delayed');

    await act(async () => root.unmount());
  });

  it('treats any stale index item as delayed while retaining all quotes', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const items = realtimeIndices.items.map((item, index) => (
      index === 0 ? { ...item, status: 'stale' } : item
    ));

    await act(async () => root.render(
      <TerminalHeader
        activeView="decision"
        tradeDate="2026-08-07"
        realtimeIndices={{ ...realtimeIndices, items }}
        indicesLoading={false}
        indicesDelayed={false}
        indicesError={null}
        onViewChange={vi.fn()}
      />,
    ));

    expect(host.textContent).toContain('数据延迟');
    expect(host.textContent).toContain('数据可能延迟');
    expect(host.textContent).toContain('3966.59');
    expect(host.querySelector('.market-session small')?.className).toContain('is-delayed');

    await act(async () => root.unmount());
  });

  it('shows unavailable without claiming a last quote when the initial index request fails', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(
      <TerminalHeader
        activeView="decision"
        tradeDate="2026-08-07"
        realtimeIndices={null}
        indicesLoading={false}
        indicesDelayed={false}
        indicesError="网络请求失败"
        onViewChange={vi.fn()}
      />,
    ));

    expect(host.textContent).toContain('行情暂不可用');
    expect(host.textContent).not.toContain('最后行情');

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
          realtimeIndices={null}
          indicesLoading={false}
          indicesDelayed={false}
          indicesError="行情暂不可用"
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

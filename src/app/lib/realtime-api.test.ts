import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiRequestError,
  getRealtimeMarketIndices,
  getStockIntraday,
  getRealtimeStock,
  getRealtimeStocks,
  mapRealtimeMarketIndex,
  mapStockIntradayBar,
  mapStockRealtimeQuote,
} from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('realtime quote mapping', () => {
  it('maps index values while preserving missing numeric fields', () => {
    const mapped = mapRealtimeMarketIndex({
      symbol: '000001.SH',
      name: '上证指数',
      market: 'SH',
      price: '3966.59',
      previous_close: null,
      change: 26.55,
      change_pct: '0.67',
      open: 3943.82,
      high: 3967.59,
      low: 3938.63,
      volume: 542118110,
      amount: 1166893282354,
      source_time: '2026-08-10T09:30:04+08:00',
      received_at: '2026-08-10T09:30:05+08:00',
      status: 'live',
      provider: 'tencent',
    });

    expect(mapped).toEqual({
      symbol: '000001.SH',
      name: '上证指数',
      market: 'SH',
      price: 3966.59,
      previousClose: null,
      change: 26.55,
      changePercent: 0.67,
      open: 3943.82,
      high: 3967.59,
      low: 3938.63,
      volume: 542118110,
      amount: 1166893282354,
      sourceTime: '2026-08-10T09:30:04+08:00',
      receivedAt: '2026-08-10T09:30:05+08:00',
      status: 'live',
      provider: 'tencent',
    });
  });

  it('maps snapshot fields without minute-bar values', () => {
    const rawSnapshot = {
      code: '600519',
      name: '贵州茅台',
      market: 'SH',
      price: 1346.48,
      volume: 1513900,
      amount: 2036498613,
      source_time: '2026-08-11T10:00:00+08:00',
      received_at: '2026-08-11T10:00:01+08:00',
      provider: 'tencent',
    };

    expect(mapStockRealtimeQuote(rawSnapshot)).toEqual({
      code: '600519', name: '贵州茅台', market: 'SH', price: 1346.48,
      volume: 1513900, amount: 2036498613,
      sourceTime: '2026-08-11T10:00:00+08:00',
      receivedAt: '2026-08-11T10:00:01+08:00', provider: 'tencent',
    });
  });

  it('maps intraday OHLC values with a timestamp and interval', () => {
    const rawBar = {
      code: '600519',
      name: '贵州茅台',
      market: 'SH',
      trade_date: '2026-08-11',
      interval: '1m',
      timestamp: '2026-08-11T09:30:00+08:00',
      open: 1346.26,
      high: 1346.26,
      low: 1340,
      close: 1340,
      volume: '1000',
      amount: '1340000',
      provider: 'tencent',
    };

    expect(mapStockIntradayBar(rawBar, '1m')).toEqual({
      code: '600519', name: '贵州茅台', market: 'SH',
      tradeDate: '2026-08-11', interval: '1m',
      timestamp: '2026-08-11T09:30:00+08:00',
      open: 1346.26, high: 1346.26, low: 1340, close: 1340,
      volume: 1000, amount: 1340000, provider: 'tencent',
    });
  });
});

describe('realtime quote requests', () => {
  it('requests all six supported intraday intervals', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      data: { trading_date: '2026-08-11', items: [] },
    }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    await getStockIntraday('600519', '2026-08-11', '1m');
    await getStockIntraday('600519', '2026-08-11', '5m');
    await getStockIntraday('600519', '2026-08-11', '15m');
    await getStockIntraday('600519', '2026-08-11', '30m');
    await getStockIntraday('600519', '2026-08-11', '60m');
    await getStockIntraday('600519', '2026-08-11', '120m');

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/backend-api/api/v1/stocks/600519/intraday?trade_date=2026-08-11&interval=1m',
      '/backend-api/api/v1/stocks/600519/intraday?trade_date=2026-08-11&interval=5m',
      '/backend-api/api/v1/stocks/600519/intraday?trade_date=2026-08-11&interval=15m',
      '/backend-api/api/v1/stocks/600519/intraday?trade_date=2026-08-11&interval=30m',
      '/backend-api/api/v1/stocks/600519/intraday?trade_date=2026-08-11&interval=60m',
      '/backend-api/api/v1/stocks/600519/intraday?trade_date=2026-08-11&interval=120m',
    ]);
  });

  it('uses realtime URLs without intervals and an intraday URL with encoded query values', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { trading_date: '2026-08-11', market_status: 'open', items: [] },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { trading_date: '2026-08-11', market_status: 'open', items: [] },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          code: '600519/path', name: '贵州茅台', trade_date: '2026-08-11',
          interval: '1m', count: 1,
          items: [{
            code: '600519/path', name: '贵州茅台', market: 'SH',
            trade_date: '2026-08-11', interval: '1m',
            timestamp: '2026-08-11T09:30:00+08:00',
            open: 1346.26, high: 1346.26, low: 1340, close: 1340,
            volume: 1000, amount: 1340000, provider: 'TENCENT',
          }],
        },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await getRealtimeStocks([' 600519 ', '000001', '600519', ''], controller.signal);
    await getRealtimeStock('600519/path', controller.signal);
    const intraday = await getStockIntraday('600519/path', '2026-08-11 09:30', '1m', controller.signal);

    expect(intraday).toEqual({
      code: '600519/path', name: '贵州茅台', tradeDate: '2026-08-11',
      interval: '1m', count: 1,
      items: [{
        code: '600519/path', name: '贵州茅台', market: 'SH', tradeDate: '2026-08-11',
        interval: '1m', timestamp: '2026-08-11T09:30:00+08:00',
        open: 1346.26, high: 1346.26, low: 1340, close: 1340,
        volume: 1000, amount: 1340000, provider: 'TENCENT',
      }],
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/backend-api/api/v1/stocks/realtime?codes=600519%2C000001',
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('interval');
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      '/backend-api/api/v1/stocks/600519%2Fpath/realtime',
    );
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('interval');
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      '/backend-api/api/v1/stocks/600519%2Fpath/intraday?trade_date=2026-08-11+09%3A30&interval=1m',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ signal: controller.signal });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ signal: controller.signal });
  });

  it('falls back to mapped intraday item count when response count is not finite', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        count: 'unknown',
        items: [{ code: '600519', timestamp: '2026-08-11T09:30:00+08:00', open: 1, high: 2, low: 1, close: 2 }],
      },
    }), { status: 200 })));

    await expect(getStockIntraday('600519', '2026-08-11', '5m')).resolves.toMatchObject({ count: 1 });
  });
});

describe('realtime request errors', () => {
  it('exposes the HTTP status for unavailable realtime services', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: 'realtime provider unavailable',
    }), { status: 503 })));

    const request = getRealtimeMarketIndices();

    await expect(request).rejects.toBeInstanceOf(ApiRequestError);
    await expect(request).rejects.toMatchObject({ status: 503 });
  });
});

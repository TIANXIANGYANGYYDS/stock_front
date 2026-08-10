import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiRequestError,
  getRealtimeMarketIndices,
  getRealtimeStock,
  getRealtimeStocks,
  mapRealtimeMarketIndex,
  mapRealtimeStockQuote,
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

  it('uses stock close as the current price without inventing change fields', () => {
    const mapped = mapRealtimeStockQuote({
      code: '600519',
      name: '贵州茅台',
      market: 'SH',
      trade_date: '2026-08-10',
      interval: '1m',
      timestamp: '2026-08-10T09:31:00+08:00',
      open: 1348,
      high: 1349.2,
      low: 1347.5,
      close: '1348.86',
      volume: 1000,
      amount: 1348860,
      provider: 'TENCENT',
    });

    expect(mapped).toMatchObject({
      code: '600519',
      close: 1348.86,
      timestamp: '2026-08-10T09:31:00+08:00',
    });
    expect(mapped).not.toHaveProperty('previousClose');
    expect(mapped).not.toHaveProperty('change');
    expect(mapped).not.toHaveProperty('changePercent');
  });
});

describe('realtime quote requests', () => {
  it('uses API_BASE_URL paths, normalized batch codes, intervals, and AbortSignal', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          trading_date: '2026-08-10',
          market_status: 'open',
          updated_at: '2026-08-10T09:30:05+08:00',
          cache_age_ms: 0,
          items: [{ symbol: '000001.SH', name: '上证指数', price: 3966.59 }],
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          trading_date: '2026-08-10',
          market_status: 'open',
          interval: '1m',
          items: [{ code: '600519', close: 1348.86 }],
          missing_codes: ['000001'],
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          trading_date: '2026-08-10',
          market_status: 'open',
          interval: '5m',
          items: [{ code: '600519/path', close: 1348.86 }],
          missing_codes: [],
        },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const indices = await getRealtimeMarketIndices(controller.signal);
    const batch = await getRealtimeStocks(
      [' 600519 ', '000001', '600519', ''],
      '1m',
      controller.signal,
    );
    const single = await getRealtimeStock('600519/path', '5m', controller.signal);

    expect(indices).toMatchObject({
      tradingDate: '2026-08-10',
      marketStatus: 'open',
      updatedAt: '2026-08-10T09:30:05+08:00',
      cacheAgeMs: 0,
    });
    expect(batch.missingCodes).toEqual(['000001']);
    expect(single.items[0]).toMatchObject({ code: '600519/path', close: 1348.86 });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/backend-api/api/v1/market/indices/realtime',
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      '/backend-api/api/v1/stocks/realtime?codes=600519%2C000001&interval=1m',
    );
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      '/backend-api/api/v1/stocks/600519%2Fpath/realtime?interval=5m',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ signal: controller.signal });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ signal: controller.signal });
  });

  it('exposes the HTTP status for unavailable realtime services', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: 'realtime provider unavailable',
    }), { status: 503 })));

    const request = getRealtimeMarketIndices();

    await expect(request).rejects.toBeInstanceOf(ApiRequestError);
    await expect(request).rejects.toMatchObject({ status: 503 });
  });
});

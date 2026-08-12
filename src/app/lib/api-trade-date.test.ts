import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getNews,
  getNewsSentimentOverview,
  getLatestMarketDates,
  getMarketOverview,
  getPreopenAnalysis,
  getSectorStocks,
  getSectorTrend,
  getStockDetail,
  getStockList,
} from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('latest trading date API contract', () => {
  it('reads separate market and morning-analysis dates from the market endpoint', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({
        data: {
          latest_trade_date: '2026-08-10',
          latest_analysis_date: '2026-08-11',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));

    const result = await getLatestMarketDates();

    expect(result).toEqual({
      marketTradeDate: '2026-08-10',
      analysisDate: '2026-08-11',
    });
    expect(requests).toEqual([
      '/backend-api/api/v1/market/latest-trade-date',
    ]);
  });

  it('routes market data to the trade date and morning analysis to the analysis date', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const payload = url.endsWith('/api/v1/market/latest-trade-date')
        ? {
            data: {
              latest_trade_date: '2026-08-10',
              latest_analysis_date: '2026-08-11',
            },
          }
        : url.endsWith('/api/v1/stats')
          ? { stocks: { stock_count: 0 }, news: { total: 0 } }
          : url.includes('/api/v1/morning-analyses/')
            ? {
                data: {
                  analysis_date: '2026-08-11',
                  trade_date: '2026-08-10',
                  analysis: { mainlines: [] },
                },
              }
            : { items: [], total: 0 };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const dates = await getLatestMarketDates();
    if (!dates.marketTradeDate) throw new Error('Missing market trade date');
    const analysis = await getPreopenAnalysis(dates.analysisDate);
    await getMarketOverview(dates.marketTradeDate);

    expect(analysis).toMatchObject({
      analysisDate: '2026-08-11',
      tradeDate: '2026-08-10',
    });
    expect(requests).toContain(
      '/backend-api/api/v1/morning-analyses/2026-08-11',
    );
    expect(requests).toContain(
      '/backend-api/api/v1/stock-daily/2026-08-10?page=1&page_size=5&adjust=qfq&sort_by=pct_chg&sort_order=desc',
    );
  });

  it.each([
    { caseName: 'null', latestAnalysisDate: null },
    { caseName: 'missing', latestAnalysisDate: undefined },
  ])('requests the latest morning analysis when latest_analysis_date is $caseName', async ({
    latestAnalysisDate,
  }) => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const payload = url.endsWith('/api/v1/market/latest-trade-date')
        ? {
            data: {
              latest_trade_date: '2026-08-10',
              ...(latestAnalysisDate === undefined
                ? {}
                : { latest_analysis_date: latestAnalysisDate }),
            },
          }
        : {
            data: {
              analysis_date: '2026-08-11',
              trade_date: '2026-08-10',
              analysis: { mainlines: [] },
            },
          };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const dates = await getLatestMarketDates();
    await getPreopenAnalysis(dates.analysisDate);

    expect(requests).toEqual([
      '/backend-api/api/v1/market/latest-trade-date',
      '/backend-api/api/v1/morning-analyses/latest',
    ]);
    expect(requests).not.toContain(
      '/backend-api/api/v1/morning-analyses/2026-08-10',
    );
  });

  it('preserves empty latest dates instead of inventing calendar dates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: { latest_trade_date: null, latest_analysis_date: null },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    await expect(getLatestMarketDates()).resolves.toEqual({
      marketTradeDate: null,
      analysisDate: null,
    });
  });

  it('uses the resolved market date even when stats exposes a different date', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const payload = url.endsWith('/api/v1/stats')
        ? { stocks: { stock_count: 0, latest_trade_date: '2099-01-01' }, news: { total: 0 } }
        : { items: [], total: 0 };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const result = await getMarketOverview('2026-08-07');

    expect(result.tradeDate).toBe('2026-08-07');
    expect(requests).toEqual([
      '/backend-api/api/v1/stats',
      '/backend-api/api/v1/stock-daily/2026-08-07?page=1&page_size=5&adjust=qfq&sort_by=pct_chg&sort_order=desc',
    ]);
  });


  it('requests an explicitly selected historical morning-analysis date', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({
        data: {
          analysis_date: '2026-08-01',
          trade_date: '2026-07-31',
          analysis: { mainlines: [] },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));

    await getPreopenAnalysis('2026-08-01');

    expect(requests).toEqual([
      '/backend-api/api/v1/morning-analyses/2026-08-01',
    ]);
  });

  it('preserves complete morning mainline fields for the detail view', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: {
        analysis_date: '2026-08-07',
        trade_date: '2026-08-07',
        analysis: {
          market_style: '结构性防守',
          risk_level: 'high',
          risk_summary: '流动性收缩风险延续',
          mainlines: [{
            rank: 1,
            sector_name: '软件开发',
            role: 'main_attack',
            confidence: 70,
            reason: '国产替代逻辑强化',
            risks: ['冲高回落', '成交不足'],
          }],
        },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const response = await getPreopenAnalysis('2026-08-07');

    expect(response).toMatchObject({
      marketStyle: '结构性防守',
      riskLevel: 'high',
      riskSummary: '流动性收缩风险延续',
      mainLines: [{
        title: '软件开发',
        role: '主攻方向',
        confidence: 70,
        reason: '国产替代逻辑强化',
        risks: ['冲高回落', '成交不足'],
      }],
    });
  });

  it('treats a missing dated morning analysis as empty data without retrying latest', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ detail: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    await expect(getPreopenAnalysis('2026-08-07')).resolves.toEqual({
      analysisDate: '2026-08-07',
      tradeDate: '',
      analysisText: '',
      mainLines: [],
    });
    expect(requests).toEqual([
      '/backend-api/api/v1/morning-analyses/2026-08-07',
    ]);
  });

  it('keeps the requested date when the dated morning analysis body is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(getPreopenAnalysis('2026-08-07')).resolves.toEqual({
      analysisDate: '2026-08-07',
      tradeDate: '',
      analysisText: '',
      mainLines: [],
    });
  });

  it('builds a three-day ranking trend from stored snapshots without using future dates', async () => {
    const requests: string[] = [];
    const snapshots = [
      {
        snapshot_id: 'future', biz_date: '2026-08-08', generated_at: '2026-08-08T00:19:00',
        investment_ranking: [{ rank: 1, sector_name: '未来板块', final_score: 99 }], heat_ranking: [],
      },
      {
        snapshot_id: 'latest', biz_date: '2026-08-07', generated_at: '2026-08-07T15:58:00',
        investment_ranking: [{ rank: 1, sector_name: '半导体', final_score: 82, news_count: 30 }], heat_ranking: [],
      },
      {
        snapshot_id: 'early', biz_date: '2026-08-05', generated_at: '2026-08-05T15:58:00',
        investment_ranking: [{ rank: 2, sector_name: '半导体', final_score: 70, news_count: 18 }], heat_ranking: [],
      },
      {
        snapshot_id: 'old', biz_date: '2026-08-04', generated_at: '2026-08-04T15:58:00',
        investment_ranking: [{ rank: 1, sector_name: '旧板块', final_score: 88 }], heat_ranking: [],
      },
    ];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ items: snapshots, total: snapshots.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const response = await getSectorTrend('2026-08-07', '3day');

    expect(requests).toEqual([
      '/backend-api/api/v1/news-rankings?page=1&page_size=200',
    ]);
    expect(response.items.map((item) => [item.name, item.score, item.change])).toEqual([
      ['半导体', 82, 12],
    ]);
    expect(response.series).toEqual([{
      name: '半导体',
      data: [
        { date: '2026-08-05 15:58', value: 70 },
        { date: '2026-08-07 15:58', value: 82 },
      ],
    }]);
  });

  it('keeps the requested trading date when the ranking response is empty', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    await expect(getSectorTrend('2026-08-07')).resolves.toEqual({
      bizDate: '2026-08-07',
      items: [],
      series: [],
    });
    expect(requests).toEqual(['/backend-api/api/v1/news-rankings?page=1&page_size=200']);
  });

  it('treats a missing dated ranking as empty data without retrying latest', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ detail: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    await expect(getSectorTrend('2026-08-07')).resolves.toEqual({
      bizDate: '2026-08-07',
      items: [],
      series: [],
    });
    expect(requests).toEqual(['/backend-api/api/v1/news-rankings?page=1&page_size=200']);
  });

  it('limits the default news request to the resolved latest trading date', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const response = await getNews({ tradeDate: '2026-08-07' });

    expect(response.tradeDate).toBe('2026-08-07');
    expect(requests).toEqual([
      '/backend-api/api/v1/news?page=1&page_size=200&start_ts=1786032000&end_ts=1786118399',
    ]);
  });

  it('expands a seven-day news window backwards from the resolved trading date', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    await getNews({ tradeDate: '2026-08-07', windowDays: 7 });

    expect(requests).toEqual([
      '/backend-api/api/v1/news?page=1&page_size=200&start_ts=1785513600&end_ts=1786118399',
    ]);
  });

  it('does not substitute the current calendar date when news data is empty', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(
        JSON.stringify({ items: [], total: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }));
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('The current calendar clock must not be read');
    });

    const result = await getNewsSentimentOverview('2026-08-07');

    expect(result.tradeDate).toBe('2026-08-07');
    expect(result.counts?.total).toBe(0);
    expect(requests).toEqual([
      '/backend-api/api/v1/news?page=1&page_size=200&start_ts=1785945600&end_ts=1786118399',
    ]);
  });

  it('loads the latest market pool from the resolved trading date without resolving today again', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const payload = url.includes('/stock-daily/2026-08-07')
        ? { items: [{ code: '000001', name: '测试股票', trade_date: '2026-08-07' }], total: 1 }
        : { items: [], total: 0 };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    await getSectorStocks('最新行情', '2026-08-07');

    expect(requests).toEqual([
      '/backend-api/api/v1/stock-daily/2026-08-07?page=1&page_size=12&adjust=qfq&sort_by=pct_chg&sort_order=desc',
      '/backend-api/api/v1/stocks/000001/daily?page=1&page_size=120&adjust=qfq&end_date=2026-08-07',
    ]);
  });

  it('searches the stock universe and loads only the selected stock history', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const payload = url.includes('/stocks?')
        ? {
            items: [{ code: '000001', name: '平安银行', latest_trade_date: '2026-08-07', latest_close: 11.2 }],
            total: 1,
          }
        : {
            items: [{
              code: '000001', name: '平安银行', trade_date: '2026-08-07',
              open: 11, high: 11.4, low: 10.9, close: 11.2,
            }],
            total: 1,
          };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const matches = await getStockList('2026-08-07', '平安');
    const detail = await getStockDetail('000001', '2026-08-07');

    expect(matches).toEqual([{
      code: '000001', name: '平安银行', tradeDate: '2026-08-07', close: 11.2,
      changePercent: null, amount: null,
    }]);
    expect(detail?.code).toBe('000001');
    expect(detail?.kline).toHaveLength(1);
    expect(requests).toEqual([
      '/backend-api/api/v1/stocks?page=1&page_size=50&keyword=%E5%B9%B3%E5%AE%89&adjust=qfq',
      '/backend-api/api/v1/stocks/000001/daily?page=1&page_size=120&adjust=qfq&end_date=2026-08-07',
    ]);
  });

  it('passes supplied abort signals to stock list and detail requests without changing URLs', async () => {
    const requests: Array<{ url: string; signal: AbortSignal | null }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), signal: init?.signal ?? null });
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
    const listController = new AbortController();
    const detailController = new AbortController();

    await getStockList('2026-08-07', '平安', listController.signal);
    await getStockDetail('000001', '2026-08-07', detailController.signal);

    expect(requests).toEqual([
      {
        url: '/backend-api/api/v1/stocks?page=1&page_size=50&keyword=%E5%B9%B3%E5%AE%89&adjust=qfq',
        signal: listController.signal,
      },
      {
        url: '/backend-api/api/v1/stocks/000001/daily?page=1&page_size=120&adjust=qfq&end_date=2026-08-07',
        signal: detailController.signal,
      },
    ]);
  });
});

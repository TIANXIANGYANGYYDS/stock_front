import { describe, expect, it } from 'vitest';
import {
  extractSectorCompanies,
  mapStockProjectDailyBar,
  mapStockProjectNews,
  mapStockProjectRanking,
} from './api';

describe('Stock Project API mappers', () => {
  it('maps nested sector news analysis into terminal news fields', () => {
    const item = mapStockProjectNews({
      event_id: 'news-1',
      publish_ts: 1_786_083_600,
      publish_time: '2026-08-08 09:00:00',
      source: 'cls',
      title: '先进制程订单增长',
      content: '晶圆代工企业订单回暖。',
      sector_llm_analysis: [
        {
          sector_name: '半导体',
          sector_llm_analysis: {
            score: 72,
            reason: '订单增长改善行业景气度。',
            companies: ['中芯国际', '中芯国际'],
          },
        },
        {
          sector_name: '消费电子',
          sector_llm_analysis: {
            score: 30,
            reason: '需求温和复苏。',
            companies: ['立讯精密'],
          },
        },
      ],
    });

    expect(item.id).toBe('news-1');
    expect(item.impact).toBe(72);
    expect(item.sentiment).toBe('positive');
    expect(item.relatedSectors).toEqual(['半导体', '消费电子']);
    expect(item.relatedStocks).toEqual(['中芯国际', '立讯精密']);
    expect(item.analysisReason).toContain('订单增长');
  });

  it('maps ranking score and real counts without inventing history', () => {
    const result = mapStockProjectRanking({
      rank: 2,
      sector_name: '机器人',
      final_score: 81.5,
      news_count: 16,
      positive_news_count: 10,
      negative_news_count: 2,
      latest_publish_ts: 1_786_083_600,
    }, 0);

    expect(result).toMatchObject({
      rank: 2,
      name: '机器人',
      score: 81.5,
      newsCount: 16,
      sentiment: 'positive',
    });
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('maps Stock Project daily records into valid candlestick bars', () => {
    expect(mapStockProjectDailyBar({
      trade_date: '2026-08-08',
      open: 10.2,
      high: 10.8,
      low: 10.1,
      close: 10.7,
      amount: 380_000_000,
      volume: 420_000,
      change_amount: 0.5,
      pct_chg: 4.9,
      amplitude_pct: 6.86,
      turnover_pct: 3.42,
      ma: { ma5: 10.3, ma10: 10.05, ma20: null, ma30: 9.8, ma60: 9.4 },
      volume_ma: { vol_ma5: 400_000, vol_ma10: 360_000, vol_ma20: null, vol_ma60: 280_000 },
      macd: { dif: 0.32, dea: 0.21, hist: 0.22 },
      boll: { mid: 10.1, upper: 11.2, lower: 9.0 },
      kdj: { k: 66.2, d: 60.4, j: 77.8 },
      rsi: { rsi6: 70.1, rsi12: 62.5, rsi24: 58.3 },
      cci: { cci14: 112.6 },
      wr: { wr6: 18.4, wr10: 22.1, wr14: null },
      atr: { atr14: 0.61 },
      chip: {
        profit_ratio: 0.684,
        avg_cost: 10.12,
        cost_90: { low: 8.9, high: 11.4, concentration: 0.1234 },
        cost_70: { low: 9.5, high: 10.9, concentration: 0.0789 },
        chart: { x: [0, 3.5, 8.2], y: [8.9, 10.12, 11.4] },
      },
    })).toEqual({
      date: '2026-08-08',
      open: 10.2,
      high: 10.8,
      low: 10.1,
      close: 10.7,
      amount: 380_000_000,
      volume: 420_000,
      changeAmount: 0.5,
      changePercent: 4.9,
      amplitudePercent: 6.86,
      turnoverPercent: 3.42,
      ma: { ma5: 10.3, ma10: 10.05, ma20: null, ma30: 9.8, ma60: 9.4 },
      volumeMa: { volMa5: 400_000, volMa10: 360_000, volMa20: null, volMa60: 280_000 },
      macd: { dif: 0.32, dea: 0.21, hist: 0.22 },
      boll: { mid: 10.1, upper: 11.2, lower: 9.0 },
      kdj: { k: 66.2, d: 60.4, j: 77.8 },
      rsi: { rsi6: 70.1, rsi12: 62.5, rsi24: 58.3 },
      cci: { cci14: 112.6 },
      wr: { wr6: 18.4, wr10: 22.1, wr14: null },
      atr: { atr14: 0.61 },
      chip: {
        profitRatio: 0.684,
        avgCost: 10.12,
        cost90: { low: 8.9, high: 11.4, concentration: 0.1234 },
        cost70: { low: 9.5, high: 10.9, concentration: 0.0789 },
        chart: { x: [0, 3.5, 8.2], y: [8.9, 10.12, 11.4] },
      },
    });
  });

  it('extracts unique companies only from the selected sector', () => {
    const companies = extractSectorCompanies([
      {
        sector_llm_analysis: [
          { sector_name: '半导体', sector_llm_analysis: { companies: ['中芯国际', '北方华创'] } },
          { sector_name: '机器人', sector_llm_analysis: { companies: ['汇川技术'] } },
        ],
      },
      {
        sector_llm_analysis: [
          { sector_name: '半导体', sector_llm_analysis: { companies: ['中芯国际', '海光信息'] } },
        ],
      },
    ], '半导体');

    expect(companies).toEqual(['中芯国际', '北方华创', '海光信息']);
  });

});

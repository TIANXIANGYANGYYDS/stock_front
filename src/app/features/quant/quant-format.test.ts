import { describe, expect, it } from 'vitest';
import {
  formatQuantDateTime,
  formatQuantMoney,
  formatQuantPnl,
  formatQuantRatio,
  parseQuantDateTime,
  quantDataStatusPresentation,
  quantStatusPresentation,
} from './quant-format';

describe('quant formatting', () => {
  it('formats timestamps in Asia/Shanghai with a full date and time', () => {
    expect(formatQuantDateTime('2026-09-03T02:03:20Z')).toBe('2026-09-03 10:03:20');
    expect(formatQuantDateTime(null)).toBe('—');
    expect(formatQuantDateTime('invalid')).toBe('—');
  });

  it('formats money and ratios without turning null into zero', () => {
    expect(formatQuantMoney(1234567.8)).toBe('1,234,567.80');
    expect(formatQuantMoney(null)).toBe('—');
    expect(formatQuantRatio(0.11373)).toBe('+11.37%');
    expect(formatQuantRatio(-0.0188188)).toBe('-1.88%');
    expect(formatQuantRatio(0)).toBe('0.00%');
    expect(formatQuantPnl(-609524.17)).toBe('-¥609,524.17');
  });

  it('uses one instant for equivalent offsets and treats unzoned market times as Shanghai time', () => {
    const expected = Date.parse('2026-09-04T01:39:00Z');
    expect(parseQuantDateTime('2026-09-04T09:39:00+08:00')).toBe(expected);
    expect(parseQuantDateTime('2026-09-04T01:39:00Z')).toBe(expected);
    expect(parseQuantDateTime('2026-09-04 09:39:00')).toBe(expected);
    expect(formatQuantDateTime('2026-09-04 09:39:00')).toBe('2026-09-04 09:39:00');
    expect(parseQuantDateTime('invalid')).toBeNull();
    expect(parseQuantDateTime(' ')).toBeNull();
  });

  it('preserves the sign of tiny replay returns instead of rounding them to zero', () => {
    expect(formatQuantRatio(-256.07 / 554100000)).toBe('-0.0000462%');
    expect(formatQuantRatio(46080.2 / 554100000)).toBe('+0.00832%');
    expect(formatQuantRatio(1e-14)).toBe('+1.00e-12%');
    expect(formatQuantRatio(0)).toBe('0.00%');
  });

  it('maps every data-quality status and uses a public fallback for unknown statuses', () => {
    expect(quantDataStatusPresentation('waiting_open').label).toContain('等待开盘');
    expect(quantDataStatusPresentation('fresh').label).toContain('数据完整');
    expect(quantDataStatusPresentation('partial').tone).toBe('warning');
    expect(quantDataStatusPresentation('closed').label).toContain('收盘数据完整');
    expect(quantDataStatusPresentation('closed_partial').tone).toBe('warning');
    expect(quantDataStatusPresentation('error').tone).toBe('danger');
    expect(quantStatusPresentation('future_state')).toEqual({ label: '状态待更新', tone: 'neutral' });
  });
});


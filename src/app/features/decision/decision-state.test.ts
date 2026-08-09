import { describe, expect, it } from 'vitest';
import { pickDefaultSector, pickDefaultStock } from './decision-state';

describe('pickDefaultSector', () => {
  it('prefers the highest investment-preference sector before market heat', () => {
    expect(
      pickDefaultSector(
        [{ name: '半导体', rank: 1 }],
        [{ name: '机器人', rank: 1 }],
      ),
    ).toBe('半导体');
  });

  it('falls back to the latest market pool when news rankings are empty', () => {
    expect(pickDefaultSector([], [])).toBe('最新行情');
  });
});

describe('pickDefaultStock', () => {
  it('selects the first stock that contains kline data', () => {
    expect(
      pickDefaultStock([
        { code: '000001', kline: [] },
        { code: '000002', kline: [{ date: '2026-01-01' }] },
      ]),
    ).toBe('000002');
  });
});

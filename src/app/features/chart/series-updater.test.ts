import { describe, expect, it, vi } from 'vitest';
import { createSeriesUpdater } from './series-updater';

describe('chart series updates', () => {
  it('skips unchanged data and updates only the changed live candle and appended points', () => {
    const series = { setData: vi.fn(), update: vi.fn() };
    const update = createSeriesUpdater<{ time: number; value: number }>(series);
    update([{ time: 1, value: 10 }, { time: 2, value: 20 }]);
    update([{ time: 1, value: 10 }, { time: 2, value: 20 }]);
    expect(series.setData).toHaveBeenCalledTimes(1);
    expect(series.update).not.toHaveBeenCalled();
    update([{ time: 1, value: 10 }, { time: 2, value: 21 }, { time: 3, value: 30 }]);
    expect(series.setData).toHaveBeenCalledTimes(1);
    expect(series.update.mock.calls).toEqual([[{ time: 2, value: 21 }], [{ time: 3, value: 30 }]]);
  });

  it('reloads historical corrections, removed indicators and rolled windows', () => {
    const series = { setData: vi.fn(), update: vi.fn() };
    const update = createSeriesUpdater<{ time: number; value: number }>(series);
    const first = [{ time: 1, value: 10 }, { time: 2, value: 20 }];
    update(first);
    const corrected = [{ time: 1, value: 11 }, first[1]];
    update(corrected);
    const rolled = [first[1], { time: 3, value: 30 }];
    update(rolled);
    update([]);
    expect(series.setData.mock.calls).toEqual([[first], [corrected], [rolled], [[]]]);
    expect(series.update).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { movementText, recentMovement, sparklinePath } from './sentiment-movement';
import type { SentimentSecondPoint } from './sentiment-seconds';

const samples = (): SentimentSecondPoint[] => Array.from({ length: 61 }, (_, index) => ({ time: index * 5000, change_ratio: .04 + index / 6000 }));
describe('stock movement observations', () => {
  it('reports a change in percentage points from a continuous five-minute window', () => {
    expect(recentMovement(samples(), 300000)).toBeCloseTo(1);
    expect(movementText(recentMovement(samples(), 300000))).toBe('+1.00 点');
    expect(movementText(-.003)).toBe('0.00 点');
    expect(movementText(null)).toBe('—');
  });
  it('does not treat loading, lunch, missing samples, or stale observations as a recent move', () => {
    expect(recentMovement(samples().slice(0, 40), 300000)).toBeNull();
    expect(recentMovement(samples().slice(1), 300000)).toBeNull();
    expect(recentMovement(samples(), 320000)).toBeNull();
    const missing = samples(); missing[30].change_ratio = null;
    expect(recentMovement(missing, 300000)).toBeNull();
    expect(recentMovement(samples().filter((_, i) => i < 20 || i > 25), 300000)).toBeNull();
    expect(recentMovement([{ time: 0, change_ratio: .1 }, { time: 5400000, change_ratio: .11 }], 5400000)).toBeNull();
  });
  it('ignores points after the selected cutoff and can show negative changes', () => {
    const points = samples().map(point => ({ ...point, change_ratio: -point.change_ratio! }));
    points.push({ time: 305000, change_ratio: .2 });
    expect(recentMovement(points, 300000)).toBeCloseTo(-1);
  });
  it('preserves an intrabucket spike and a gap in a small sparkline', () => {
    const path = sparklinePath([
      { time: 0, change_ratio: 0 }, { time: 1, change_ratio: .1 }, { time: 2, change_ratio: 0 },
      { time: 3, change_ratio: null }, { time: 5, change_ratio: .05 },
    ], time => time / 10000, [0, 10]);
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path).toContain(',3.0'); // the actual 10% extreme survives the pixel bucket
    expect(path).toContain(',29.0');
    expect(sparklinePath([], time => time, [0, 10])).toBe('');
  });
});

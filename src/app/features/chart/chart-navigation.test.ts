import { describe, expect, it } from 'vitest';
import { navigateLogicalRange } from './chart-navigation';

describe('navigateLogicalRange', () => {
  it('zooms around the current center and moves by one fifth of the window', () => {
    const range = { from: 70, to: 100 };

    expect(navigateLogicalRange(range, 'zoom-in', 120)).toEqual({ from: 73, to: 97 });
    expect(navigateLogicalRange(range, 'zoom-out', 120)).toEqual({ from: 66.25, to: 103.75 });
    expect(navigateLogicalRange(range, 'move-left', 120)).toEqual({ from: 64, to: 94 });
    expect(navigateLogicalRange(range, 'move-right', 120)).toEqual({ from: 76, to: 106 });
  });

  it('keeps the logical window inside the available K-line range', () => {
    expect(navigateLogicalRange({ from: 1, to: 21 }, 'move-left', 30))
      .toEqual({ from: 0, to: 20 });
    expect(navigateLogicalRange({ from: 18, to: 30 }, 'move-right', 30))
      .toEqual({ from: 18.5, to: 30.5 });
    expect(navigateLogicalRange({ from: 0, to: 30.5 }, 'zoom-out', 30))
      .toEqual({ from: 0, to: 30.5 });
  });

  it('rejects invalid or empty ranges', () => {
    expect(navigateLogicalRange(null, 'zoom-in', 30)).toBeNull();
    expect(navigateLogicalRange({ from: 10, to: 10 }, 'zoom-in', 30)).toBeNull();
    expect(navigateLogicalRange({ from: 0, to: 10 }, 'zoom-in', 0)).toBeNull();
  });
});

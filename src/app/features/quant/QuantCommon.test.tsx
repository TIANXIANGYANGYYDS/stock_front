import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuantMetricGrid, QuantTableTime } from './QuantCommon';

describe('QuantMetricGrid', () => {
  it('renders backend PnL amounts together with backend return ratios', () => {
    const markup = renderToStaticMarkup(<QuantMetricGrid summary={{
      account_day_pnl: -609524.17,
      account_day_return: -0.0181643,
      total_pnl: -631908.89,
      total_return: -0.0188188,
    }} />);

    expect(markup).toContain('-¥609,524.17');
    expect(markup).toContain('-1.82%');
    expect(markup).toContain('-¥631,908.89');
    expect(markup).toContain('-1.88%');
  });
});

describe('QuantTableTime', () => {
  it('keeps the full Shanghai date and seconds when a timestamp crosses midnight', () => {
    const markup = renderToStaticMarkup(<QuantTableTime value="2026-09-04T16:05:09Z" />);
    expect(markup.replace(/<[^>]+>/g, '')).toBe('2026-09-05 00:05:09');
    expect(markup).toMatch(/datetime="2026-09-04T16:05:09Z"/i);
  });

  it('keeps missing and invalid timestamps empty instead of inventing a date', () => {
    for (const value of [null, undefined, '', 'invalid']) {
      const markup = renderToStaticMarkup(<QuantTableTime value={value} />);
      expect(markup.replace(/<[^>]+>/g, '')).toBe('—');
      expect(markup).not.toContain('<time');
    }
  });
});


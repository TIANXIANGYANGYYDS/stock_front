export type ChartNavigationAction =
  | 'zoom-in'
  | 'zoom-out'
  | 'move-left'
  | 'move-right';

export interface LogicalChartRange {
  from: number;
  to: number;
}

const MIN_VISIBLE_BARS = 6;
const ZOOM_IN_FACTOR = 0.8;
const ZOOM_OUT_FACTOR = 1.25;
const MOVE_FACTOR = 0.2;

function clampWindow(
  center: number,
  span: number,
  minimum: number,
  maximum: number,
): LogicalChartRange {
  const availableSpan = maximum - minimum;
  const nextSpan = Math.min(span, availableSpan);
  let from = center - nextSpan / 2;
  let to = center + nextSpan / 2;

  if (from < minimum) {
    to += minimum - from;
    from = minimum;
  }
  if (to > maximum) {
    from -= to - maximum;
    to = maximum;
  }

  return { from, to };
}

export function navigateLogicalRange(
  range: LogicalChartRange | null,
  action: ChartNavigationAction,
  barCount: number,
): LogicalChartRange | null {
  if (
    !range
    || barCount <= 0
    || !Number.isFinite(range.from)
    || !Number.isFinite(range.to)
    || range.to <= range.from
  ) {
    return null;
  }

  const minimum = 0;
  const maximum = barCount + 0.5;
  const availableSpan = maximum - minimum;
  const currentSpan = Math.min(range.to - range.from, availableSpan);
  const center = (range.from + range.to) / 2;

  if (action === 'zoom-in') {
    const span = Math.min(availableSpan, Math.max(MIN_VISIBLE_BARS, currentSpan * ZOOM_IN_FACTOR));
    return clampWindow(center, span, minimum, maximum);
  }
  if (action === 'zoom-out') {
    const span = Math.min(availableSpan, currentSpan * ZOOM_OUT_FACTOR);
    return clampWindow(center, span, minimum, maximum);
  }

  const offset = currentSpan * MOVE_FACTOR * (action === 'move-left' ? -1 : 1);
  return clampWindow(center + offset, currentSpan, minimum, maximum);
}

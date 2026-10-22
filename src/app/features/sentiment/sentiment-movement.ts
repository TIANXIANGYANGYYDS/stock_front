import type { SentimentSecondPoint } from './sentiment-seconds';

const MAX_SAMPLE_GAP = 15_000;
/** A five-minute change in percentage points, only for a complete, recent window. */
export function recentMovement(points: SentimentSecondPoint[], through: number, window = 300_000): number | null {
  let last = points.length - 1;
  while (last >= 0 && points[last].time > through) last--;
  const end = points[last];
  if (!end || end.change_ratio == null || !Number.isFinite(end.change_ratio) || through - end.time > MAX_SAMPLE_GAP) return null;
  const target = end.time - window;
  for (let i = last - 1; i >= 0; i--) {
    const point = points[i];
    if (point.change_ratio == null || !Number.isFinite(point.change_ratio) || points[i + 1].time - point.time > MAX_SAMPLE_GAP) return null;
    if (point.time <= target) {
      if (target - point.time > MAX_SAMPLE_GAP) return null;
      return (end.change_ratio - point.change_ratio) * 100;
    }
  }
  return null;
}

/** Pixel buckets preserve extrema and explicit gaps; no invented or smoothed prices. */
export function sparklinePath(points: SentimentSecondPoint[], x: (time: number) => number, domain: [number, number], width = 112, height = 32) {
  const paths: string[] = [];
  let bucket: { time: number; change_ratio: number }[] = [], column = -1, drawing = false;
  const flush = () => {
    if (!bucket.length) return;
    const low = bucket.reduce((a, b) => a.change_ratio < b.change_ratio ? a : b);
    const high = bucket.reduce((a, b) => a.change_ratio > b.change_ratio ? a : b);
    const samples = [...new Set([bucket[0], low, high, bucket[bucket.length - 1]])].sort((a, b) => a.time - b.time);
    for (const point of samples) {
      const px = 2 + x(point.time) * (width - 4);
      const py = height - 3 - (point.change_ratio * 100 - domain[0]) / Math.max(.01, domain[1] - domain[0]) * (height - 6);
      paths.push(`${drawing ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`); drawing = true;
    }
    bucket = [];
  };
  for (const point of points) {
    if (point.change_ratio == null || !Number.isFinite(point.change_ratio)) { flush(); drawing = false; continue; }
    const next = Math.floor(x(point.time) * width);
    if (column !== next) { flush(); column = next; }
    bucket.push({ time: point.time, change_ratio: point.change_ratio });
  }
  flush();
  return paths.join(' ');
}

export const movementText = (value: number | null) => value === null ? '—' : `${value > 0 && value.toFixed(2) !== '0.00' ? '+' : ''}${Math.abs(value) < .005 ? '0.00' : value.toFixed(2)} 点`;

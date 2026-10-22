import type { SentimentStock } from './sentiment-model';
import type { SentimentSecondSeries } from './sentiment-seconds';

export const DEMO_REPLAY_DURATION = 30;
export const DEMO_SECONDS_START = Date.parse('2026-10-14T14:32:05+08:00');
type OpenEpisode = { opened: number; resealed: number | null; depth: number };

// Different paths for quick shake-outs, failed rebounds and gradual absorption.
// These are fictional tick sequences, not smoothed curves or historical market data.
const pullbacks = [
  [0, .45, .32, .67, .84, .58, .65, .3, .42, .14, .19, 0],
  [0, .7, .91, .67, .72, .41, .58, .62, .33, .38, .12, 0],
  [0, .19, .28, .22, .56, .92, .71, .79, .38, .44, .17, 0],
  [0, .58, .39, .47, .26, .54, .77, .62, .41, .16, .24, 0],
];
const rise = [.04, .12, .1, .24, .2, .39, .36, .41, .67, .62, .8, 1];
const interpolate = (anchors: number[], progress: number) => {
  const position = Math.max(0, Math.min(1, progress)) * (anchors.length - 1);
  const left = Math.floor(position);
  return anchors[left] + ((anchors[left + 1] ?? anchors[left]) - anchors[left]) * (position - left);
};
const jitter = (seed: number, tick: number) => {
  let value = Math.imul(seed + 17, 374761393) + Math.imul(tick + 13, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295 - .5;
};

/** Deterministic one-second samples, entirely fictional. Existing points never change during playback. */
export function createDemoSecondSeries(stocks: SentimentStock[], asOf: number): SentimentSecondSeries[] {
  return stocks.map((stock, index) => {
    const rank = index % 9;
    const group = Math.floor(index / 9);
    const firstSeal = Date.parse(stock.first_seal_at!);
    const limit = stock.limit_status === 'sealed' ? stock.change_ratio : .1;
    const shift = Math.round(jitter(index, 0) * 30);
    const opened = Math.max(firstSeal + 16000, DEMO_SECONDS_START - ([282, 206, 159, 274, 142, 234, 103, 170, 182][rank] + shift) * 1000);
    const resealed = stock.limit_status === 'opened' ? null : DEMO_SECONDS_START - Math.max(4, [112, 24, 83, 9, 25, 62, 34, 13, 42][rank] + shift) * 1000;
    const episodes: OpenEpisode[] = resealed === null || resealed > opened ? [{ opened, resealed, depth: [.009, .022, .013, .028, .007, .019, .015, .024, .017][rank] }] : [];
    if (stock.code === '002031') episodes.push({ opened: DEMO_SECONDS_START + 5000, resealed: DEMO_SECONDS_START + 15000, depth: .0174 });
    if (stock.code === '002050' && episodes.length) episodes[0].resealed = DEMO_SECONDS_START + 10000;

    const valueAt = (time: number) => {
      if (time < firstSeal) {
        const progress = 1 - Math.min(1, (firstSeal - time) / (210000 + group * 7000));
        const noise = jitter(index, Math.floor(time / 2000)) * .0013;
        return Math.min(limit - .0002, limit - (.029 + group * .001) * (1 - interpolate(rise, progress)) + noise);
      }
      const episode = episodes.find(item => time >= item.opened && (item.resealed === null || time < item.resealed));
      if (!episode) return limit;
      const elapsed = (time - episode.opened) / 1000;
      const progress = episode.resealed === null ? Math.min(.76, elapsed / 240) : elapsed / ((episode.resealed - episode.opened) / 1000);
      const depth = interpolate(pullbacks[(rank + group) % pullbacks.length], progress) * episode.depth;
      const noise = jitter(index, Math.floor(time / (rank % 2 ? 2000 : 3000))) * .0014;
      return Math.min(limit - .0002, limit - .0005 - depth + noise);
    };
    const points = Array.from({ length: Math.floor((asOf - (DEMO_SECONDS_START - 300000)) / 1000) + 1 }, (_, i) => {
      const time = DEMO_SECONDS_START - 300000 + i * 1000;
      return { time, change_ratio: +valueAt(time).toFixed(5) };
    });
    const events: SentimentSecondSeries['events'] = [
      { id: `${stock.code}-seal`, code: stock.code, time: firstSeal, kind: '封板' as const, change_ratio: limit },
      ...episodes.flatMap((episode, i): SentimentSecondSeries['events'] => [
        { id: `${stock.code}-open-${i}`, code: stock.code, time: episode.opened, kind: '开板', change_ratio: valueAt(episode.opened) },
        ...(episode.resealed === null ? [] : [{ id: `${stock.code}-reseal-${i}`, code: stock.code, time: episode.resealed, kind: '回封' as const, change_ratio: limit }]),
      ]),
    ].filter(event => event.time <= asOf).sort((a, b) => a.time - b.time);
    return { code: stock.code, limit_ratio: limit, points, events };
  });
}

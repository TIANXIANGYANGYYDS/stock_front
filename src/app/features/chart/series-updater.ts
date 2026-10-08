/** Update the live tail; reset only when historical points change or disappear. */
export function createSeriesUpdater<T extends { time: unknown }>(series: {
  setData: (data: T[]) => void;
  update: (point: T) => void;
}) {
  let previous: T[] | null = null;
  const equal = (left: T, right: T) => {
    const keys = Object.keys(left) as Array<keyof T>;
    return keys.length === Object.keys(right).length && keys.every(key => Object.is(left[key], right[key]));
  };
  return (next: T[]) => {
    if (!previous) { series.setData(next); previous = next; return; }
    let changed = 0;
    while (changed < previous.length && changed < next.length && equal(previous[changed], next[changed])) changed++;
    if (changed === previous.length && changed === next.length) return;
    const canUpdate = previous.length > 0 && next.length >= previous.length
      && changed >= previous.length - 1
      && next[previous.length - 1].time === previous[previous.length - 1].time;
    if (canUpdate) next.slice(changed).forEach(point => series.update(point));
    else series.setData(next);
    previous = next;
  };
}

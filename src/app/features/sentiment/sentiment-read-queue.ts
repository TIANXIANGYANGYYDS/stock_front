/** FIFO admission per HTTP time slice, so one stock cannot occupy a slot for its entire day. */
export function createSentimentReadQueue(concurrency: number) {
  const pending: (() => void)[] = [];
  let active = 0;
  const drain = () => { while (active < concurrency && pending.length) pending.shift()!(); };
  return <T>(signal: AbortSignal, task: () => Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const abort = () => {
      const index = pending.indexOf(start);
      if (index >= 0) pending.splice(index, 1);
      reject(signal.reason);
    };
    const start = () => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) { reject(signal.reason); return; }
      active++;
      void Promise.resolve().then(() => { signal.throwIfAborted(); return task(); }).then(resolve, reject)
        .finally(() => { active--; drain(); });
    };
    if (signal.aborted) { reject(signal.reason); return; }
    signal.addEventListener('abort', abort, { once: true });
    pending.push(start); drain();
  });
}

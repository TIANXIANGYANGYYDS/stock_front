import { throwIfRequestAborted } from './abort-signal';

/** Bounded, in-memory cache. Cancelling one reader must not cancel other readers. */
export function createRequestCache<T>(ttlMs: number, maxEntries: number) {
  const values = new Map<string, { data: T; expiresAt: number }>();
  const pending = new Map<string, { controller: AbortController; promise: Promise<T>; readers: number }>();

  function peek(key: string): T | undefined {
    const entry = values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) { values.delete(key); return undefined; }
    values.delete(key);
    values.set(key, entry);
    return entry.data;
  }

  async function get(key: string, loader: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    throwIfRequestAborted(signal);
    const cached = peek(key);
    if (cached !== undefined) return cached;
    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      const promise = Promise.resolve().then(() => {
        throwIfRequestAborted(controller.signal);
        return loader(controller.signal);
      }).then(data => {
        throwIfRequestAborted(controller.signal);
        values.delete(key);
        values.set(key, { data, expiresAt: Date.now() + ttlMs });
        while (values.size > maxEntries) values.delete(values.keys().next().value!);
        return data;
      }).finally(() => {
        if (pending.get(key)?.controller === controller) pending.delete(key);
      });
      entry = { controller, promise, readers: 0 };
      pending.set(key, entry);
    }
    const current = entry;
    current.readers++;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return false;
        settled = true;
        signal?.removeEventListener('abort', abort);
        current.readers--;
        if (current.readers === 0 && pending.get(key) === current) {
          pending.delete(key);
          current.controller.abort();
        }
        return true;
      };
      const abort = () => {
        if (finish()) reject(signal?.reason ?? new DOMException('请求已取消', 'AbortError'));
      };
      signal?.addEventListener('abort', abort, { once: true });
      current.promise.then(data => { if (finish()) resolve(data); }, error => { if (finish()) reject(error); });
    });
  }

  return { get, peek };
}

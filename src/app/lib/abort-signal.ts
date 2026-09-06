/** Check cancellation without requiring newer AbortSignal methods on mobile browsers. */
export function throwIfRequestAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason === undefined ? new DOMException('请求已取消', 'AbortError') : signal.reason;
  }
}

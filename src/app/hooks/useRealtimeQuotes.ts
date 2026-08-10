import { useCallback, useMemo } from 'react';
import {
  getRealtimeMarketIndices,
  getRealtimeStock,
  getRealtimeStocks,
  type RealtimeMarketIndicesResponse,
  type RealtimeStocksResponse,
} from '../lib/api';
import { useRealtimePolling } from './useRealtimePolling';

const REALTIME_INTERVAL_MS = 5000;

export function useRealtimeMarketIndices() {
  const request = useCallback(
    (signal: AbortSignal) => getRealtimeMarketIndices(signal),
    [],
  );
  return useRealtimePolling<RealtimeMarketIndicesResponse>({
    queryKey: 'market-indices',
    request,
    getMarketStatus: (response) => response.marketStatus,
    intervalMs: REALTIME_INTERVAL_MS,
  });
}

export function useRealtimeStocks(codes: string[], interval = '1m') {
  const codeKey = codes.join('\u0000');
  const normalizedCodes = useMemo(
    () => [...new Set(codes.map((code) => code.trim()).filter(Boolean))].sort(),
    [codeKey],
  );
  const normalizedKey = normalizedCodes.join(',');
  const request = useCallback(
    (signal: AbortSignal) => getRealtimeStocks(normalizedCodes, interval, signal),
    [interval, normalizedKey],
  );
  return useRealtimePolling<RealtimeStocksResponse>({
    enabled: normalizedCodes.length > 0,
    queryKey: `stocks:${interval}:${normalizedKey}`,
    request,
    getMarketStatus: (response) => response.marketStatus,
    intervalMs: REALTIME_INTERVAL_MS,
  });
}

export function useRealtimeStock(code: string, interval = '1m') {
  const normalizedCode = code.trim();
  const request = useCallback(
    (signal: AbortSignal) => getRealtimeStock(normalizedCode, interval, signal),
    [interval, normalizedCode],
  );
  return useRealtimePolling<RealtimeStocksResponse>({
    enabled: Boolean(normalizedCode),
    queryKey: `stock:${interval}:${normalizedCode}`,
    request,
    getMarketStatus: (response) => response.marketStatus,
    intervalMs: REALTIME_INTERVAL_MS,
  });
}

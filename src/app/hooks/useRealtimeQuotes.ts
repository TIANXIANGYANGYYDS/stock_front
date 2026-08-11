import { useCallback, useMemo } from 'react';
import {
  getRealtimeMarketIndices,
  getRealtimeStock,
  getRealtimeStocks,
  getStockIntraday,
  type IntradayInterval,
  type RealtimeMarketIndicesResponse,
  type StockIntradayResponse,
  type StockRealtimeResponse,
} from '../lib/api';
import { useRealtimePolling } from './useRealtimePolling';

const REALTIME_INTERVAL_MS = 5000;
const INTRADAY_INTERVAL_MS = 30000;

export interface UseStockIntradayOptions {
  code: string;
  tradeDate: string;
  interval: IntradayInterval;
  enabled: boolean;
  marketStatus: string;
}

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

export function useRealtimeStocks(codes: string[]) {
  const codeKey = codes.join('\u0000');
  const normalizedCodes = useMemo(
    () => [...new Set(codes.map((code) => code.trim()).filter(Boolean))].sort(),
    [codeKey],
  );
  const normalizedKey = normalizedCodes.join(',');
  const request = useCallback(
    (signal: AbortSignal) => getRealtimeStocks(normalizedCodes, signal),
    [normalizedKey],
  );
  return useRealtimePolling<StockRealtimeResponse>({
    enabled: normalizedCodes.length > 0,
    queryKey: `stocks:${normalizedKey}`,
    request,
    getMarketStatus: (response) => response.marketStatus,
    intervalMs: REALTIME_INTERVAL_MS,
  });
}

export function useRealtimeStock(code: string) {
  const normalizedCode = code.trim();
  const request = useCallback(
    (signal: AbortSignal) => getRealtimeStock(normalizedCode, signal),
    [normalizedCode],
  );
  return useRealtimePolling<StockRealtimeResponse>({
    enabled: Boolean(normalizedCode),
    queryKey: `stock:${normalizedCode}`,
    request,
    getMarketStatus: (response) => response.marketStatus,
    intervalMs: REALTIME_INTERVAL_MS,
  });
}

export function useStockIntraday({
  code,
  tradeDate,
  interval,
  enabled,
  marketStatus,
}: UseStockIntradayOptions) {
  const normalizedCode = code.trim();
  const normalizedTradeDate = tradeDate.trim();
  const request = useCallback(
    (signal: AbortSignal) => getStockIntraday(
      normalizedCode,
      normalizedTradeDate,
      interval,
      signal,
    ),
    [interval, normalizedCode, normalizedTradeDate],
  );
  return useRealtimePolling<StockIntradayResponse>({
    enabled: enabled && Boolean(normalizedCode) && Boolean(normalizedTradeDate),
    queryKey: `stock-intraday:${normalizedCode}:${normalizedTradeDate}:${interval}`,
    request,
    getMarketStatus: () => marketStatus || 'open',
    intervalMs: INTRADAY_INTERVAL_MS,
  });
}

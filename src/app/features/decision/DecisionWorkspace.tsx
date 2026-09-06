import { useEffect, useMemo, useState } from 'react';
import {
  getStockDetail,
  getStockList,
  type IntradayInterval,
  type SectorStock,
  type StockListItem,
} from '../../lib/api';
import {
  mergeRealtimeStockItems,
  selectRealtimeStockQuote,
} from '../../lib/realtime-format';
import {
  useRealtimeStock,
  useRealtimeStocks,
  useStockIntraday,
} from '../../hooks/useRealtimeQuotes';
import { ProfessionalCandlestickChart } from '../chart/ProfessionalCandlestickChart';
import { DecisionPanel } from './DecisionPanel';
import { StockNavigator } from './StockNavigator';
import { selectSnapshotBar } from './snapshot-state';
import { useWorkspaceState } from '../../hooks/useWorkspaceState';

interface DecisionWorkspaceProps {
  preferredTradeDate: string;
  requestedStockCode?: string;
  stockRequestKey?: string;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

export function DecisionWorkspace({
  preferredTradeDate,
  requestedStockCode,
  stockRequestKey,
}: DecisionWorkspaceProps) {
  const [stockItems, setStockItems] = useState<StockListItem[]>([]);
  const [query, setQuery] = useWorkspaceState('decision.query', '');
  const [selectedStockCode, setSelectedStockCode] = useWorkspaceState('decision.stock', '');
  const [selectedStock, setSelectedStock] = useState<SectorStock | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useWorkspaceState<'daily' | 'intraday'>('decision.mode', 'daily');
  const [intradayInterval, setIntradayInterval] = useWorkspaceState<IntradayInterval>('decision.interval', '1m');
  const [listReload, setListReload] = useState(0);
  const [detailReload, setDetailReload] = useState(0);
  useEffect(() => {
    if (!requestedStockCode) return;
    setQuery(requestedStockCode);
    setSelectedStockCode(requestedStockCode);
  }, [requestedStockCode, stockRequestKey]);
  const normalizedQuery = query.trim();
  const batchRealtime = useRealtimeStocks(stockItems.map((item) => item.code));
  const selectedRealtime = useRealtimeStock(selectedStockCode);
  const selectedQuote = useMemo(
    () => selectRealtimeStockQuote(
      selectedRealtime.data?.items ?? [],
      selectedStockCode,
    ),
    [selectedRealtime.data?.items, selectedStockCode],
  );
  const selectedListItem = stockItems.find((item) => item.code === selectedStockCode) ?? null;
  const currentSelectedStock = selectedStock?.code === selectedStockCode
    ? selectedStock
    : null;
  const realtimeTradingDate = selectedRealtime.data?.tradingDate ?? '';
  const officialTradeDate = currentSelectedStock?.tradeDate
    || selectedListItem?.tradeDate
    || preferredTradeDate;
  const intradayTradeDate = realtimeTradingDate > officialTradeDate
    ? realtimeTradingDate
    : preferredTradeDate;
  const needsTemporaryDailyBar = Boolean(
    selectedQuote
    && realtimeTradingDate > officialTradeDate,
  );
  const requestedIntradayInterval = chartMode === 'daily' && needsTemporaryDailyBar
    ? '1m'
    : intradayInterval;
  const intraday = useStockIntraday({
    code: selectedStockCode,
    tradeDate: intradayTradeDate,
    interval: requestedIntradayInterval,
    enabled: chartMode === 'intraday' || needsTemporaryDailyBar,
    marketStatus: selectedRealtime.data?.marketStatus ?? 'open',
  });
  const displayedStockItems = useMemo(
    () => mergeRealtimeStockItems(
      stockItems,
      batchRealtime.data?.items ?? [],
      batchRealtime.data?.tradingDate ?? '',
      selectedQuote
        ? { quote: selectedQuote, tradingDate: realtimeTradingDate }
        : undefined,
    ),
    [
      batchRealtime.data?.items,
      batchRealtime.data?.tradingDate,
      realtimeTradingDate,
      selectedQuote,
      stockItems,
    ],
  );
  const effectiveMissingCodes = useMemo(
    () => (selectedQuote
      ? (batchRealtime.data?.missingCodes ?? []).filter((code) => code !== selectedStockCode)
      : batchRealtime.data?.missingCodes ?? []),
    [batchRealtime.data?.missingCodes, selectedQuote, selectedStockCode],
  );

  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true);
    setListError(null);
    const timer = window.setTimeout(() => {
      void getStockList(preferredTradeDate, normalizedQuery, controller.signal)
        .then((items) => {
          if (controller.signal.aborted) return;
          setStockItems(items);
          setSelectedStockCode((current) => (
            current || items[0]?.code || ''
          ));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return;
          setListError(errorText(error, '股票列表加载失败'));
        })
        .finally(() => {
          if (!controller.signal.aborted) setListLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [preferredTradeDate, normalizedQuery, listReload]);

  useEffect(() => {
    setActiveDate(null);
    if (!selectedStockCode) {
      setSelectedStock(null);
      return;
    }

    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);

    void (async () => {
      try {
        const response = await getStockDetail(selectedStockCode, preferredTradeDate, controller.signal);
        if (controller.signal.aborted) return;
        setSelectedStock(response);
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        setSelectedStock(null);
        setDetailError(errorText(error, '个股 K 线加载失败'));
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [preferredTradeDate, selectedStockCode, detailReload]);

  return (
    <main className="decision-grid">
      <StockNavigator
        items={displayedStockItems}
        query={query}
        selectedCode={selectedStockCode}
        loading={listLoading}
        error={listError}
        missingCodes={effectiveMissingCodes}
        realtimeDelayed={batchRealtime.delayed}
        realtimeError={batchRealtime.error}
        onQueryChange={setQuery}
        onSelect={setSelectedStockCode}
        onRetry={() => setListReload((value) => value + 1)}
      />
      <ProfessionalCandlestickChart
        stock={currentSelectedStock}
        stockCode={selectedStockCode}
        stockName={selectedListItem?.name ?? currentSelectedStock?.name ?? ''}
        loading={detailLoading}
        realtimeData={selectedRealtime.data}
        realtimeLoading={selectedRealtime.initialLoading}
        realtimeDelayed={selectedRealtime.delayed}
        realtimeError={selectedRealtime.error}
        intradayData={intraday.data}
        intradayLoading={intraday.initialLoading}
        intradayDelayed={intraday.delayed}
        intradayError={intraday.error}
        chartMode={chartMode}
        onChartModeChange={setChartMode}
        intradayInterval={intradayInterval}
        onIntradayIntervalChange={setIntradayInterval}
        onActiveDateChange={setActiveDate}
      />
      <DecisionPanel
        stock={currentSelectedStock}
        bar={selectSnapshotBar(currentSelectedStock, activeDate)}
        loading={detailLoading}
      />
      {detailError && (
        <div className="workspace-floating-error" role="alert">
          <span>{detailError}</span>
          <button type="button" className="terminal-button" onClick={() => setDetailReload((value) => value + 1)}>重试 K 线</button>
        </div>
      )}
    </main>
  );
}

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

interface DecisionWorkspaceProps {
  preferredTradeDate: string;
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
}: DecisionWorkspaceProps) {
  const [stockItems, setStockItems] = useState<StockListItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedStockCode, setSelectedStockCode] = useState('');
  const [selectedStock, setSelectedStock] = useState<SectorStock | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'daily' | 'intraday'>('daily');
  const [intradayInterval, setIntradayInterval] = useState<IntradayInterval>('1m');
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
            items.some((item) => item.code === current) ? current : items[0]?.code || ''
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
  }, [preferredTradeDate, normalizedQuery]);

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
  }, [preferredTradeDate, selectedStockCode]);

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
      />
      <ProfessionalCandlestickChart
        stock={currentSelectedStock}
        stockCode={selectedStockCode}
        stockName={selectedListItem?.name ?? ''}
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
      {detailError && <div className="workspace-floating-error">{detailError}</div>}
    </main>
  );
}

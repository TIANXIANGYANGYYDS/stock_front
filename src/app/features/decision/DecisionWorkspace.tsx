import { useEffect, useMemo, useState } from 'react';
import {
  getStockDetail,
  getStockList,
  type SectorStock,
  type StockListItem,
} from '../../lib/api';
import { mergeRealtimeStockItems } from '../../lib/realtime-format';
import { useRealtimeStock, useRealtimeStocks } from '../../hooks/useRealtimeQuotes';
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
  const normalizedQuery = query.trim();
  const batchRealtime = useRealtimeStocks(stockItems.map((item) => item.code));
  const selectedRealtime = useRealtimeStock(selectedStockCode);
  const displayedStockItems = useMemo(
    () => mergeRealtimeStockItems(stockItems, batchRealtime.data?.items ?? []),
    [batchRealtime.data?.items, stockItems],
  );
  const selectedListItem = stockItems.find((item) => item.code === selectedStockCode) ?? null;

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
        onQueryChange={setQuery}
        onSelect={setSelectedStockCode}
      />
      <ProfessionalCandlestickChart
        stock={selectedStock}
        stockCode={selectedStockCode}
        stockName={selectedListItem?.name ?? ''}
        loading={detailLoading}
        intradayData={selectedRealtime.data}
        intradayLoading={selectedRealtime.initialLoading}
        intradayDelayed={selectedRealtime.delayed}
        intradayError={selectedRealtime.error}
        onActiveDateChange={setActiveDate}
      />
      <DecisionPanel
        stock={selectedStock}
        bar={selectSnapshotBar(selectedStock, activeDate)}
        loading={detailLoading}
      />
      {detailError && <div className="workspace-floating-error">{detailError}</div>}
    </main>
  );
}

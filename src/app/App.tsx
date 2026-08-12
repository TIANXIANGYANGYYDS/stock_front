import { useEffect, useState } from 'react';
import { TerminalHeader, type WorkspaceView } from './components/TerminalHeader';
import { DecisionWorkspace } from './features/decision/DecisionWorkspace';
import { MarketInsightsView } from './features/market/MarketInsightsView';
import { NewsIntelligenceView } from './features/news/NewsIntelligenceView';
import { CreatorInsightsView } from './features/creators/CreatorInsightsView';
import {
  getLatestMarketDates,
} from './lib/api';
import { useRealtimeMarketIndices } from './hooks/useRealtimeQuotes';

const LATEST_DATES_REFRESH_MS = 60_000;

export default function App() {
  const realtimeIndices = useRealtimeMarketIndices();
  const [activeView, setActiveView] = useState<WorkspaceView>('decision');
  const [marketTradeDate, setMarketTradeDate] = useState<string>();
  const [analysisDate, setAnalysisDate] = useState<string | null>(null);
  const [tradeDateLoading, setTradeDateLoading] = useState(true);
  const [tradeDateError, setTradeDateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let hasResolved = false;
    setTradeDateLoading(true);
    setTradeDateError(null);

    const loadLatestDates = async () => {
      try {
        const latestDates = await getLatestMarketDates();
        if (cancelled) return;

        setMarketTradeDate(latestDates.marketTradeDate || undefined);
        setAnalysisDate(latestDates.analysisDate);
        setTradeDateError(null);
        setTradeDateLoading(false);
        hasResolved = true;
      } catch (error: unknown) {
        if (cancelled) return;
        if (!hasResolved) {
          setMarketTradeDate(undefined);
          setAnalysisDate(null);
          setTradeDateError(
            `最新交易日加载失败：${error instanceof Error ? error.message : '接口请求失败'}`,
          );
          setTradeDateLoading(false);
        }
      } finally {
        if (!cancelled) timer = window.setTimeout(loadLatestDates, LATEST_DATES_REFRESH_MS);
      }
    };

    void loadLatestDates();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="stock-terminal">
      <TerminalHeader
        activeView={activeView}
        tradeDate={marketTradeDate}
        realtimeIndices={realtimeIndices.data}
        indicesLoading={realtimeIndices.initialLoading}
        indicesDelayed={realtimeIndices.delayed}
        indicesError={realtimeIndices.error}
        onViewChange={setActiveView}
      />

      <div className="terminal-main">
        {activeView === 'creators' && <CreatorInsightsView />}
        {activeView !== 'creators' && tradeDateLoading && (
          <main className="workspace-date-gate terminal-panel">
            <div className="terminal-empty"><span className="loading-pulse" />正在解析 Stock_Project 最新交易日...</div>
          </main>
        )}
        {activeView !== 'creators' && !tradeDateLoading && !marketTradeDate && (
          <main className="workspace-date-gate terminal-panel">
            <div className={`terminal-empty${tradeDateError ? ' is-error' : ''}`}>
              {tradeDateError || 'Stock_Project 未返回最新交易日'}
            </div>
          </main>
        )}
        {activeView !== 'creators' && !tradeDateLoading && marketTradeDate && activeView === 'decision' && (
          <DecisionWorkspace
            preferredTradeDate={marketTradeDate}
          />
        )}
        {activeView !== 'creators' && !tradeDateLoading && marketTradeDate && activeView === 'market' && (
          <MarketInsightsView
            marketTradeDate={marketTradeDate}
            analysisDate={analysisDate}
          />
        )}
        {activeView !== 'creators' && !tradeDateLoading && marketTradeDate && activeView === 'news' && (
          <NewsIntelligenceView tradeDate={marketTradeDate} />
        )}
      </div>
    </div>
  );
}

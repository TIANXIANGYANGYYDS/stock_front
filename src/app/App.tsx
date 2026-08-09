import { useEffect, useState } from 'react';
import { TerminalHeader, type WorkspaceView } from './components/TerminalHeader';
import { DecisionWorkspace } from './features/decision/DecisionWorkspace';
import { MarketInsightsView } from './features/market/MarketInsightsView';
import { NewsIntelligenceView } from './features/news/NewsIntelligenceView';
import {
  getLatestTradeDate,
} from './lib/api';

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('decision');
  const [tradeDate, setTradeDate] = useState<string>();
  const [tradeDateLoading, setTradeDateLoading] = useState(true);
  const [tradeDateError, setTradeDateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTradeDateLoading(true);
    setTradeDateError(null);

    void (async () => {
      try {
        const latestTradeDate = await getLatestTradeDate();
        if (cancelled) return;

        setTradeDate(latestTradeDate || undefined);
        setTradeDateLoading(false);
      } catch (error: unknown) {
        if (cancelled) return;
        setTradeDate(undefined);
        setTradeDateError(
          `最新交易日加载失败：${error instanceof Error ? error.message : '接口请求失败'}`,
        );
        setTradeDateLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="stock-terminal">
      <TerminalHeader
        activeView={activeView}
        tradeDate={tradeDate}
        marketLoading={tradeDateLoading}
        marketError={tradeDateError}
        onViewChange={setActiveView}
      />

      <div className="terminal-main">
        {tradeDateLoading && (
          <main className="workspace-date-gate terminal-panel">
            <div className="terminal-empty"><span className="loading-pulse" />正在解析 Stock_Project 最新交易日...</div>
          </main>
        )}
        {!tradeDateLoading && !tradeDate && (
          <main className="workspace-date-gate terminal-panel">
            <div className={`terminal-empty${tradeDateError ? ' is-error' : ''}`}>
              {tradeDateError || 'Stock_Project 未返回最新交易日'}
            </div>
          </main>
        )}
        {!tradeDateLoading && tradeDate && activeView === 'decision' && (
          <DecisionWorkspace
            preferredTradeDate={tradeDate}
          />
        )}
        {!tradeDateLoading && tradeDate && activeView === 'market' && (
          <MarketInsightsView preferredTradeDate={tradeDate} />
        )}
        {!tradeDateLoading && tradeDate && activeView === 'news' && (
          <NewsIntelligenceView tradeDate={tradeDate} />
        )}
      </div>
    </div>
  );
}

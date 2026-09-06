import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router';
import { TerminalHeader, type WorkspaceView } from './components/TerminalHeader';
import { DecisionWorkspace } from './features/decision/DecisionWorkspace';
import { MarketInsightsView } from './features/market/MarketInsightsView';
import { NewsIntelligenceView } from './features/news/NewsIntelligenceView';
import { CreatorInsightsView } from './features/creators/CreatorInsightsView';
import { QuantWorkspace } from './features/quant/QuantWorkspace';
import {
  getLatestMarketDates,
} from './lib/api';
import { useRealtimeMarketIndices } from './hooks/useRealtimeQuotes';
import { WorkspaceStateProvider } from './hooks/useWorkspaceState';
import { AppearanceProvider, useAppearance } from './hooks/useAppearance';
import * as m from 'motion/react-m';
import { StudioMotionProvider, useEntranceMotion } from './components/StudioMotion';
import CommandCenter from './components/CommandCenter';
import MarketPanorama from './features/panorama/MarketPanorama';

const LATEST_DATES_REFRESH_MS = 60_000;

function AppContent() {
  const entrance = useEntranceMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleAppearance } = useAppearance();
  const [utility, setUtility] = useState<'commands' | 'panorama' | null>(null);
  const utilityRef = useRef(utility);
  const utilityTrigger = useRef<HTMLElement | null>(null);
  const openUtility = (kind: 'commands' | 'panorama') => {
    if (!utilityRef.current) utilityTrigger.current = document.activeElement as HTMLElement;
    utilityRef.current = kind; setUtility(kind);
  };
  const closeUtility = () => { utilityRef.current = null; setUtility(null); };
  const restoreUtilityFocus = () => {
    queueMicrotask(() => {
      if (utilityRef.current) return;
      const target = utilityTrigger.current?.isConnected ? utilityTrigger.current : document.querySelector<HTMLElement>('.studio-command-trigger');
      target?.focus();
    });
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      if (!utilityRef.current && document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      if (utilityRef.current === 'commands') closeUtility(); else openUtility('commands');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const realtimeIndices = useRealtimeMarketIndices();
  const storedView = location.state?.workspaceView;
  const activeView: WorkspaceView = /^\/quant(?:\/|$)/.test(location.pathname)
    ? 'quant'
    : ['market', 'news', 'creators'].includes(storedView) ? storedView : 'decision';
  const [marketTradeDate, setMarketTradeDate] = useState<string>();
  const [analysisDate, setAnalysisDate] = useState<string | null>(null);
  const [tradeDateLoading, setTradeDateLoading] = useState(true);
  const [tradeDateError, setTradeDateError] = useState<string | null>(null);
  const [dateReload, setDateReload] = useState(0);

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
  }, [dateReload]);

  const handleViewChange = (view: WorkspaceView) => {
    if (view === activeView) return;
    navigate(view === 'quant' ? '/quant' : '/', { state: { workspaceView: view } });
  };
  const openStock = (code: string) => {
    closeUtility();
    navigate('/', { state: { workspaceView: 'decision', stockCode: code } });
  };

  const requiresMarketDate = activeView !== 'creators' && activeView !== 'quant';

  return (
    <div className="stock-terminal studio-shell" data-workspace={activeView}>
      <TerminalHeader
        activeView={activeView}
        tradeDate={marketTradeDate}
        realtimeIndices={realtimeIndices.data}
        indicesLoading={realtimeIndices.initialLoading}
        indicesDelayed={realtimeIndices.delayed}
        indicesError={realtimeIndices.error}
        onViewChange={handleViewChange}
        onOpenCommands={() => openUtility('commands')}
        onOpenPanorama={() => openUtility('panorama')}
      />

      <m.div key={activeView} className="terminal-main" {...entrance}>
        {activeView === 'creators' && <CreatorInsightsView />}
        {activeView === 'quant' && <QuantWorkspace />}
        {requiresMarketDate && tradeDateLoading && (
          <main className="workspace-date-gate terminal-panel">
            <div className="terminal-empty"><span className="loading-pulse" />正在解析 Stock_Project 最新交易日...</div>
          </main>
        )}
        {requiresMarketDate && !tradeDateLoading && !marketTradeDate && (
          <main className="workspace-date-gate terminal-panel">
            <div className={`terminal-empty workspace-recovery${tradeDateError ? ' is-error' : ''}`} role="status">
              <span>{tradeDateError || 'Stock_Project 未返回最新交易日'}</span>
              <button type="button" className="terminal-button" onClick={() => setDateReload((value) => value + 1)}>重新加载</button>
            </div>
          </main>
        )}
        {requiresMarketDate && !tradeDateLoading && marketTradeDate && activeView === 'decision' && (
          <DecisionWorkspace
            preferredTradeDate={marketTradeDate}
            requestedStockCode={location.state?.stockCode}
            stockRequestKey={location.key}
          />
        )}
        {requiresMarketDate && !tradeDateLoading && marketTradeDate && activeView === 'market' && (
          <MarketInsightsView
            marketTradeDate={marketTradeDate}
            analysisDate={analysisDate}
          />
        )}
        {requiresMarketDate && !tradeDateLoading && marketTradeDate && activeView === 'news' && (
          <NewsIntelligenceView tradeDate={marketTradeDate} />
        )}
      </m.div>
      {utility === 'commands' && <CommandCenter tradeDate={marketTradeDate} onClose={closeUtility} onRestoreFocus={restoreUtilityFocus}
        onView={(view) => { closeUtility(); handleViewChange(view); }} onStock={openStock}
        onPanorama={() => openUtility('panorama')} onTheme={() => { closeUtility(); requestAnimationFrame(() => toggleAppearance()); }} />}
      {utility === 'panorama' && <MarketPanorama tradeDate={marketTradeDate} onClose={closeUtility} onStock={openStock} onRestoreFocus={restoreUtilityFocus} />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppearanceProvider><WorkspaceStateProvider><StudioMotionProvider><AppContent /></StudioMotionProvider></WorkspaceStateProvider></AppearanceProvider>
    </BrowserRouter>
  );
}

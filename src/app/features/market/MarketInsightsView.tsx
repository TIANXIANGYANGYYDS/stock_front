import { useState } from 'react';
import { MarketAnalysis } from '../../components/MarketAnalysis';
import { NewsHeatmap } from '../../components/NewsHeatmap';
import { SectorTrend } from '../../components/SectorTrend';
import type { RankingWindow } from '../../lib/api';

interface MarketInsightsViewProps {
  marketTradeDate: string;
  analysisDate: string | null;
}

const RANKING_WINDOWS: Array<{ value: RankingWindow; label: string }> = [
  { value: 'hour', label: '1小时' },
  { value: 'day', label: '1天' },
  { value: '3day', label: '3天' },
  { value: '7day', label: '7天' },
];

export function MarketInsightsView({ marketTradeDate, analysisDate }: MarketInsightsViewProps) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [rankingWindow, setRankingWindow] = useState<RankingWindow>('day');

  const handleSectorClick = (sector: string | null) => {
    setSelectedSector(sector);
  };
  const rankingWindowLabel = RANKING_WINDOWS.find((item) => item.value === rankingWindow)?.label || '1天';

  return (
    <main className="market-insights-view terminal-scroll">
      <div className="market-analysis-lead legacy-panel-skin">
        <MarketAnalysis analysisDate={analysisDate} />
      </div>

      <div className="ranking-window-bar terminal-panel">
        <div><strong>板块排行周期</strong><span>排名窗口：{rankingWindowLabel}</span></div>
        <div className="ranking-window-buttons">
          {RANKING_WINDOWS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={rankingWindow === item.value ? 'is-active' : ''}
              onClick={() => setRankingWindow(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="market-insights-grid">
        <div className="legacy-panel-skin"><SectorTrend bizDate={marketTradeDate} window={rankingWindow} onSectorClick={handleSectorClick} selectedSector={selectedSector} /></div>
        <div className="legacy-panel-skin"><NewsHeatmap bizDate={marketTradeDate} window={rankingWindow} onSectorClick={handleSectorClick} selectedSector={selectedSector} /></div>
      </div>
    </main>
  );
}

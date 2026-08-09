import { Activity, Flame, Layers3, RadioTower } from 'lucide-react';
import { useState } from 'react';
import type { HeatmapItem, SectorStock, TrendItem } from '../../lib/api';

interface OpportunityRadarProps {
  preferenceItems: TrendItem[];
  heatItems: HeatmapItem[];
  stocks: SectorStock[];
  selectedSector: string;
  selectedStockCode: string;
  sectorLoading: boolean;
  stockLoading: boolean;
  sectorError: string | null;
  stockError: string | null;
  onSectorSelect: (sector: string) => void;
  onStockSelect: (code: string) => void;
}

type RadarMode = 'preference' | 'heat';

export function OpportunityRadar({
  preferenceItems,
  heatItems,
  stocks,
  selectedSector,
  selectedStockCode,
  sectorLoading,
  stockLoading,
  sectorError,
  stockError,
  onSectorSelect,
  onStockSelect,
}: OpportunityRadarProps) {
  const [mode, setMode] = useState<RadarMode>('preference');
  const sectors = mode === 'preference' ? preferenceItems : heatItems;

  return (
    <aside className="terminal-panel opportunity-radar">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow"><RadioTower size={12} /> OPPORTUNITY RADAR</span>
          <h2>机会雷达</h2>
        </div>
        <span className="data-live"><i />最新快照</span>
      </div>

      <div className="radar-tabs">
        <button className={mode === 'preference' ? 'is-active' : ''} onClick={() => setMode('preference')}>
          <Activity size={14} />投资倾向
        </button>
        <button className={mode === 'heat' ? 'is-active' : ''} onClick={() => setMode('heat')}>
          <Flame size={14} />市场热度
        </button>
      </div>

      <div className="radar-section-label">
        <span>板块排名</span>
        <small>{sectors.length ? `TOP ${sectors.length}` : '--'}</small>
      </div>

      <div className="sector-rank-list terminal-scroll">
        {sectorLoading && <div className="radar-placeholder"><span className="loading-pulse" />正在计算板块强度...</div>}
        {!sectorLoading && sectorError && <div className="radar-placeholder is-error">{sectorError}</div>}
        {!sectorLoading && !sectorError && sectors.length === 0 && (
          <div className="radar-placeholder">该交易日暂无排行榜数据</div>
        )}
        {sectors.map((item, index) => {
          const name = item.name;
          const active = selectedSector === name;
          const isTrend = 'trend' in item;
          return (
            <button
              key={`${mode}-${name}`}
              className={`sector-rank-item ${active ? 'is-active' : ''}`}
              onClick={() => onSectorSelect(name)}
            >
              <span className={`rank-number rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
              <span className="sector-rank-main">
                <strong>{name}</strong>
                <small>{isTrend ? `${item.newsCount ?? 0} 条资讯` : `${item.count} 条资讯`}</small>
              </span>
              <span className="sector-rank-value">
                <b>{item.score.toFixed(1)}</b>
                <small>当前快照</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="radar-section-label stock-list-label">
        <span><Layers3 size={12} />{selectedSector || '板块'}个股</span>
        <small>{stocks.length ? `${stocks.length} 只` : '--'}</small>
      </div>

      <div className="radar-stock-list terminal-scroll">
        {stockLoading && <div className="radar-placeholder"><span className="loading-pulse" />加载最新个股与 K 线...</div>}
        {!stockLoading && stockError && <div className="radar-placeholder is-error">{stockError}</div>}
        {!stockLoading && !stockError && stocks.length === 0 && (
          <div className="radar-placeholder">该板块暂无最新个股行情</div>
        )}
        {stocks.map((stock) => {
          const active = selectedStockCode === stock.code;
          const isUp = (stock.changePercent ?? 0) >= 0;
          return (
            <button
              key={stock.code}
              className={`radar-stock-item ${active ? 'is-active' : ''}`}
              onClick={() => onStockSelect(stock.code)}
            >
              <span className="stock-name-code">
                <strong>{stock.name}</strong>
                <small>{stock.code}</small>
              </span>
              <span className="stock-list-price">
                <b>{stock.close > 0 ? stock.close.toFixed(2) : '--'}</b>
                <small className={isUp ? 'market-rise' : 'market-fall'}>
                  {stock.changePercent === null
                    ? '--'
                    : `${stock.changePercent > 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`}
                </small>
              </span>
              <span className="stock-date-tag">{stock.tradeDate ? stock.tradeDate.slice(5) : '--'}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

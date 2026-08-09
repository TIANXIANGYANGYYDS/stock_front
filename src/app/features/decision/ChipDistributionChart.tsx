import type { ChipIndicators } from '../../lib/api';
import { normalizeChipDistribution } from './chip-distribution';

interface ChipDistributionChartProps {
  chip: ChipIndicators | null | undefined;
  currentPrice: number | null | undefined;
  tradeDate: string;
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

export function ChipDistributionChart({
  chip,
  currentPrice,
  tradeDate,
}: ChipDistributionChartProps) {
  const points = normalizeChipDistribution(chip);
  if (!points.length) {
    return <div className="chip-chart-empty">该交易日未返回筹码分布</div>;
  }

  const width = 286;
  const height = 212;
  const plotLeft = 58;
  const plotRight = 266;
  const plotTop = 12;
  const plotBottom = 194;
  const minPrice = points[0].price;
  const maxPrice = points.at(-1)?.price ?? minPrice;
  const priceSpan = Math.max(maxPrice - minPrice, 0.01);
  const yForPrice = (price: number) => (
    plotBottom - ((price - minPrice) / priceSpan) * (plotBottom - plotTop)
  );
  const current = typeof currentPrice === 'number' && Number.isFinite(currentPrice)
    ? currentPrice
    : null;
  const average = chip?.avgCost !== null && chip?.avgCost !== undefined && Number.isFinite(chip.avgCost)
    ? chip.avgCost
    : null;

  return (
    <figure className="chip-distribution" aria-label={`${tradeDate} 筹码分布图`}>
      <figcaption>
        <span>价格分布</span>
        <small>X 筹码密度 · Y 价格</small>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${tradeDate} 筹码分布图形`}>
        <defs>
          <linearGradient id="chip-profit-gradient" gradientUnits="userSpaceOnUse" x1={plotLeft} x2={plotRight}>
            <stop offset="0" stopColor="#f06461" stopOpacity="0.16" />
            <stop offset="1" stopColor="#f06461" stopOpacity="0.86" />
          </linearGradient>
          <linearGradient id="chip-loss-gradient" gradientUnits="userSpaceOnUse" x1={plotLeft} x2={plotRight}>
            <stop offset="0" stopColor="#20b98b" stopOpacity="0.14" />
            <stop offset="1" stopColor="#20b98b" stopOpacity="0.78" />
          </linearGradient>
        </defs>
        <line className="chip-axis" x1={plotLeft} x2={plotLeft} y1={plotTop} y2={plotBottom} />
        {points.map((point, index) => {
          const y = yForPrice(point.price);
          const profitable = current !== null && point.price <= current;
          return (
            <line
              key={`${point.price}-${index}`}
              className="chip-density-line"
              x1={plotLeft}
              x2={plotLeft + point.ratio * (plotRight - plotLeft)}
              y1={y}
              y2={y}
              stroke={profitable ? 'url(#chip-profit-gradient)' : 'url(#chip-loss-gradient)'}
            />
          );
        })}
        <text className="chip-price-label" x="4" y={plotTop + 4}>{formatPrice(maxPrice)}</text>
        <text className="chip-price-label" x="4" y={plotBottom}>{formatPrice(minPrice)}</text>
        {average !== null && average >= minPrice && average <= maxPrice && (
          <g className="chip-average-line">
            <line x1={plotLeft} x2={plotRight} y1={yForPrice(average)} y2={yForPrice(average)} />
            <text x={plotRight - 2} y={yForPrice(average) - 4}>均价 {formatPrice(average)}</text>
          </g>
        )}
        {current !== null && current >= minPrice && current <= maxPrice && (
          <g className="chip-current-line">
            <line x1={plotLeft} x2={plotRight} y1={yForPrice(current)} y2={yForPrice(current)} />
            <text x={plotRight - 2} y={yForPrice(current) + 12}>现价 {formatPrice(current)}</text>
          </g>
        )}
      </svg>
      <div className="chip-chart-legend">
        <span className="chip-profit-dot">获利筹码</span>
        <span className="chip-loss-dot">套牢筹码</span>
      </div>
    </figure>
  );
}

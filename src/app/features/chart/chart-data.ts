import type { StockKlineBar } from '../../lib/api';

export interface ChartBar extends Omit<StockKlineBar, 'amount' | 'volume'> {
  time: string;
  amount: number;
  volume: number;
}

function isValidPrice(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function normalizeChartBars(input: StockKlineBar[]): ChartBar[] {
  const byDate = new Map<string, ChartBar>();

  input.forEach((bar) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bar.date)) return;
    if (![bar.open, bar.high, bar.low, bar.close].every(isValidPrice)) return;
    if (bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close)) {
      return;
    }
    if (bar.high < bar.low) return;

    byDate.set(bar.date, {
      ...bar,
      time: bar.date,
      amount: bar.amount ?? 0,
      volume: bar.volume ?? 0,
    });
  });

  return [...byDate.values()].sort((left, right) => left.time.localeCompare(right.time));
}

export function buildMovingAverageData(
  bars: ChartBar[],
  key: keyof NonNullable<StockKlineBar['ma']>,
): Array<{ time: string; value: number }> {
  return bars.flatMap((bar) => {
    const value = bar.ma?.[key];
    return typeof value === 'number' && Number.isFinite(value)
      ? [{ time: bar.time, value }]
      : [];
  });
}

type IndicatorGroup = 'macd' | 'boll' | 'kdj' | 'rsi' | 'cci' | 'wr' | 'atr';
export type AuxiliaryChartIndicator = 'volume' | Exclude<IndicatorGroup, 'boll'>;

const MA_KEYS: Array<keyof NonNullable<StockKlineBar['ma']>> = [
  'ma5', 'ma10', 'ma20', 'ma30', 'ma60',
];

const AUXILIARY_GROUPS: Array<Exclude<AuxiliaryChartIndicator, 'volume'>> = [
  'macd', 'kdj', 'rsi', 'cci', 'wr', 'atr',
];

function hasFiniteGroupValue(value: object | null | undefined): boolean {
  return !!value && Object.values(value).some(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

export function getAvailableMaKeys(
  bars: ChartBar[],
): Array<keyof NonNullable<StockKlineBar['ma']>> {
  return MA_KEYS.filter((key) => bars.some((bar) => {
    const value = bar.ma?.[key];
    return typeof value === 'number' && Number.isFinite(value);
  }));
}

export function getAvailableChartIndicators(bars: ChartBar[]): AuxiliaryChartIndicator[] {
  const available: AuxiliaryChartIndicator[] = [];
  if (bars.some((bar) => bar.amount > 0 || bar.volume > 0)) available.push('volume');
  AUXILIARY_GROUPS.forEach((group) => {
    if (bars.some((bar) => hasFiniteGroupValue(bar[group]))) available.push(group);
  });
  return available;
}

export function buildIndicatorData(
  bars: ChartBar[],
  group: IndicatorGroup,
  key: string,
): Array<{ time: string; value: number }> {
  return bars.flatMap((bar) => {
    const values = bar[group] as Record<string, number | null> | null | undefined;
    const value = values?.[key];
    return typeof value === 'number' && Number.isFinite(value)
      ? [{ time: bar.time, value }]
      : [];
  });
}

export function buildVolumeData(bars: ChartBar[]): Array<{
  time: string;
  value: number;
  color: string;
}> {
  return bars.map((bar) => ({
    time: bar.time,
    value: bar.volume || bar.amount,
    color: bar.close >= bar.open ? 'rgba(239, 83, 80, 0.52)' : 'rgba(24, 185, 139, 0.52)',
  }));
}

export function buildVolumeMovingAverageData(
  bars: ChartBar[],
  key: keyof NonNullable<StockKlineBar['volumeMa']>,
): Array<{ time: string; value: number }> {
  return bars.flatMap((bar) => {
    const value = bar.volumeMa?.[key];
    return typeof value === 'number' && Number.isFinite(value)
      ? [{ time: bar.time, value }]
      : [];
  });
}

export function formatChartVolume(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
  if (absolute >= 10_000) {
    const digits = absolute >= 10_000_000 ? 0 : 1;
    return `${(value / 10_000).toFixed(digits)}万`;
  }
  return value.toFixed(0);
}

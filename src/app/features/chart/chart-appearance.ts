import { ColorType, type DeepPartial, type ChartOptions } from 'lightweight-charts';
import type { Appearance } from '../../hooks/useAppearance';

/** Change chart paint without replacing its series, range, or data. */
export function chartAppearance(appearance: Appearance): DeepPartial<ChartOptions> {
  const dark = appearance === 'dark';
  const border = dark ? '#32353b' : '#e5e8ef';
  const grid = dark ? '#25282e' : '#f0f2f6';
  return {
    layout: {
      background: { type: ColorType.Solid, color: dark ? '#1c1e23' : '#ffffff' },
      textColor: dark ? '#a1a8b5' : '#6f7786',
      fontFamily: 'Geist Variable, "Microsoft YaHei UI", sans-serif',
      fontSize: 11,
      panes: { separatorColor: border, separatorHoverColor: dark ? '#7899ee' : '#315ed5' },
    },
    grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    crosshair: {
      vertLine: { color: dark ? '#8994a8' : '#94a0b5', labelBackgroundColor: '#465978' },
      horzLine: { color: dark ? '#8994a8' : '#94a0b5', labelBackgroundColor: '#465978' },
    },
    timeScale: { borderColor: border },
    rightPriceScale: { borderColor: border },
  };
}

import type { ComparisonStock } from './SentimentStockComparison';
import type { QuoteChartRow } from './sentiment-event-view';
import { secondsClock } from './sentiment-seconds';
import { pct } from './sentiment-live-model';

export function SentimentChartReadout({ stocks, asOf, row, focused, onFocus }: { stocks: ComparisonStock[]; asOf: number; row?: QuoteChartRow; focused?: string | null; onFocus?: (code: string) => void }) {
  return <div className={`sent-quote-readout${row ? ' is-inspecting' : ''}`}>
    <div className="sent-quote-time"><span>{row ? '光标时刻' : '快照涨幅'}</span><time>{secondsClock(row?.time ?? asOf)}</time></div>
    <div className="sent-quote-values">{stocks.map(item => {
      const value = row ? row[item.stock.code] == null ? null : row[item.stock.code]! / 100 : item.stock.change_ratio;
      const content = <><span><i style={{ background: item.color }} />{item.stock.name}</span><b className={value != null && value > 0 ? 'is-rise' : value != null && value < 0 ? 'is-fall' : ''}>{pct(value, 2, true)}</b></>;
      return onFocus ? <button type="button" key={item.stock.code} aria-label={`聚焦${item.stock.name}`} aria-pressed={focused === item.stock.code} onClick={() => onFocus(item.stock.code)}>{content}</button> : <div key={item.stock.code}>{content}</div>;
    })}</div>
  </div>;
}

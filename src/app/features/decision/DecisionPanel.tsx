import { Activity, BarChart3, Database, Gauge, Layers3, Waves } from 'lucide-react';
import type { SectorStock, StockKlineBar } from '../../lib/api';
import { ChipDistributionChart } from './ChipDistributionChart';

interface DecisionPanelProps {
  stock: SectorStock | null;
  bar?: StockKlineBar | null;
  loading?: boolean;
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '--' : value.toFixed(digits);
}

function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(2)}万`;
  return value.toFixed(0);
}

function formatPercent(value: number | null | undefined, signed = true): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '--'
    : `${signed && value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percent.toFixed(2)}%`;
}

function hasValues(group: object | null | undefined): boolean {
  return !!group && Object.values(group).some(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
}

function latestBar(stock: SectorStock): StockKlineBar | null {
  return [...(stock.kline ?? [])]
    .sort((left, right) => left.date.localeCompare(right.date))
    .at(-1) ?? null;
}

interface IndicatorEntry {
  label: string;
  value: number | null | undefined;
  digits?: number;
}

function IndicatorSection({
  title,
  icon,
  entries,
}: {
  title: string;
  icon: React.ReactNode;
  entries: IndicatorEntry[];
}) {
  const visible = entries.filter(({ value }) => (
    typeof value === 'number' && Number.isFinite(value)
  ));
  if (!visible.length) return null;
  return (
    <section className="decision-section indicator-section">
      <h3>{icon}{title}</h3>
      <div className="indicator-grid">
        {visible.map(({ label, value, digits }) => (
          <span key={label}>{label}<b>{formatNumber(value, digits ?? 2)}</b></span>
        ))}
      </div>
    </section>
  );
}

export function DecisionPanel({
  stock,
  bar,
  loading = false,
}: DecisionPanelProps) {
  if (loading) {
    return <aside className="terminal-panel decision-panel"><div className="terminal-empty"><span className="loading-pulse" />行情快照加载中...</div></aside>;
  }

  if (!stock) {
    return <aside className="terminal-panel decision-panel"><div className="terminal-empty">选择个股查看行情快照</div></aside>;
  }

  const snapshot = bar === undefined ? latestBar(stock) : bar;
  if (!snapshot) {
    return <aside className="terminal-panel decision-panel"><div className="terminal-empty">该日期暂无日线行情</div></aside>;
  }

  const isUp = (snapshot.changePercent ?? snapshot.changeAmount ?? 0) >= 0;
  const chip = snapshot.chip;
  const chipAvailable = !!chip && (
    typeof chip.profitRatio === 'number'
    || typeof chip.avgCost === 'number'
    || !!chip.cost70
    || !!chip.cost90
    || (chip.chart?.x.length ?? 0) > 0
  );
  const followsCrosshair = snapshot.date !== stock.tradeDate;

  return (
    <aside className="terminal-panel decision-panel terminal-scroll">
      <div className="panel-title-row decision-title">
        <div>
          <span className="eyebrow"><Database size={12} /> MARKET SNAPSHOT</span>
          <h2>行情快照</h2>
        </div>
        <span className={`snapshot-source${followsCrosshair ? ' is-linked' : ''}`}><i />{followsCrosshair ? '十字光标联动' : '最新交易日'}</span>
      </div>

      <div className="decision-stock-line">
        <div><strong>{stock.name}</strong><span>{stock.code}</span></div>
        <small>交易日 {snapshot.date}</small>
      </div>

      <section className="decision-section market-snapshot">
        <h3><BarChart3 size={12} />日线行情</h3>
        <div className="snapshot-grid">
          <span>开盘<b>{formatNumber(snapshot.open)}</b></span>
          <span>最高<b className="market-rise">{formatNumber(snapshot.high)}</b></span>
          <span>最低<b className="market-fall">{formatNumber(snapshot.low)}</b></span>
          <span>收盘<b>{formatNumber(snapshot.close)}</b></span>
          <span>涨跌幅<b className={isUp ? 'market-rise' : 'market-fall'}>{formatPercent(snapshot.changePercent)}</b></span>
          <span>涨跌额<b className={isUp ? 'market-rise' : 'market-fall'}>{formatNumber(snapshot.changeAmount)}</b></span>
          <span>振幅<b>{formatPercent(snapshot.amplitudePercent, false)}</b></span>
          <span>换手率<b>{formatPercent(snapshot.turnoverPercent, false)}</b></span>
          <span>成交量<b>{formatAmount(snapshot.volume)}</b></span>
          <span className="snapshot-wide">成交额<b>{formatAmount(snapshot.amount)}</b></span>
        </div>
      </section>

      <section className="decision-section chip-section">
        <h3><Layers3 size={12} />筹码结构</h3>
        {chipAvailable ? (
          <>
            <div className="indicator-grid indicator-grid-two chip-summary-grid">
              <span>平均成本<b>{formatNumber(chip?.avgCost)}</b></span>
              <span>获利比例<b>{formatRatio(chip?.profitRatio)}</b></span>
            </div>
            <div className="chip-cost-ranges">
              {chip?.cost70 && hasValues(chip.cost70) && (
                <div className="chip-cost-card">
                  <span>70%成本区间</span>
                  <b>{formatNumber(chip.cost70.low)} - {formatNumber(chip.cost70.high)}</b>
                  <small>集中度 {formatRatio(chip.cost70.concentration)}</small>
                </div>
              )}
              {chip?.cost90 && hasValues(chip.cost90) && (
                <div className="chip-cost-card">
                  <span>90%成本区间</span>
                  <b>{formatNumber(chip.cost90.low)} - {formatNumber(chip.cost90.high)}</b>
                  <small>集中度 {formatRatio(chip.cost90.concentration)}</small>
                </div>
              )}
            </div>
            <ChipDistributionChart chip={chip} currentPrice={snapshot.close} tradeDate={snapshot.date} />
          </>
        ) : <p className="indicator-empty">该交易日未返回筹码数据</p>}
      </section>

      <IndicatorSection
        title="均线指标"
        icon={<Activity size={12} />}
        entries={[
          { label: 'MA5', value: snapshot.ma?.ma5 },
          { label: 'MA10', value: snapshot.ma?.ma10 },
          { label: 'MA20', value: snapshot.ma?.ma20 },
          { label: 'MA30', value: snapshot.ma?.ma30 },
          { label: 'MA60', value: snapshot.ma?.ma60 },
        ]}
      />
      <IndicatorSection
        title="量能均线"
        icon={<Waves size={12} />}
        entries={[
          { label: 'VMA5', value: snapshot.volumeMa?.volMa5, digits: 0 },
          { label: 'VMA10', value: snapshot.volumeMa?.volMa10, digits: 0 },
          { label: 'VMA20', value: snapshot.volumeMa?.volMa20, digits: 0 },
          { label: 'VMA60', value: snapshot.volumeMa?.volMa60, digits: 0 },
        ]}
      />
      <IndicatorSection
        title="MACD"
        icon={<Gauge size={12} />}
        entries={[
          { label: 'DIF', value: snapshot.macd?.dif, digits: 4 },
          { label: 'DEA', value: snapshot.macd?.dea, digits: 4 },
          { label: 'HIST', value: snapshot.macd?.hist, digits: 4 },
        ]}
      />
      <IndicatorSection
        title="BOLL"
        icon={<Layers3 size={12} />}
        entries={[
          { label: 'UPPER', value: snapshot.boll?.upper },
          { label: 'MID', value: snapshot.boll?.mid },
          { label: 'LOWER', value: snapshot.boll?.lower },
        ]}
      />
      <IndicatorSection
        title="KDJ"
        icon={<Activity size={12} />}
        entries={[
          { label: 'K', value: snapshot.kdj?.k },
          { label: 'D', value: snapshot.kdj?.d },
          { label: 'J', value: snapshot.kdj?.j },
        ]}
      />
      <IndicatorSection
        title="RSI"
        icon={<Gauge size={12} />}
        entries={[
          { label: 'RSI6', value: snapshot.rsi?.rsi6 },
          { label: 'RSI12', value: snapshot.rsi?.rsi12 },
          { label: 'RSI24', value: snapshot.rsi?.rsi24 },
        ]}
      />
      <IndicatorSection
        title="CCI / WR / ATR"
        icon={<Waves size={12} />}
        entries={[
          { label: 'CCI14', value: snapshot.cci?.cci14 },
          { label: 'WR6', value: snapshot.wr?.wr6 },
          { label: 'WR10', value: snapshot.wr?.wr10 },
          { label: 'WR14', value: snapshot.wr?.wr14 },
          { label: 'ATR14', value: snapshot.atr?.atr14 },
        ]}
      />

      <div className="decision-disclaimer"><Database size={12} />仅展示 Stock_Project {snapshot.date} 日线及随附指标，不生成研判或交易结论</div>
    </aside>
  );
}

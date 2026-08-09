# Stock Decision Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing news dashboard with a three-view A-share decision terminal centered on an interactive, real-data candlestick chart.

**Architecture:** Keep `src/app/lib/api.ts` as the backend adapter and introduce focused feature components for decision, market, and news views. The decision view owns selected sector/stock state; a dedicated chart module normalizes K-line data and renders candlesticks, moving averages, volume, crosshair legends, and trade-plan price lines through Lightweight Charts 5.2.0.

**Tech Stack:** React 18.3.1, TypeScript, Vite 6.3.5, Tailwind CSS 4, Lightweight Charts 5.2.0, Vitest 4.1.10.

## Global Constraints

- Use only the six backend endpoints listed in `docs/superpowers/specs/2026-08-08-stock-decision-terminal-design.md`.
- Use A-share colors: red for rising candles and green for falling candles.
- Do not render fabricated market or stock values when an endpoint is unavailable.
- Do not expose minute, week, or month periods while the backend only supplies approximately 30 daily bars.
- Keep decision workspace, market insights, and news intelligence available in the final shell.
- Preserve `VITE_API_BASE_URL`; make the Vite development proxy target configurable with `VITE_API_PROXY_TARGET`.
- The current directory has no `.git`; run the documented commit commands only if `git rev-parse --is-inside-work-tree` succeeds.

---

## File Structure

- Create `src/app/features/chart/chart-data.ts`: validate, sort, deduplicate, and calculate moving averages for K-line data.
- Create `src/app/features/chart/chart-data.test.ts`: pure data tests.
- Create `src/app/features/chart/ProfessionalCandlestickChart.tsx`: Lightweight Charts lifecycle and interaction.
- Create `src/app/features/decision/OpportunityRadar.tsx`: sector and stock selection.
- Create `src/app/features/decision/DecisionPanel.tsx`: AI recommendation and trading levels.
- Create `src/app/features/decision/DecisionWorkspace.tsx`: decision-view data orchestration.
- Create `src/app/features/market/MarketInsightsView.tsx`: compose existing morning, trend, and heat modules.
- Create `src/app/features/news/NewsIntelligenceView.tsx`: news filters, list, and detail.
- Create `src/app/components/TerminalHeader.tsx`: navigation, status, and index strip.
- Create `src/styles/terminal.css`: design tokens and responsive professional-terminal layout.
- Modify `src/app/lib/api.ts`: expose richer K-line fields and mapper.
- Modify `src/app/App.tsx`: replace the old single dashboard with the terminal shell.
- Modify `src/styles/index.css`: import terminal styles.
- Modify `vite.config.ts`: environment-driven API proxy target.
- Modify `package.json` and `package-lock.json`: chart and test dependencies/scripts.
- Create `.env.example`: document API configuration.

---

### Task 1: Chart and Test Tooling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: Vite environment variables.
- Produces: `lightweight-charts@5.2.0`, `vitest@4.1.10`, `npm test`, and `VITE_API_PROXY_TARGET` configuration.

- [ ] **Step 1: Install exact dependencies**

```powershell
npm install lightweight-charts@5.2.0
npm install --save-dev vitest@4.1.10 jsdom@30.0.1
```

- [ ] **Step 2: Add test scripts to `package.json`**

```json
{
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Make the development proxy configurable**

Use `loadEnv` in `vite.config.ts` and set:

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://39.106.202.228:8092/';
  return {
    server: {
      proxy: {
        '/backend-api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/backend-api/, ''),
        },
      },
    },
  };
});
```

- [ ] **Step 4: Document environment keys**

Create `.env.example` with:

```dotenv
VITE_API_BASE_URL=/backend-api
VITE_API_PROXY_TARGET=http://127.0.0.1:8000/
```

- [ ] **Step 5: Verify toolchain**

Run: `npm test -- --passWithNoTests`

Expected: Vitest exits successfully with no test files.

- [ ] **Step 6: Commit when Git is available**

```powershell
git add package.json package-lock.json vite.config.ts .env.example
git commit -m "chore: add financial chart tooling"
```

---

### Task 2: K-Line Data Model and Pure Transformations

**Files:**
- Modify: `src/app/lib/api.ts`
- Create: `src/app/features/chart/chart-data.ts`
- Create: `src/app/features/chart/chart-data.test.ts`

**Interfaces:**
- Consumes: `SectorStock['kline']` values from `api.ts`.
- Produces: `ChartBar`, `normalizeChartBars(bars)`, and `calculateSma(bars, period)`.

- [ ] **Step 1: Write failing normalization and moving-average tests**

```ts
import { describe, expect, it } from 'vitest';
import { calculateSma, normalizeChartBars } from './chart-data';

describe('normalizeChartBars', () => {
  it('filters invalid OHLC values, sorts dates, and keeps the last duplicate', () => {
    const result = normalizeChartBars([
      { date: '2026-01-03', open: 11, high: 13, low: 10, close: 12, amount: 8 },
      { date: '2026-01-02', open: 10, high: 12, low: 9, close: 11, amount: 5 },
      { date: '2026-01-02', open: 10, high: 13, low: 9, close: 12, amount: 6 },
      { date: '', open: 0, high: 0, low: 0, close: 0, amount: 0 },
    ]);
    expect(result.map((bar) => [bar.time, bar.close])).toEqual([
      ['2026-01-02', 12],
      ['2026-01-03', 12],
    ]);
  });
});

describe('calculateSma', () => {
  it('starts only after a full period is available', () => {
    const bars = normalizeChartBars([
      { date: '2026-01-01', open: 1, high: 1, low: 1, close: 1 },
      { date: '2026-01-02', open: 2, high: 2, low: 2, close: 2 },
      { date: '2026-01-03', open: 3, high: 3, low: 3, close: 3 },
    ]);
    expect(calculateSma(bars, 2)).toEqual([
      { time: '2026-01-02', value: 1.5 },
      { time: '2026-01-03', value: 2.5 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm test -- src/app/features/chart/chart-data.test.ts`

Expected: FAIL because `chart-data.ts` does not exist.

- [ ] **Step 3: Extend the API K-line type and mapping**

Add these optional raw fields to `RawKlineBar`: `change_amount`, `change_percent`, `turnover_amount_yuan`, `turnover_percent`, `amplitude_percent`, and `volume`.

Extend each public K-line item to:

```ts
export interface StockKlineBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  amount: number | null;
  volume: number | null;
  changeAmount: number | null;
  changePercent: number | null;
}
```

Make `SectorStock.kline` equal `StockKlineBar[]` and map the snake_case values without replacing missing amounts with zero.

- [ ] **Step 4: Implement chart normalization and SMA**

```ts
import type { StockKlineBar } from '../../lib/api';

export interface ChartBar extends StockKlineBar {
  time: string;
  amount: number;
  volume: number;
}

export function normalizeChartBars(input: StockKlineBar[]): ChartBar[] {
  const byDate = new Map<string, ChartBar>();
  input.forEach((bar) => {
    const values = [bar.open, bar.high, bar.low, bar.close];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bar.date) || values.some((value) => !Number.isFinite(value) || value <= 0)) return;
    if (bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close)) return;
    byDate.set(bar.date, { ...bar, time: bar.date, amount: bar.amount ?? 0, volume: bar.volume ?? 0 });
  });
  return [...byDate.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export function calculateSma(bars: ChartBar[], period: number) {
  return bars.slice(period - 1).map((bar, index) => ({
    time: bar.time,
    value: bars.slice(index, index + period).reduce((sum, item) => sum + item.close, 0) / period,
  }));
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/app/features/chart/chart-data.test.ts`

Expected: two passing tests.

- [ ] **Step 6: Commit when Git is available**

```powershell
git add src/app/lib/api.ts src/app/features/chart/chart-data.ts src/app/features/chart/chart-data.test.ts
git commit -m "feat: normalize stock kline data"
```

---

### Task 3: Professional Candlestick Chart

**Files:**
- Create: `src/app/features/chart/ProfessionalCandlestickChart.tsx`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Consumes: `stock: SectorStock | null`.
- Produces: `ProfessionalCandlestickChart({ stock }: { stock: SectorStock | null })`.

- [ ] **Step 1: Build the chart container and empty state**

Render a toolbar, OHLC legend, a `ref` container, and “暂无有效 K 线数据” when `normalizeChartBars(stock?.kline ?? [])` is empty.

- [ ] **Step 2: Create chart and series in an effect**

Use:

```ts
const chart = createChart(container, {
  autoSize: true,
  layout: { background: { type: ColorType.Solid, color: '#0a1019' }, textColor: '#7f8da3' },
  grid: { vertLines: { color: '#182334' }, horzLines: { color: '#182334' } },
  crosshair: { mode: CrosshairMode.Normal },
  timeScale: { borderColor: '#263348', timeVisible: false },
  rightPriceScale: { borderColor: '#263348', scaleMargins: { top: 0.08, bottom: 0.28 } },
});
const candles = chart.addSeries(CandlestickSeries, {
  upColor: '#ef5350', downColor: '#18b98b', borderVisible: false,
  wickUpColor: '#ef5350', wickDownColor: '#18b98b',
});
```

Set candle data, MA5/10/20 line data, and a volume histogram with `priceFormat: { type: 'volume' }` and bottom scale margins.

- [ ] **Step 3: Add decision price lines**

Create labeled lines only for finite positive values:

```ts
candles.createPriceLine({ price: stock.buyPrice!, color: '#f5b942', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '计划买入' });
candles.createPriceLine({ price: stock.stopLoss!, color: '#18b98b', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '止损' });
candles.createPriceLine({ price: stock.takeProfit!, color: '#ef5350', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '止盈' });
```

- [ ] **Step 4: Add crosshair OHLC legend and controls**

Subscribe to `chart.subscribeCrosshairMove`, read the candlestick data from `param.seriesData`, and update React legend state. Implement buttons for 10/20/30 bars, moving-average visibility, volume visibility, fit content, and browser fullscreen.

- [ ] **Step 5: Clean up chart lifecycle**

The effect cleanup must unsubscribe crosshair handlers and call `chart.remove()` so stock changes do not leak canvas instances.

- [ ] **Step 6: Verify build**

Run: `npm run build`

Expected: Vite production build succeeds and TypeScript accepts Lightweight Charts 5.2 APIs.

- [ ] **Step 7: Commit when Git is available**

```powershell
git add src/app/features/chart/ProfessionalCandlestickChart.tsx src/styles/terminal.css
git commit -m "feat: add professional candlestick workspace"
```

---

### Task 4: Decision Workspace

**Files:**
- Create: `src/app/features/decision/OpportunityRadar.tsx`
- Create: `src/app/features/decision/DecisionPanel.tsx`
- Create: `src/app/features/decision/DecisionWorkspace.tsx`

**Interfaces:**
- Consumes: `getSectorTrend`, `getNewsHeatmap`, and `getSectorStocks`.
- Produces: `DecisionWorkspace({ initialSector, onSectorConsumed })` and selected-sector navigation.

- [ ] **Step 1: Implement opportunity radar**

Accept `trend`, `heat`, `stocks`, `selectedSector`, `selectedStockCode`, `onSectorSelect`, and `onStockSelect`. Render tabs for investment preference and market heat, followed by a compact stock list. Use scores, news counts, recommendation, and change percent already present in the public API types.

- [ ] **Step 2: Implement decision panel**

Accept `stock: SectorStock | null`; render recommendation, analysis status, buy/stop/take levels, trigger condition, expected entry, conclusion, reason, OHLC, amplitude, turnover, and amount. Use explicit `--` for missing numeric fields and include “仅供研究参考”.

- [ ] **Step 3: Orchestrate data loading**

In `DecisionWorkspace`, load trend and heat with `Promise.allSettled`. Pick the first non-empty sector, then call `getSectorStocks(sector, tradeDate)`. Guard each request with a cancellation flag so an older response cannot replace a newer selection.

- [ ] **Step 4: Compose the three columns**

```tsx
<main className="decision-grid">
  <OpportunityRadar {...radarProps} />
  <ProfessionalCandlestickChart stock={selectedStock} />
  <DecisionPanel stock={selectedStock} />
</main>
```

Render independent loading, error, and empty states in the left and center columns.

- [ ] **Step 5: Verify build**

Run: `npm run build`

Expected: the workspace compiles and no existing component imports are broken.

- [ ] **Step 6: Commit when Git is available**

```powershell
git add src/app/features/decision
git commit -m "feat: build three-column decision workspace"
```

---

### Task 5: Market and News Views

**Files:**
- Create: `src/app/features/market/MarketInsightsView.tsx`
- Create: `src/app/features/news/NewsIntelligenceView.tsx`

**Interfaces:**
- Consumes: existing `MarketAnalysis`, `SectorTrend`, `NewsHeatmap`, `FilterPanel`, `NewsCard`, and `NewsDialog` components plus API query functions.
- Produces: `MarketInsightsView({ onOpenSector })` and `NewsIntelligenceView({ onOpenSector })`.

- [ ] **Step 1: Compose market insights**

Place `MarketAnalysis` in a full-width lead panel and `SectorTrend` / `NewsHeatmap` in a two-column lower grid. Route their sector clicks through `onOpenSector`, which switches the app to the decision view.

- [ ] **Step 2: Build news query state**

Move news search, sentiment filter, sort, loading, error, and selected-item state from the old `App.tsx` into `NewsIntelligenceView` and keep the existing 200 ms debounced request behavior.

- [ ] **Step 3: Build list + detail layout**

Render a scrollable news list on the left and a persistent detail panel on the right for desktop. Reuse `NewsDialog` only on narrow screens; desktop details should show the same title, score, content, analysis reason, key points, stocks, and sectors inline.

- [ ] **Step 4: Add sector navigation**

Each related sector chip calls `onOpenSector(sector)` so the decision workspace opens with that sector selected.

- [ ] **Step 5: Verify build**

Run: `npm run build`

Expected: market and news views compile and remain reachable from the shell.

- [ ] **Step 6: Commit when Git is available**

```powershell
git add src/app/features/market src/app/features/news
git commit -m "feat: preserve market and news intelligence views"
```

---

### Task 6: Terminal Shell and Visual System

**Files:**
- Create: `src/app/components/TerminalHeader.tsx`
- Modify: `src/app/App.tsx`
- Create: `src/styles/terminal.css`
- Modify: `src/styles/index.css`

**Interfaces:**
- Consumes: `getMarketIndices`, the three feature views, and app-level sector navigation.
- Produces: the completed three-view application shell.

- [ ] **Step 1: Build the header and market strip**

Render brand, navigation buttons, market date, API status, and up to five returned indices. No fallback index array is permitted. Use a loading skeleton, empty label, or error label when data is unavailable.

- [ ] **Step 2: Rewrite app-level navigation**

Use:

```ts
type WorkspaceView = 'decision' | 'market' | 'news';
const [activeView, setActiveView] = useState<WorkspaceView>('decision');
const [pendingSector, setPendingSector] = useState<string | null>(null);
```

`openSector(sector)` sets `pendingSector` and switches to `decision`. Render only the active feature view to keep chart lifecycle predictable.

- [ ] **Step 3: Implement terminal tokens and layout**

Define CSS variables for background, panels, borders, text, cyan accent, red rise, green fall, and MA colors. Implement fixed desktop shell height, 280px/flexible/330px decision columns, 12px gaps, compact control heights, tabular numerals, focus states, skeleton shimmer, and readable empty/error states.

- [ ] **Step 4: Add responsive behavior**

At widths below 1100px, stack decision columns and allow document scrolling. At widths below 720px, make navigation horizontally scrollable, collapse the index strip to cards, and switch news details to the dialog.

- [ ] **Step 5: Add attribution**

Place a small footer link reading “Charts by TradingView Lightweight Charts” in the chart or shell to satisfy the library notice requirement.

- [ ] **Step 6: Verify build and tests**

Run: `npm test`

Expected: all chart-data tests pass.

Run: `npm run build`

Expected: production build succeeds.

- [ ] **Step 7: Commit when Git is available**

```powershell
git add src/app/App.tsx src/app/components/TerminalHeader.tsx src/styles/index.css src/styles/terminal.css
git commit -m "feat: deliver stock decision terminal shell"
```

---

### Task 7: Final Regression and Handoff

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete application.
- Produces: verified build instructions and known API deployment requirement.

- [ ] **Step 1: Run complete automated verification**

```powershell
npm test
npm run build
```

Expected: both commands exit with code 0.

- [ ] **Step 2: Start the development server for smoke testing**

Run: `npm run dev -- --host 127.0.0.1`

Verify the decision, market, and news tabs render; API failures show panel-level states; the app does not display fabricated prices.

- [ ] **Step 3: Update README**

Document `npm install`, `npm run dev`, `npm test`, `npm run build`, `VITE_API_BASE_URL`, `VITE_API_PROXY_TARGET`, the six backend endpoints, and the fact that a valid stock backend URL is required because the previous fixed host currently serves an unrelated API.

- [ ] **Step 4: Inspect final diff or file list**

If Git is available, run `git diff --check` and `git status --short`. Otherwise run `rg --files src docs package.json vite.config.ts .env.example README.md` and inspect the generated file list.

- [ ] **Step 5: Commit when Git is available**

```powershell
git add README.md
git commit -m "docs: document stock terminal setup"
```

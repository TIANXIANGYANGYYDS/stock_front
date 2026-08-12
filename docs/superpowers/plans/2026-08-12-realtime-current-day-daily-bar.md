# Realtime Current-Day Daily Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep current prices, dates, percentage changes, and the latest daily-chart position consistent with realtime data until the backend stores the official current-day daily bar.

**Architecture:** Add pure realtime merge and intraday aggregation helpers, keep network requests in existing hooks, and let `DecisionWorkspace` coordinate selected quote precedence plus current-session intraday data. `ProfessionalCandlestickChart` receives already-fetched data and appends a temporary bar only when the official daily series lacks that date.

**Tech Stack:** React 18, TypeScript, Vitest, Vite 6, lightweight-charts 5.

## Global Constraints

- Do not fabricate a daily candle from a single realtime price.
- Do not replace or mutate the previous trading day's official candle.
- Do not synthesize technical indicators for the temporary candle.
- Keep the current component structure, request wrapper, and dependencies.
- Preserve current worktree changes from the date-separation task.

---

### Task 1: Pure Realtime Merge and Daily Aggregation

**Files:**
- Modify: `src/app/lib/realtime-format.ts`
- Modify: `src/app/lib/realtime-format.test.ts`
- Modify: `src/app/features/chart/chart-data.ts`
- Modify: `src/app/features/chart/chart-data.test.ts`

**Interfaces:**
- Produces: `mergeRealtimeStockItems(dailyItems, realtimeItems, realtimeTradingDate, selectedQuote?)`.
- Produces: `buildCurrentDayChartBars(dailyBars, intradayBars, realtimeQuote, realtimeTradingDate)`.

- [ ] **Step 1: Write failing pure behavior tests**

Assert literal outcomes for a daily item `{ tradeDate: '2026-08-11', close: 900 }` plus realtime `{ price: 918 }` and `tradingDate: '2026-08-12'`: output date is `2026-08-12`, close is `918`, percentage is `2`. Assert an older realtime date leaves the item unchanged and a selected quote wins over the batch quote.

Aggregate two minute bars into one `2026-08-12` chart bar with literal open/high/low/close/volume/amount values. Assert the helper returns no temporary bar without minute OHLC and does not append when official daily data already contains `2026-08-12`.

- [ ] **Step 2: Run focused pure tests and verify RED**

Run: `npm test -- src/app/lib/realtime-format.test.ts src/app/features/chart/chart-data.test.ts`

Expected: FAIL because the merge signature and current-day chart helper do not implement the new behavior.

- [ ] **Step 3: Implement minimal pure helpers**

Normalize ISO dates lexically, ignore stale realtime dates, compute percentage only against a finite positive official close, and append one aggregation result after normalized official bars. Leave all indicator properties absent on the temporary bar.

- [ ] **Step 4: Run focused pure tests and verify GREEN**

Run: `npm test -- src/app/lib/realtime-format.test.ts src/app/features/chart/chart-data.test.ts`

Expected: all focused tests pass.

### Task 2: Workspace Realtime Coordination

**Files:**
- Modify: `src/app/features/decision/DecisionWorkspace.tsx`
- Modify: `src/app/features/decision/DecisionWorkspace.test.tsx`

**Interfaces:**
- Consumes: Task 1 merge helper.
- Produces: selected-row quote precedence and current realtime trading-date intraday request in daily mode when official daily data is behind.

- [ ] **Step 1: Write failing coordination tests**

Return a batch quote at `918.08` and selected quote at `918.38`; assert both navigator selected row and chart receive/use `918.38`. With official detail ending `2026-08-11` and realtime trading date `2026-08-12`, assert `useStockIntraday` is enabled with `tradeDate: '2026-08-12'` in daily mode.

- [ ] **Step 2: Run workspace test and verify RED**

Run: `npm test -- src/app/features/decision/DecisionWorkspace.test.tsx`

Expected: FAIL because the selected row currently uses batch data and daily mode disables intraday.

- [ ] **Step 3: Implement minimal workspace coordination**

Select the newest valid single quote, pass it into list merging, derive the intraday request date from realtime response when newer, and enable intraday for either explicit intraday mode or a missing official current-day bar.

- [ ] **Step 4: Run workspace test and verify GREEN**

Run: `npm test -- src/app/features/decision/DecisionWorkspace.test.tsx`

Expected: all workspace tests pass.

### Task 3: Chart Temporary Bar and Latest Date Semantics

**Files:**
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx`
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

**Interfaces:**
- Consumes: `buildCurrentDayChartBars` from Task 1.
- Produces: a rendered temporary current-day candle, realtime date/percentage at the latest position, and official historical behavior under the crosshair.

- [ ] **Step 1: Write failing chart behavior tests**

Render historical data ending `2026-08-11`, realtime response dated `2026-08-12`, and minute bars dated `2026-08-12`. Assert candlestick `setData` includes the aggregated `2026-08-12` bar, header date is `2026-08-12`, and status says “盘中临时日 K”. Rerender with an official `2026-08-12` daily bar and assert the official OHLC replaces the aggregate. Render realtime without minute bars and assert no new candle is created.

- [ ] **Step 2: Run chart test and verify RED**

Run: `npm test -- src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

Expected: FAIL because daily bars currently ignore intraday data.

- [ ] **Step 3: Implement minimal chart behavior**

Build chart bars through the Task 1 helper, use realtime date and computed current-day change at the latest position, preserve historical crosshair values, and keep the indicator series limited to fields that exist.

- [ ] **Step 4: Run chart test and verify GREEN**

Run: `npm test -- src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

Expected: all chart tests pass.

### Task 4: Refresh Latest Dates and Verify

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Produces: periodic `getLatestMarketDates()` refresh that preserves last successful dates on refresh failure.

- [ ] **Step 1: Write failing App refresh test**

Use fake timers, resolve the first call with `marketTradeDate: '2026-08-11'`, then the scheduled call with `marketTradeDate: '2026-08-12'`; assert the mounted decision workspace receives the new date without showing the initial loading gate again.

- [ ] **Step 2: Run App test and verify RED**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the date endpoint currently runs once.

- [ ] **Step 3: Implement refresh and update documentation**

Schedule a 60-second refresh after every settled request, prevent overlapping calls, preserve the last successful state after refresh errors, and clean the timer on unmount. Document realtime list semantics and temporary daily-bar behavior.

- [ ] **Step 4: Run final verification**

Run:

```text
npm test
npx tsc --noEmit --jsx react-jsx --lib ES2023,DOM,DOM.Iterable --module ESNext --moduleResolution bundler --target ES2022 --skipLibCheck --types vite/client src/app/lib/api.ts src/app/lib/realtime-format.ts src/app/features/chart/chart-data.ts src/app/features/decision/DecisionWorkspace.tsx src/app/features/chart/ProfessionalCandlestickChart.tsx src/app/App.tsx
npm run build
git diff --check
```

Expected: tests, scoped typecheck, build, and whitespace check exit 0.

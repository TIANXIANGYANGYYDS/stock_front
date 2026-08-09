# Professional Terminal Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the three workspaces and add stock navigation, backend-native chart indicators, ranking windows, morning-analysis details, news windows/sorts, truthful index placeholders, and larger typography.

**Architecture:** App owns only the active workspace and resolved latest trade date. Decision data flows through stock-list and single-stock-history APIs; market ranking windows are derived only by selecting stored backend snapshots; news windows are timestamp ranges anchored to the resolved trade date. Lightweight Charts owns stable pre-created series whose visibility changes without recreating the chart.

**Tech Stack:** React 18, TypeScript, Vite 6, Vitest 4, Lightweight Charts 5, Recharts 2, Stock_Project REST API.

## Global Constraints

- The sole data source remains Stock_Project through `/backend-api/api/v1/*`.
- Do not fabricate index values, indicators, rankings, stock analysis, or trade advice.
- Every time window is anchored to the resolved latest trade date, never the browser calendar date.
- The workspace has no `.git` directory, so commit steps are intentionally omitted.

---

### Task 1: Data contracts and window helpers

**Files:**
- Modify: `src/app/lib/api-trade-date.test.ts`
- Modify: `src/app/lib/stock-project-mappers.test.ts`
- Modify: `src/app/features/chart/chart-data.test.ts`
- Modify: `src/app/lib/api.ts`
- Modify: `src/app/features/chart/chart-data.ts`

**Interfaces:**
- Produces: `RankingWindow`, `NewsWindowDays`, `StockListItem`, `getStockList()`, `getStockDetail()`, ranking snapshot window selection, and raw BOLL/KDJ/RSI/CCI/WR mappings.

- [ ] Write failing tests for 1h/1d/3d/7d ranking snapshot filtering, 1d/3d/7d news timestamp ranges, stock search/detail request paths, and raw indicator mapping.
- [ ] Run the focused tests and verify failures are caused by missing contracts.
- [ ] Implement the minimal API mappings and pure window/series helpers.
- [ ] Run the focused tests until all pass.

### Task 2: Truthful market-index header

**Files:**
- Modify: `src/app/components/TerminalHeader.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Consumes: trade date and backend connection state.
- Produces: five fixed index slots with empty values until Stock_Project exposes an index endpoint.

- [ ] Write a failing header test asserting ordinary stocks never appear in the index strip and the five index names do.
- [ ] Run the test and confirm the existing ticker rendering fails it.
- [ ] Replace ticker props/rendering with fixed truthful index slots and remove the stock-daily header request.
- [ ] Run the header and App tests until passing.

### Task 3: Stock-first decision workspace

**Files:**
- Create: `src/app/features/decision/StockNavigator.tsx`
- Modify: `src/app/features/decision/DecisionWorkspace.tsx`
- Modify: `src/app/features/decision/decision-state.ts`
- Modify: `src/app/features/decision/decision-state.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Consumes: `getStockList(tradeDate, keyword)` and `getStockDetail(code, tradeDate)`.
- Produces: a selected `SectorStock | null` for the chart and snapshot panel without ranking dependencies.

- [ ] Write failing state/API tests for default stock selection and code/name search.
- [ ] Verify the focused tests fail before implementation.
- [ ] Build the searchable stock navigator and single-stock loading flow; remove ranking and pending-sector props from DecisionWorkspace.
- [ ] Run decision tests until passing.

### Task 4: Multi-indicator candlestick chart

**Files:**
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.test.tsx`
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx`
- Modify: `src/app/features/chart/chart-data.ts`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Consumes: raw indicator values on every `StockKlineBar`.
- Produces: overlay toggles for MA/BOLL and a stable single-select oscillator pane for VOL/MACD/KDJ/RSI/CCI/WR.

- [ ] Write failing interaction tests that locate every indicator control and prove visibility changes do not recreate the chart.
- [ ] Run the focused chart tests and observe the missing-control failure.
- [ ] Pre-create backend-data series, store grouped refs, and update only `visible` options when controls change.
- [ ] Run chart tests until passing.

### Task 5: Market insight details and ranking windows

**Files:**
- Modify: `src/app/components/MarketAnalysis.tsx`
- Modify: `src/app/components/SectorTrend.tsx`
- Modify: `src/app/components/NewsHeatmap.tsx`
- Modify: `src/app/features/market/MarketInsightsView.tsx`
- Modify: `src/app/features/market/market-analysis-state.test.ts`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Consumes: dated morning analysis and `RankingWindow` responses.
- Produces: local detail modal and four shared ranking period controls with no workspace navigation callback.

- [ ] Write failing component/state tests for opening a mainline detail and changing ranking windows without calling navigation.
- [ ] Verify the failures.
- [ ] Implement the detail overlay, local sector highlighting, and ranking window controls.
- [ ] Run focused market tests until passing.

### Task 6: News periods and explicit sorting

**Files:**
- Create: `src/app/features/news/news-state.ts`
- Create: `src/app/features/news/news-state.test.ts`
- Modify: `src/app/features/news/NewsIntelligenceView.tsx`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Produces: `sortNews(items, field, direction)` and controls for today/3d/7d, time/score, ascending/descending.

- [ ] Write failing pure tests for time and score ordering in both directions.
- [ ] Run them and verify the helper is missing.
- [ ] Implement the pure sorter and wire independent range, field, and direction controls into the view.
- [ ] Run focused news tests until passing.

### Task 7: Typography and full verification

**Files:**
- Modify: `src/styles/terminal.css`
- Modify: `README.md`

**Interfaces:**
- Produces: readable 12px+ primary copy and documented backend limitations.

- [ ] Increase common terminal typography and matching control heights without changing the visual theme.
- [ ] Run `npm test` and require every Vitest suite to pass.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Smoke-test health, latest trade date, one stock history, ranking history, and news through `http://127.0.0.1:5188/backend-api`.

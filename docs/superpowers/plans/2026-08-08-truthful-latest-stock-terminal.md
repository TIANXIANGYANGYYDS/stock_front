# Truthful Latest Stock Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the terminal show only the latest Stock_Project records and keep K-line indicator layers stable through every toolbar interaction.

**Architecture:** Preserve Stock_Project indicator fields at the API mapper boundary, render them as read-only snapshots, and remove every frontend-generated trade decision. Keep a persistent Lightweight Charts instance per loaded symbol while period and visibility controls update only range or series options.

**Tech Stack:** React 18, TypeScript, Vite 6, Vitest 4, Lightweight Charts 5, FastAPI/MongoDB backend.

## Global Constraints

- The sole market-data source is the current Stock_Project API under `/backend-api/api/v1/*`.
- Do not fetch third-party quotes, generate sample rows, or derive per-stock recommendations in the frontend.
- MA, MACD, and chip values must come directly from Stock_Project daily records; missing values remain missing.
- The frontend development URL remains `http://localhost:5188`; the backend remains `http://0.0.0.0:8100`.

---

### Task 1: Preserve raw backend indicators

**Files:**
- Modify: `src/app/lib/stock-project-mappers.test.ts`
- Modify: `src/app/lib/api.ts`

**Interfaces:**
- Produces: `StockKlineBar.ma`, `StockKlineBar.macd`, and `StockKlineBar.chip`, each nullable and mapped without calculation.

- [ ] **Step 1: Write the failing mapper test**

Add literal MA/MACD/chip input values and assert the returned bar contains camel-cased values.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/lib/stock-project-mappers.test.ts`
Expected: FAIL because `mapStockProjectDailyBar` currently drops `ma`, `macd`, and `chip`.

- [ ] **Step 3: Implement the minimal mapper contract**

Define nullable indicator interfaces, add them to `StockKlineBar`, and map the raw nested values with `toNullableNumber`.

- [ ] **Step 4: Remove the decision model and verify**

Delete `Recommendation`, `TechnicalDecision`, `deriveTechnicalDecision`, and decision properties on `SectorStock`; make `buildSectorStock` expose only the latest bar plus raw indicators. Run the mapper test until PASS.

### Task 2: Make chart layers consume backend values and survive controls

**Files:**
- Modify: `src/app/features/chart/chart-data.test.ts`
- Modify: `src/app/features/chart/chart-data.ts`
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx`

**Interfaces:**
- Produces: `buildMovingAverageData(bars: ChartBar[], key: 'ma5' | 'ma10' | 'ma20'): LineData<Time>[]`.
- Consumes: nullable `StockKlineBar.ma` values from Task 1.

- [ ] **Step 1: Write the failing MA source test**

Use three bars whose close prices differ from literal backend MA values, leave one MA value null, and assert output contains only the two backend-provided points.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/features/chart/chart-data.test.ts`
Expected: FAIL because `buildMovingAverageData` does not exist.

- [ ] **Step 3: Implement the backend-only series helper**

Map non-null `bar.ma[key]` values to `{ time: bar.date, value }`; do not calculate an SMA from closes.

- [ ] **Step 4: Decouple chart lifecycle from UI state**

Create all candle, MA, and volume series in the data effect. Keep refs to the chart and series. Put range updates in an effect depending only on `bars.length` and `windowSize`; put visibility updates in effects depending only on `showMovingAverages` or `showVolume`. Remove buy/stop/take-profit price lines.

- [ ] **Step 5: Verify chart unit tests**

Run: `npm test -- src/app/features/chart/chart-data.test.ts`
Expected: PASS.

### Task 3: Replace generated analysis with a latest snapshot

**Files:**
- Modify: `src/app/features/decision/DecisionPanel.tsx`
- Modify: `src/app/features/decision/OpportunityRadar.tsx`
- Modify: `src/app/components/MarketAnalysis.tsx`
- Modify: `src/app/features/market/MarketInsightsView.tsx`
- Delete: `src/app/components/SectorStocksDialog.tsx`
- Delete: `src/app/components/SectorStocks.tsx`
- Modify: `src/styles/terminal.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: the raw latest `SectorStock` market and indicator values from Task 1.
- Produces: a read-only latest snapshot panel and direct sector-to-workspace navigation callback.

- [ ] **Step 1: Render the latest snapshot**

Replace recommendation and trade-plan blocks with OHLC, change, amount/volume, MA, MACD, and chip sections. Render `后端未返回` for absent indicator groups and the explicit no-analysis disclaimer.

- [ ] **Step 2: Remove recommendation presentation**

Replace radar recommendation tags with trade dates. Remove buy-count calculation, recommendation-colored sector cards, and the recommendation dialog from market analysis; sector clicks navigate to the decision workspace.

- [ ] **Step 3: Remove stale fabricated components and copy**

Delete the unused hardcoded stock files, remove their imports/styles, and document the backend-only data boundary in README.

- [ ] **Step 4: Search for forbidden leftovers**

Run: `rg -n "deriveTechnicalDecision|recommendation|buyPrice|stopLoss|takeProfit|参考入场|止损位置|止盈目标" src README.md`
Expected: no matches in production stock-terminal code.

### Task 4: Remove the rejected local bootstrap data

**Files:**
- Delete: `D:/study/shilv/Stock_Project/.local/bootstrap_frontend_market.py`

**Interfaces:**
- Consumes: local Mongo collection `stock_project.stock_daily_detail`.
- Produces: zero documents matching `{ "source.provider": "tencent" }`.

- [ ] **Step 1: Verify the exact deletion target**

Count documents whose `source.provider` equals `tencent` and inspect their provider/date range before mutation.

- [ ] **Step 2: Delete only rejected records**

Call `delete_many({"source.provider": "tencent"})`; do not modify any other database or provider.

- [ ] **Step 3: Verify cleanup**

Recount the same filter and call `/api/v1/stats`; expected filtered count is `0`, while the API remains healthy even if it truthfully reports zero stocks.

- [ ] **Step 4: Delete the importer**

Remove `.local/bootstrap_frontend_market.py` so it cannot be rerun accidentally.

### Task 5: Full verification

**Files:**
- Verify all modified frontend and backend-local cleanup targets.

**Interfaces:**
- Produces: evidence that tests, build, runtime API, and UI interactions satisfy the design.

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all Vitest suites PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Vite build exits `0` with no TypeScript errors.

- [ ] **Step 3: Smoke-test runtime boundaries**

Request `http://127.0.0.1:8100/api/v1/health`, `http://127.0.0.1:5188/backend-api/api/v1/health`, and the stats endpoint; confirm the proxy uses Stock_Project and no third-party data appears.

- [ ] **Step 4: Exercise chart controls**

With any real Stock_Project symbol available, click 10/20/30-day windows, toggle MA and volume twice, enter and exit fullscreen, and confirm enabled layers remain visible. If the database has no symbols, rely on unit/build evidence and report that live interaction cannot be exercised without genuine backend rows.

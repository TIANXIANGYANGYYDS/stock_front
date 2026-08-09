# Stock Project API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every retired dashboard API call with Stock Project query endpoints while preserving the decision terminal and real K-line rendering.

**Architecture:** Rebuild `src/app/lib/api.ts` as a tested Stock Project adapter. Keep UI-facing types stable where practical, add a header overview type, and derive clearly labeled technical-rule decisions from persisted daily bars when the backend has no per-stock decision endpoint.

**Tech Stack:** React 18.3.1, TypeScript, Vite 6.3.5, Vitest 4.1.10, Lightweight Charts 5.2.0.

## Global Constraints

- Backend listener: `0.0.0.0:8100`; Vite proxy target: `http://127.0.0.1:8100/`.
- Use only endpoints documented in `Stock_Project/docs/API.md`.
- Never fabricate indices, ranking history, stock prices, or backend AI conclusions.
- Preserve red-rise/green-fall A-share chart colors.
- The frontend directory is not a Git repository; skip commit steps.

---

### Task 1: Stock Project Pure Mappers

**Files:**
- Create: `src/app/lib/stock-project-mappers.test.ts`
- Modify: `src/app/lib/api.ts`

**Interfaces:**
- Produces: `mapStockProjectNews`, `mapStockProjectRanking`, `mapStockProjectDailyBar`, `deriveTechnicalDecision`, and `extractSectorCompanies`.

- [ ] Write failing tests with representative Stock Project documents for news, rankings, OHLC data, company extraction, and bullish/bearish/neutral technical decisions.
- [ ] Run `npm test -- src/app/lib/stock-project-mappers.test.ts` and confirm missing-export failures.
- [ ] Replace retired raw types with Stock Project response/document types and implement the pure mappers.
- [ ] Run the targeted tests and confirm all cases pass.

### Task 2: Endpoint Adapter and Workspace Integration

**Files:**
- Modify: `src/app/lib/api.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/components/TerminalHeader.tsx`
- Modify: `src/app/features/decision/DecisionPanel.tsx`
- Modify: `src/app/components/MarketAnalysis.tsx`

**Interfaces:**
- Consumes: the pure mappers from Task 1.
- Produces: Stock Project-backed `getNews`, `getMarketOverview`, `getPreopenAnalysis`, `getSectorTrend`, `getNewsHeatmap`, and `getSectorStocks`.

- [ ] Point news to `/api/v1/news` and map/filter/sort without sending unsupported parameters.
- [ ] Load `/api/v1/stats`, then `/api/v1/stock-daily/{trade_date}` for the real header strip.
- [ ] Point both ranking views to `/api/v1/news-rankings/latest`.
- [ ] Point morning analysis to `/api/v1/morning-analyses/latest`.
- [ ] Resolve sector companies through news, stock lookup, and daily-history requests.
- [ ] Update header and decision copy to describe latest stock data and technical-rule analysis accurately.
- [ ] Remove retired endpoint strings and verify with `rg`.

### Task 3: Regression, Documentation, and Smoke Test

**Files:**
- Modify: `README.md`
- Modify: `.superpowers/mock-stock-api.cjs`

**Interfaces:**
- Produces: documented 8100 integration and a browser-level Stock Project API fixture.

- [ ] Update README with the Stock Project factory command and new endpoint list.
- [ ] Update the smoke API fixture to serve Stock Project response shapes.
- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Render the 1440×1000 decision terminal against the mock Stock Project API and inspect the candlesticks, rankings, linked stocks, and decision panel.

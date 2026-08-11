# Market Analysis Date Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route daily market requests through `latest_trade_date` and default morning-analysis requests through `latest_analysis_date`, falling back only to `/morning-analyses/latest` when the analysis date is absent.

**Architecture:** Keep the existing API wrapper and component tree. Map the date endpoint once in `src/app/lib/api.ts`, split the two values into `App` state, and pass each value only to its existing consumer branch.

**Tech Stack:** React 18, TypeScript, Vitest, Vite 6.

## Global Constraints

- Do not add a historical date selector.
- Do not change the UI layout, component hierarchy, or request library.
- Never use `latest_trade_date` as a fallback morning-analysis date.
- Keep all daily-market, stock-history `end_date`, ranking, news, and intraday consumers on `latest_trade_date`.
- Use TDD: observe each new regression test fail before production changes.

---

### Task 1: Separate API Date Contracts and Morning Routes

**Files:**
- Modify: `src/app/lib/api.ts`
- Modify: `src/app/lib/api-trade-date.test.ts`

**Interfaces:**
- Produces: `LatestMarketDatePayload` with `latest_trade_date: string | null` and `latest_analysis_date: string | null`.
- Produces: `LatestMarketDates` with `marketTradeDate: string | null` and `analysisDate: string | null`.
- Produces: `getLatestMarketDates(): Promise<LatestMarketDates>`.
- Produces: `getPreopenAnalysis(analysisDate: string | null): Promise<PreopenAnalysisResponse>`.

- [ ] **Step 1: Write failing request-contract tests**

Add literal URL assertions for the split-date scenario, the null-analysis scenario, and a historical explicit date:

```ts
const dates = await getLatestMarketDates();
await Promise.all([
  getPreopenAnalysis(dates.analysisDate),
  getMarketOverview(dates.marketTradeDate!),
]);

expect(requests).toContain('/backend-api/api/v1/morning-analyses/2026-08-11');
expect(requests).toContain(
  '/backend-api/api/v1/stock-daily/2026-08-10?page=1&page_size=5&adjust=qfq&sort_by=pct_chg&sort_order=desc',
);
```

For `latest_analysis_date: null`, assert the only morning URL is `/backend-api/api/v1/morning-analyses/latest`. Separately call `getPreopenAnalysis('2026-08-01')` and assert the explicit path.

- [ ] **Step 2: Run the API tests and verify RED**

Run: `npm test -- src/app/lib/api-trade-date.test.ts`

Expected: FAIL because `getLatestMarketDates` does not exist and null currently cannot choose `/latest`.

- [ ] **Step 3: Implement minimal API mapping and routing**

Replace the string-only date resolver with:

```ts
export interface LatestMarketDates {
  marketTradeDate: string | null;
  analysisDate: string | null;
}

export async function getLatestMarketDates(): Promise<LatestMarketDates> {
  const response = await requestJson<RawLatestTradeDateResponse>(
    '/api/v1/market/latest-trade-date',
  );
  return {
    marketTradeDate: normalizeDate(response.data?.latest_trade_date),
    analysisDate: normalizeDate(response.data?.latest_analysis_date),
  };
}
```

Choose the morning path only from the function argument:

```ts
const requestedAnalysisDate = analysisDate?.trim();
const path = requestedAnalysisDate
  ? `/api/v1/morning-analyses/${encodeURIComponent(requestedAnalysisDate)}`
  : '/api/v1/morning-analyses/latest';
```

Expose `analysisDate` on `PreopenAnalysisResponse` and map it from `raw.analysis_date`; never substitute `raw.trade_date` for this display value.

- [ ] **Step 4: Run the focused API tests and verify GREEN**

Run: `npm test -- src/app/lib/api-trade-date.test.ts`

Expected: all API trade-date tests pass with literal URL assertions.

### Task 2: Split App State and Component Props

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/features/market/MarketInsightsView.tsx`
- Modify: `src/app/features/market/MarketInsightsView.test.tsx`
- Modify: `src/app/components/MarketAnalysis.tsx`
- Modify: `src/app/components/MarketAnalysis.test.tsx`
- Modify: `src/app/components/TerminalHeader.tsx`
- Modify: `src/app/components/TerminalHeader.test.tsx`

**Interfaces:**
- `App` owns `marketTradeDate: string | undefined` and `analysisDate: string | null`.
- `MarketInsightsView` consumes both dates but passes `analysisDate` only to `MarketAnalysis` and `marketTradeDate` only to ranking components.
- `MarketAnalysis` consumes `analysisDate: string | null`.

- [ ] **Step 1: Write failing state-routing tests**

In `App.test.tsx`, return:

```ts
{
  marketTradeDate: '2026-08-10',
  analysisDate: '2026-08-11',
}
```

Make child test doubles render their received props and assert that the decision workspace receives `2026-08-10`, while the market view receives both `marketTradeDate=2026-08-10` and `analysisDate=2026-08-11`. Add the null-analysis case and assert `analysisDate` remains null rather than becoming `2026-08-10`.

In `MarketAnalysis.test.tsx`, spy on `getPreopenAnalysis`, render with `analysisDate="2026-08-11"`, and assert the component passes exactly that value. Rerender with `analysisDate="2026-08-01"` to cover the existing explicit-date prop contract.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm test -- src/app/App.test.tsx src/app/features/market/MarketInsightsView.test.tsx src/app/components/MarketAnalysis.test.tsx src/app/components/TerminalHeader.test.tsx`

Expected: FAIL because the component tree still has a single `tradeDate`/`preferredTradeDate` path and ambiguous labels.

- [ ] **Step 3: Implement the minimal state and prop split**

In `App`, call `getLatestMarketDates()` once, store both returned values, and keep the existing non-creator gate based only on `marketTradeDate`. Pass `marketTradeDate` to daily-market consumers and `analysisDate` only into the market-analysis branch.

In `MarketInsightsView`, use:

```tsx
<MarketAnalysis analysisDate={analysisDate} />
<SectorTrend bizDate={marketTradeDate} ... />
<NewsHeatmap bizDate={marketTradeDate} ... />
```

In `MarketAnalysis`, request with `getPreopenAnalysis(analysisDate)`, display `analysis?.analysisDate`, remove the incorrect comparison with the market trade date, and keep the existing details and loading states.

Change only visible labels needed for disambiguation: “盘前分析日期” in the analysis card and “行情数据日期” in the header.

- [ ] **Step 4: Run focused component tests and verify GREEN**

Run: `npm test -- src/app/App.test.tsx src/app/features/market/MarketInsightsView.test.tsx src/app/components/MarketAnalysis.test.tsx src/app/components/TerminalHeader.test.tsx`

Expected: all focused component tests pass.

### Task 3: Documentation and Full Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents: split latest-date semantics and both morning-analysis URL forms.

- [ ] **Step 1: Update only stale date-contract documentation**

Replace the README statement that one global trading date controls morning analysis. Document `latest_trade_date` for daily market data, `latest_analysis_date` for the default dated morning report, and `/morning-analyses/latest` only when the latter is absent.

- [ ] **Step 2: Run complete unit tests**

Run: `npm test`

Expected: 0 failed files and 0 failed tests.

- [ ] **Step 3: Run independent TypeScript checking**

Run: `npx tsc --noEmit --jsx react-jsx --lib ES2023,DOM,DOM.Iterable --module ESNext --moduleResolution bundler --target ES2022 --skipLibCheck src/main.tsx`

Expected: exit code 0 and no TypeScript diagnostics.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: exit code 0 with Vite production output.

- [ ] **Step 5: Check repository hygiene and requirement coverage**

Run: `git diff --check` and `git status --short`.

Review the final diff to confirm no selector, dependency, global store, request-library change, or unrelated UI refactor was added.

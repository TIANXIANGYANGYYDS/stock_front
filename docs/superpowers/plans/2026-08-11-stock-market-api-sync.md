# Latest Stock Market API Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate realtime stock snapshots from intraday K-lines and connect each terminal surface to the correct latest backend endpoint with lifecycle-safe polling.

**Architecture:** Keep `src/app/lib/api.ts` as the only transport and mapping boundary, split its mixed realtime type into snapshot and intraday domains, and reuse the existing serial polling hook. `DecisionWorkspace` coordinates batch quotes, the selected quote, and intraday data while chart components remain request-free.

**Tech Stack:** React 18, TypeScript, Vitest, Vite 6, lightweight-charts 5, CSS.

## Global Constraints

- Do not modify the backend or hardcode a new backend address.
- Continue using `VITE_API_BASE_URL` and the existing `/backend-api` development proxy.
- Stock realtime responses contain `price` but no previous close, change, or change percent; never synthesize those fields.
- Intraday horizontal time must come only from `timestamp`.
- A-share rise is red, fall is green, and flat or unknown direction is neutral.
- Preserve the last successful response after 503 or network failure.
- Pause polling while hidden, refresh when visible or focused, prevent overlapping requests, and abort on query change or unmount.
- Use explicit TypeScript types and no `any`.
- Do not redesign unrelated views or introduce a global state/query dependency.

---

### Task 1: Split API Contracts and Requests

**Files:**
- Modify: `src/app/lib/api.ts`
- Modify: `src/app/lib/realtime-api.test.ts`

**Interfaces:**
- Produces: `IntradayInterval`, `StockRealtimeQuote`, `StockRealtimeResponse`, `StockIntradayBar`, `StockIntradayResponse`.
- Produces: `getRealtimeStocks(codes: string[], signal?: AbortSignal): Promise<StockRealtimeResponse>`.
- Produces: `getRealtimeStock(code: string, signal?: AbortSignal): Promise<StockRealtimeResponse>`.
- Produces: `getStockIntraday(code: string, tradeDate: string, interval: IntradayInterval, signal?: AbortSignal): Promise<StockIntradayResponse>`.

- [ ] **Step 1: Replace mixed-contract expectations with failing domain tests**

Add fixtures proving that snapshot mapping returns only `price/volume/amount/sourceTime/receivedAt`, intraday mapping returns OHLC plus `timestamp`, realtime URLs contain no `interval`, and intraday URLs contain encoded `trade_date` and `interval`.

```ts
expect(mapStockRealtimeQuote(rawSnapshot)).toEqual({
  code: '600519', name: '贵州茅台', market: 'SH', price: 1346.48,
  volume: 1513900, amount: 2036498613,
  sourceTime: '2026-08-11T10:00:00+08:00',
  receivedAt: '2026-08-11T10:00:01+08:00', provider: 'tencent',
});
expect(mapStockIntradayBar(rawBar, '1m')).toMatchObject({
  code: '600519', interval: '1m',
  timestamp: '2026-08-11T09:30:00+08:00',
  open: 1346.26, high: 1346.26, low: 1340, close: 1340,
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/app/lib/realtime-api.test.ts`

Expected: FAIL because the separate types, mappers, and intraday request do not exist and realtime still sends `interval`.

- [ ] **Step 3: Implement the minimal split mapping and requests**

Remove the combined `RealtimeStockQuote`/`RealtimeStocksResponse` contract and implement the interfaces above. Validate interval using the union at compile time, map unknown numeric fields through `toNullableNumber`, derive intraday `count` from the response count when finite and otherwise from mapped items, and use the existing `requestJson` plus AbortSignal.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/app/lib/realtime-api.test.ts`

Expected: all tests in the file pass, including 503 status exposure.

- [ ] **Step 5: Commit the API contract task**

```bash
git add src/app/lib/api.ts src/app/lib/realtime-api.test.ts
git commit -m "feat: split realtime and intraday stock contracts"
```

### Task 2: Update Pure Presentation Rules and Polling Semantics

**Files:**
- Modify: `src/app/lib/realtime-format.ts`
- Modify: `src/app/lib/realtime-format.test.ts`
- Modify: `src/app/hooks/useRealtimePolling.ts`
- Modify: `src/app/hooks/useRealtimePolling.test.tsx`

**Interfaces:**
- Consumes: `StockRealtimeQuote`, `StockIntradayBar`, and `StockListItem` from Task 1.
- Produces: `mergeRealtimeStockItems(dailyItems, realtimeItems)` using snapshot `price` only.
- Produces: `selectRealtimeStockQuote(items, code)` using the latest source/received timestamp.
- Produces: `selectIntradayBars(items, code, tradeDate, interval)` using `timestamp` for validation, deduplication, and sorting.

- [ ] **Step 1: Write failing pure-function and polling tests**

Cover finite snapshot price merge, preservation of daily percentage, latest snapshot selection, invalid/mismatched intraday items, duplicate timestamps, and a `marketStatus: 'stale'` polling response scheduling the next request.

```ts
expect(mergeRealtimeStockItems(daily, [snapshot])[0]).toMatchObject({
  close: 1346.48,
  changePercent: 1.2,
});
expect(selectIntradayBars(items, '600519', '2026-08-11', '5m'))
  .toEqual([earlierFiveMinuteBar, laterFiveMinuteBar]);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/app/lib/realtime-format.test.ts src/app/hooks/useRealtimePolling.test.tsx`

Expected: FAIL because helpers still consume the mixed type and `stale` currently stops polling.

- [ ] **Step 3: Implement snapshot/intraday helpers and closed-only stop**

Make snapshot merge use only finite `price` and `amount`; keep daily fields for missing quotes. Filter intraday bars by code, response trade date, interval, finite OHLC, and parsable `timestamp`; keep the last duplicate and sort ascending. In the polling hook, schedule after every successful state except exact `closed`; keep the existing retry, visibility, focus, coalescing, and abort behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/app/lib/realtime-format.test.ts src/app/hooks/useRealtimePolling.test.tsx`

Expected: all focused tests pass.

- [ ] **Step 5: Commit the pure logic task**

```bash
git add src/app/lib/realtime-format.ts src/app/lib/realtime-format.test.ts src/app/hooks/useRealtimePolling.ts src/app/hooks/useRealtimePolling.test.tsx
git commit -m "fix: poll delayed markets and separate quote formatting"
```

### Task 3: Add Domain Hooks and Workspace Coordination

**Files:**
- Modify: `src/app/hooks/useRealtimeQuotes.ts`
- Modify: `src/app/hooks/useRealtimeQuotes.test.tsx`
- Modify: `src/app/features/decision/DecisionWorkspace.tsx`
- Modify: `src/app/features/decision/DecisionWorkspace.test.tsx`

**Interfaces:**
- Consumes: Task 1 API functions and Task 2 formatting helpers.
- Produces: `useRealtimeStocks(codes: string[])`, `useRealtimeStock(code: string)`, and `useStockIntraday(options)`.
- Produces: workspace props that pass `realtimeData` and `intradayData` separately to the chart.

- [ ] **Step 1: Write failing hook and workspace tests**

Test that batch codes normalize and call `getRealtimeStocks(codes, signal)`, single stock calls `getRealtimeStock(code, signal)`, and intraday calls `getStockIntraday(code, tradeDate, interval, signal)` only while enabled. In the workspace test, assert the selected snapshot and intraday response reach separate chart props and missing codes reach the navigator.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/app/hooks/useRealtimeQuotes.test.tsx src/app/features/decision/DecisionWorkspace.test.tsx`

Expected: FAIL because old hook signatures still contain interval and no intraday hook exists.

- [ ] **Step 3: Implement thin hooks and controlled chart query state**

Use 5-second intervals for indices and snapshots and 30 seconds for intraday. Keep `chartMode` and `intradayInterval` in `DecisionWorkspace`; enable intraday only when mode is `intraday`. Use the selected snapshot market status as intraday scheduling status, defaulting to `open` until the first snapshot response. Pass batch delayed/error/missing state to `StockNavigator` and separate snapshot/intraday props to `ProfessionalCandlestickChart`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/app/hooks/useRealtimeQuotes.test.tsx src/app/features/decision/DecisionWorkspace.test.tsx`

Expected: all focused tests pass and old response identities cannot reach a newly selected stock.

- [ ] **Step 5: Commit the orchestration task**

```bash
git add src/app/hooks/useRealtimeQuotes.ts src/app/hooks/useRealtimeQuotes.test.tsx src/app/features/decision/DecisionWorkspace.tsx src/app/features/decision/DecisionWorkspace.test.tsx
git commit -m "feat: coordinate realtime prices and intraday data"
```

### Task 4: Update Header, Navigator, and Chart Interaction

**Files:**
- Modify: `src/app/components/TerminalHeader.tsx`
- Modify: `src/app/components/TerminalHeader.test.tsx`
- Modify: `src/app/features/decision/StockNavigator.tsx`
- Modify: `src/app/features/decision/StockNavigator.test.tsx`
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx`
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.test.tsx`
- Modify: `src/app/features/chart/IntradayCandlestickChart.tsx`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Consumes: separate `StockRealtimeResponse` and `StockIntradayResponse` from Task 1.
- Consumes: query state callbacks from Task 3.
- Produces: current-price display, missing/delayed row state, six intraday interval controls, and timestamp-based chart data.

- [ ] **Step 1: Write failing component behavior tests**

Cover backend stale index status, flat tone, realtime price at the latest daily bar, historical crosshair precedence, realtime missing state, intraday data rendering, interval button callbacks, and loading/empty/delayed/closed messages.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/app/components/TerminalHeader.test.tsx src/app/features/decision/StockNavigator.test.tsx src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

Expected: FAIL because current components still accept the combined response and have no interval controls.

- [ ] **Step 3: Implement the minimal UI changes**

Treat `stale` as delayed in the header while preserving quotes. In the navigator, mark codes from `missingCodes` as daily fallback without clearing price. In the professional chart, use snapshot `price` only at the current/latest position, keep history authoritative under the crosshair, expose six interval buttons in intraday mode, and pass only `StockIntradayBar[]` to `IntradayCandlestickChart`. Keep candle red/green based on bar close versus open and keep realtime-only unknown direction neutral or tied explicitly to displayed daily percentage.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/app/components/TerminalHeader.test.tsx src/app/features/decision/StockNavigator.test.tsx src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

Expected: all focused component tests pass.

- [ ] **Step 5: Commit the UI task**

```bash
git add src/app/components/TerminalHeader.tsx src/app/components/TerminalHeader.test.tsx src/app/features/decision/StockNavigator.tsx src/app/features/decision/StockNavigator.test.tsx src/app/features/chart/ProfessionalCandlestickChart.tsx src/app/features/chart/ProfessionalCandlestickChart.test.tsx src/app/features/chart/IntradayCandlestickChart.tsx src/styles/terminal.css
git commit -m "feat: display realtime prices and true intraday charts"
```

### Task 5: Documentation and End-to-End Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents: correct endpoint mapping, polling behavior, proxy configuration, and available validation scripts.

- [ ] **Step 1: Update README contract statements**

Document the intraday endpoint and six intervals, state that realtime is price-only, and state the 5-second snapshot/30-second active intraday/closed-stop behavior without changing proxy configuration.

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test`

Expected: 0 failed test files and 0 failed tests.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit code 0 with Vite output in `dist`.

- [ ] **Step 4: Run real proxy integration checks**

Start `npm run dev`, then request these through `http://localhost:5188/backend-api`:

```text
/api/v1/market/indices/realtime
/api/v1/stocks/600519/intraday?trade_date=2026-08-11&interval=1m
/api/v1/stocks/600519/realtime
/api/v1/stocks/realtime?codes=600519,000001
```

Expected: HTTP 200 from the configured backend proxy, realtime items containing `price`, and intraday items containing valid `timestamp` plus OHLC.

- [ ] **Step 5: Check responsive layouts and repository hygiene**

Inspect 1440px, 1024px, and 390px widths for the header strip, chart price row, interval controls, and empty/delayed states. Run `git diff --check`, `git status --short`, and `rg -n "\bany\b|39\.106\.202\.228:8100|127\.0\.0\.1:8100" src` to confirm no whitespace errors, new `any`, or new hardcoded backend address in source.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md
git commit -m "docs: document latest market data endpoints"
```

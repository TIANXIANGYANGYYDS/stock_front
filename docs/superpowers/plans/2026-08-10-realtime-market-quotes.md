# 实时大盘指数与个股行情实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用现有 API_BASE_URL 接入五个大盘指数、批量个股和单只个股实时行情，并提供符合开闭市、可见性和错误保留要求的 5 秒轮询。

**Architecture:** `api.ts` 继续作为唯一后端适配层，纯函数负责时间、顺序和个股字段合并。一个通用 `useRealtimePolling` 管理请求互斥、定时器、焦点、可见性、取消和旧数据保留，三个薄 hooks 分别服务顶部指数、股票列表和当前个股。现有组件只消费稳定类型和显式状态，不解析后端原始结构。

**Tech Stack:** React 18、TypeScript、Vite、Vitest、jsdom、现有 CSS 终端视觉系统、浏览器 Fetch/AbortController/Visibility API。

## Global Constraints

- 所有请求通过 `src/app/lib/api.ts` 的现有 `API_BASE_URL`，不得硬编码域名或端口。
- 不修改后端接口或 Vite 代理行为。
- 个股当前价格只使用实时响应 `close`；不得推算不存在的 `previous_close`、`change` 或 `change_pct`。
- 个股涨跌幅继续使用现有日线来源。
- `market_status=open` 时每 5 秒串行刷新；`closed` 时停止定时刷新。
- 页面隐藏时暂停，恢复可见或窗口聚焦时立即请求。
- 禁止重叠请求；卸载、查询变化和页面隐藏时中止旧请求。
- 刷新失败必须保留同一查询最后一次成功数据。
- 不保存前端行情历史，不使用生产 mock，不新增第三方依赖，不使用 `any`。
- 时间统一按 `Asia/Shanghai` 格式化为 `HH:mm:ss`。
- 保持现有工作区、日 K、指标、筹码和响应式设计行为。

---

## File Structure

- Modify: `src/app/lib/api.ts` — realtime 原始/稳定类型、映射器、请求函数、AbortSignal 和带状态错误。
- Create: `src/app/lib/realtime-api.test.ts` — 指数和个股响应/请求契约。
- Create: `src/app/lib/realtime-format.ts` — 上海时间、指数排序/色调和个股列表合并。
- Create: `src/app/lib/realtime-format.test.ts` — 纯函数规则。
- Create: `src/app/hooks/useRealtimePolling.ts` — 通用实时轮询状态机。
- Create: `src/app/hooks/useRealtimePolling.test.tsx` — 定时、焦点、可见性、并发、取消和错误保留。
- Create: `src/app/hooks/useRealtimeQuotes.ts` — 三个业务薄 hooks。
- Create: `src/app/hooks/useRealtimeQuotes.test.tsx` — query key、批量代码和禁用规则。
- Modify: `src/app/App.tsx`、`src/app/App.test.tsx` — 全局指数轮询和日期门禁隔离。
- Modify: `src/app/components/TerminalHeader.tsx`、对应测试 — 五指数真实行情。
- Modify: `src/app/features/decision/DecisionWorkspace.tsx` — 批量/单只行情协调。
- Create: `src/app/features/decision/DecisionWorkspace.test.tsx` — 报价合并和 selected code 协调。
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx`、对应测试 — 最新实时价与历史十字光标优先级。
- Modify: `src/app/features/decision/DecisionPanel.tsx`、对应测试 — 实时 1m 快照。
- Modify: `src/styles/terminal.css` — 指数、延迟、闭市、实时快照和小屏样式。
- Modify: `README.md` — 接口、轮询规则和配置说明。

---

### Task 1: Realtime API contracts and request functions

**Files:**
- Modify: `src/app/lib/api.ts`
- Create: `src/app/lib/realtime-api.test.ts`

**Interfaces:**
- Produces: `ApiRequestError`, `MarketIndexQuote`, `RealtimeMarketIndicesResponse`, `RealtimeStockQuote`, `RealtimeStocksResponse`.
- Produces: `mapRealtimeMarketIndex`, `mapRealtimeStockQuote`, `getRealtimeMarketIndices`, `getRealtimeStocks`, `getRealtimeStock`.
- Changes: `requestJson<T>(path, params?, options?)` accepts `{ signal?: AbortSignal }` without changing existing callers.

- [ ] **Step 1: Write failing mapping tests**

Create fixtures with numeric strings, null values and unknown statuses. Assert no missing value becomes zero and stock mappings expose no fabricated change fields.

```ts
it('maps realtime index and stock payloads without inventing values', () => {
  expect(mapRealtimeMarketIndex({
    symbol: '000001.SH', name: '上证指数', price: '3966.59',
    change: 26.55, change_pct: 0.67, previous_close: null,
  })).toMatchObject({
    symbol: '000001.SH', price: 3966.59, change: 26.55,
    changePercent: 0.67, previousClose: null,
  });
  expect(mapRealtimeStockQuote({
    code: '600519', close: '1348.86', timestamp: '2026-08-10T09:31:00+08:00',
  })).toMatchObject({ code: '600519', close: 1348.86 });
});
```

- [ ] **Step 2: Run the mapper test and verify RED**

Run: `npm test -- --run src/app/lib/realtime-api.test.ts`

Expected: FAIL because realtime types and mappers do not exist.

- [ ] **Step 3: Add raw and stable types plus defensive mappers**

Implement exact stable fields from the design. Use existing `toText`, `toNullableNumber`, `toNumber` and array guards. Define raw fields as `unknown` or precise optional unions; do not use `any`.

```ts
export interface RealtimeStockQuote {
  code: string;
  name: string;
  market: string;
  tradeDate: string;
  interval: string;
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  amount: number | null;
  provider: string;
}
```

- [ ] **Step 4: Write failing request contract tests**

Stub `fetch` and assert:

```ts
await getRealtimeMarketIndices(signal);
await getRealtimeStocks(['600519', '000001', '600519'], '1m', signal);
await getRealtimeStock('600519/path', '1m', signal);

expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/market/indices/realtime');
expect(String(fetchMock.mock.calls[1][0])).toContain('codes=600519%2C000001');
expect(String(fetchMock.mock.calls[2][0])).toContain('/stocks/600519%2Fpath/realtime');
expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal });
```

Also assert a 503 rejects with `ApiRequestError` containing `status === 503`.

- [ ] **Step 5: Extend requestJson and implement the three requests**

```ts
export class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions { signal?: AbortSignal }

async function requestJson<T>(path: string, params?: Record<string, QueryValue>, options: RequestOptions = {}) {
  const response = await fetch(`${API_BASE_URL}${path}${buildQuery(params)}`, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });
  // Preserve current detail parsing, but throw ApiRequestError for non-2xx.
}
```

Unwrap `response.data`, map items, preserve `market_status`, `missing_codes`, pagination-independent arrays and nullable numbers.

- [ ] **Step 6: Run API tests**

Run: `npm test -- --run src/app/lib/realtime-api.test.ts src/app/lib/creator-api.test.ts src/app/lib/api-trade-date.test.ts`

Expected: PASS, proving existing API callers still work after signal support.

- [ ] **Step 7: Commit the API increment**

```bash
git add src/app/lib/api.ts src/app/lib/realtime-api.test.ts
git commit -m "feat: add realtime quote API adapter"
```

---

### Task 2: Realtime formatting and merge rules

**Files:**
- Create: `src/app/lib/realtime-format.ts`
- Create: `src/app/lib/realtime-format.test.ts`

**Interfaces:**
- Consumes: `MarketIndexQuote`, `RealtimeStockQuote`, `StockListItem`.
- Produces: `formatShanghaiTime`, `marketStatusLabel`, `quoteTone`, `orderMarketIndices`, `mergeRealtimeStockItems`.

- [ ] **Step 1: Write failing pure-function tests**

```ts
it('formats timestamps in Asia/Shanghai', () => {
  expect(formatShanghaiTime('2026-08-10T01:30:05Z')).toBe('09:30:05');
  expect(formatShanghaiTime('bad')).toBe('--:--:--');
});

it('only overwrites fields present in realtime stock quotes', () => {
  const merged = mergeRealtimeStockItems(
    [{ code: '600519', name: '贵州茅台', close: 1300, changePercent: 1.2, amount: 10 }],
    [{ code: '600519', close: 1348.86, amount: null }],
  );
  expect(merged[0]).toMatchObject({ close: 1348.86, changePercent: 1.2, amount: 10 });
});
```

Test index order when input is shuffled, missing canonical items, positive/negative/zero/null tone, and open/closed/unknown labels.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/app/lib/realtime-format.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure helpers**

Use a module constant for the five canonical symbols. Use `Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })`. Normalize a possible `24:` prefix to `00:`. Merge stock items by code and only overwrite with finite, non-null realtime values.

- [ ] **Step 4: Run pure-function tests**

Run: `npm test -- --run src/app/lib/realtime-format.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit formatting rules**

```bash
git add src/app/lib/realtime-format.ts src/app/lib/realtime-format.test.ts
git commit -m "feat: add realtime quote display rules"
```

---

### Task 3: Generic non-overlapping realtime polling hook

**Files:**
- Create: `src/app/hooks/useRealtimePolling.ts`
- Create: `src/app/hooks/useRealtimePolling.test.tsx`

**Interfaces:**
- Produces: `RealtimePollingState<T>` and `useRealtimePolling<T>(options)`.

```ts
export interface RealtimePollingOptions<T> {
  enabled?: boolean;
  queryKey: string;
  request: (signal: AbortSignal) => Promise<T>;
  getMarketStatus: (data: T) => string;
  intervalMs?: number;
}

export interface RealtimePollingState<T> {
  data: T | null;
  initialLoading: boolean;
  refreshing: boolean;
  delayed: boolean;
  error: string | null;
  marketStatus: string;
  lastSuccessAt: number | null;
  refresh: () => void;
}
```

- [ ] **Step 1: Build a minimal jsdom hook harness and failing immediate/open tests**

Render a component that records each state to a callback. Use `vi.useFakeTimers()`. Resolve first response with `marketStatus: 'open'`; advance 4999ms and assert one call, then 1ms and assert two calls.

- [ ] **Step 2: Run the first polling tests and verify RED**

Run: `npm test -- --run src/app/hooks/useRealtimePolling.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement immediate request and serial timeout scheduling**

Use refs for mounted state, request function, active controller, timeout ID, in-flight flag and one queued refresh boolean. Do not list the request function itself as the lifecycle dependency; update a request ref each render and reset by stable `queryKey`.

- [ ] **Step 4: Add failing closed, hidden, focus and restore tests**

Tests must assert:

- a closed success never schedules another timed request;
- setting `document.visibilityState` to hidden clears polling and aborts in-flight work;
- restoring visible requests immediately;
- dispatching `window.focus` requests immediately, including after a closed response.

- [ ] **Step 5: Implement visibility and focus lifecycle**

Register `visibilitychange` on `document` and `focus` on `window`. A hidden transition cancels timer and controller. Visible/focus calls `refresh`; if in flight, set one queue flag.

- [ ] **Step 6: Add failing concurrency, error retention and unmount tests**

Use deferred promises to prove two timer/focus events during one request do not increment the request count until it resolves, and then increment only once. Resolve once, reject the next request with 503/network error, and assert `data` is unchanged, `delayed` true, and error copy differs for first-load versus stale-data cases. Assert unmount observes `signal.aborted === true` and AbortError does not set delayed.

- [ ] **Step 7: Implement queued refresh, stale retention and abort handling**

On successful completion replace `data`, clear delayed/error, update status/time, then schedule only when status is open. On non-Abort failure keep data and schedule a retry only when the last successful status is open or no success exists. On queryKey change clear query-specific data and abort the old controller.

- [ ] **Step 8: Run polling tests**

Run: `npm test -- --run src/app/hooks/useRealtimePolling.test.tsx`

Expected: PASS with no act warnings or leaked timers.

- [ ] **Step 9: Commit the polling hook**

```bash
git add src/app/hooks/useRealtimePolling.ts src/app/hooks/useRealtimePolling.test.tsx
git commit -m "feat: add visibility-aware realtime polling"
```

---

### Task 4: Domain-specific quote hooks

**Files:**
- Create: `src/app/hooks/useRealtimeQuotes.ts`
- Create: `src/app/hooks/useRealtimeQuotes.test.tsx`

**Interfaces:**
- Consumes: Task 1 API functions and Task 3 `useRealtimePolling`.
- Produces: `useRealtimeMarketIndices()`, `useRealtimeStocks(codes, interval?)`, `useRealtimeStock(code, interval?)`.

- [ ] **Step 1: Write failing thin-hook tests**

Mock API functions and the generic hook. Assert canonical query keys:

```ts
expect(useRealtimePollingMock).toHaveBeenCalledWith(expect.objectContaining({
  enabled: true,
  queryKey: 'stocks:1m:000001,600519',
}));
```

Assert duplicate/empty codes normalize and sort, empty batch and empty single code set `enabled: false`, and request callbacks forward `AbortSignal` plus interval.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/app/hooks/useRealtimeQuotes.test.tsx`

Expected: FAIL because domain hooks do not exist.

- [ ] **Step 3: Implement the three thin hooks**

Normalize codes with trim/filter/deduplicate/sort. Use constant 5000ms. Use each stable response's `marketStatus` getter. Return the generic hook state unchanged.

- [ ] **Step 4: Run thin-hook and polling tests**

Run: `npm test -- --run src/app/hooks/useRealtimeQuotes.test.tsx src/app/hooks/useRealtimePolling.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit domain hooks**

```bash
git add src/app/hooks/useRealtimeQuotes.ts src/app/hooks/useRealtimeQuotes.test.tsx
git commit -m "feat: add realtime market quote hooks"
```

---

### Task 5: Replace the reserved index strip with live data

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/components/TerminalHeader.tsx`
- Modify: `src/app/components/TerminalHeader.test.tsx`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Consumes: `useRealtimeMarketIndices`, `orderMarketIndices`, `quoteTone`, `formatShanghaiTime`.
- Changes TerminalHeader props: add `realtimeIndices`, `indicesLoading`, `indicesDelayed`, `indicesError`; stop using latest-trade-date errors as the index connection state.

- [ ] **Step 1: Write failing header rendering tests**

Render shuffled positive, negative, flat and missing index fixtures. Assert fixed order, numeric values, `+26.55`, `+0.67%`, rise/fall/flat classes, Shanghai update time, closed label, delayed label and missing item state. Preserve the existing creator navigation test.

- [ ] **Step 2: Write failing App isolation test**

Mock `useRealtimeMarketIndices` and keep `getLatestTradeDate` pending. Assert TerminalHeader already receives and renders realtime index data before the date gate resolves.

- [ ] **Step 3: Run header/App tests and verify RED**

Run: `npm test -- --run src/app/components/TerminalHeader.test.tsx src/app/App.test.tsx`

Expected: FAIL because the header still renders placeholders.

- [ ] **Step 4: Wire index state through App**

Call `useRealtimeMarketIndices()` unconditionally at the top App level. Keep latest-trade-date state exclusively for decision/market/news gates. Pass response and status props to TerminalHeader.

- [ ] **Step 5: Render all index states**

Use `orderMarketIndices` and format nullable numbers as `--`. Apply `market-rise`, `market-fall` or a new neutral class to price and changes. Render existing skeleton only when `initialLoading && !data`; otherwise preserve live items during refresh/error.

- [ ] **Step 6: Add responsive/index status CSS**

Keep five desktop columns and horizontal mobile scroll. Add `.index-ticker.is-flat`, `.index-delay-state`, nowrap/ellipsis and missing-item styles. Do not change unrelated header geometry.

- [ ] **Step 7: Run header/App tests**

Run: `npm test -- --run src/app/components/TerminalHeader.test.tsx src/app/App.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit the index integration**

```bash
git add src/app/App.tsx src/app/App.test.tsx src/app/components/TerminalHeader.tsx src/app/components/TerminalHeader.test.tsx src/styles/terminal.css
git commit -m "feat: show realtime market indices"
```

---

### Task 6: Merge batch realtime quotes into the stock navigator

**Files:**
- Modify: `src/app/features/decision/DecisionWorkspace.tsx`
- Create: `src/app/features/decision/DecisionWorkspace.test.tsx`

**Interfaces:**
- Consumes: `useRealtimeStocks`, `useRealtimeStock`, `mergeRealtimeStockItems`.
- Produces: merged `StockListItem[]` for `StockNavigator` and current realtime state props for later chart/panel work.

- [ ] **Step 1: Write failing workspace coordination tests**

Mock list/detail APIs and quote hooks. Assert the batch hook receives all displayed stock codes, `StockNavigator` receives realtime `close` but original `changePercent`, selected code is passed to the single hook, and a missing quote keeps the daily list item.

- [ ] **Step 2: Run workspace tests and verify RED**

Run: `npm test -- --run src/app/features/decision/DecisionWorkspace.test.tsx`

Expected: FAIL because DecisionWorkspace does not call realtime hooks.

- [ ] **Step 3: Add batch and single quote coordination**

Derive codes from `stockItems`, call both hooks unconditionally with enabled behavior inside the hooks, memoize merged items, find the selected realtime quote by exact code, and pass explicit quote/status/loading/delayed props down. Do not replace `selectedStock` or its K-line data.

- [ ] **Step 4: Run workspace tests**

Run: `npm test -- --run src/app/features/decision/DecisionWorkspace.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit workspace coordination**

```bash
git add src/app/features/decision/DecisionWorkspace.tsx src/app/features/decision/DecisionWorkspace.test.tsx
git commit -m "feat: merge batch realtime stock quotes"
```

---

### Task 7: Show selected-stock realtime quote in chart and snapshot

**Files:**
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx`
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.test.tsx`
- Modify: `src/app/features/decision/DecisionPanel.tsx`
- Modify: `src/app/features/decision/DecisionPanel.test.tsx`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Adds to both components: `realtimeQuote?: RealtimeStockQuote | null`, `realtimeLoading?: boolean`, `realtimeDelayed?: boolean`, `realtimeMarketStatus?: string`.

- [ ] **Step 1: Write failing chart priority tests**

Render a stock whose latest daily close is 1300 and realtime close is 1348.86. Assert the chart header shows 1348.86 and `实时 1m 09:31:00`. Trigger the existing crosshair callback with an older bar and assert the header returns to that historical close and no longer labels the displayed price realtime. Assert the percentage remains the daily/historical source.

- [ ] **Step 2: Write failing DecisionPanel tests**

Assert the new realtime section displays open/high/low/current price/volume/amount/time and closed/delayed/loading/empty states, while the existing daily close and indicators remain present after realtime failure.

- [ ] **Step 3: Run component tests and verify RED**

Run: `npm test -- --run src/app/features/chart/ProfessionalCandlestickChart.test.tsx src/app/features/decision/DecisionPanel.test.tsx`

Expected: FAIL because realtime props and UI do not exist.

- [ ] **Step 4: Implement chart latest/history priority**

Compare `activeBar.time` with the final normalized bar. Only when they match and realtime close is finite should the main displayed price use realtime close. Keep OHLC legend and percentage from the selected daily bar. Add explicit “日线涨跌” and realtime timestamp/status copy.

- [ ] **Step 5: Implement the realtime snapshot section**

Insert a section before “日线行情”. Use existing number/amount formatters, `formatShanghaiTime`, and `marketStatusLabel`. Never substitute realtime values into the daily snapshot object.

- [ ] **Step 6: Add compact responsive styles**

Reuse `.snapshot-grid`; add realtime source/delayed/closed badges, overflow wrapping and narrow-screen stacking. Keep the existing panel scroll behavior.

- [ ] **Step 7: Run chart/panel/workspace tests**

Run: `npm test -- --run src/app/features/chart/ProfessionalCandlestickChart.test.tsx src/app/features/decision/DecisionPanel.test.tsx src/app/features/decision/DecisionWorkspace.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit selected-stock display**

```bash
git add src/app/features/chart/ProfessionalCandlestickChart.tsx src/app/features/chart/ProfessionalCandlestickChart.test.tsx src/app/features/decision/DecisionPanel.tsx src/app/features/decision/DecisionPanel.test.tsx src/styles/terminal.css
git commit -m "feat: show selected stock realtime quote"
```

---

### Task 8: Documentation, live smoke check and full verification

**Files:**
- Modify: `README.md`
- Test: all files above and the existing suite.

- [ ] **Step 1: Update README**

Add the three realtime endpoint forms, explain the existing `VITE_API_BASE_URL`/proxy configuration, document open/closed polling behavior and state that stock realtime data has no fabricated change fields.

- [ ] **Step 2: Run focused realtime tests**

Run:

```bash
npm test -- --run src/app/lib/realtime-api.test.ts src/app/lib/realtime-format.test.ts src/app/hooks/useRealtimePolling.test.tsx src/app/hooks/useRealtimeQuotes.test.tsx src/app/components/TerminalHeader.test.tsx src/app/App.test.tsx src/app/features/decision/DecisionWorkspace.test.tsx src/app/features/chart/ProfessionalCandlestickChart.test.tsx src/app/features/decision/DecisionPanel.test.tsx
```

Expected: all focused files PASS with no act warnings or unhandled rejections.

- [ ] **Step 3: Run complete regression tests**

Run: `npm test -- --run`

Expected: every test file PASS.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: Vite exits 0 with no TypeScript transform or bundling errors.

- [ ] **Step 5: Record unavailable validation commands honestly**

Confirm `package.json` has no lint/typecheck script, no ESLint/TypeScript dependency and no tsconfig. Report these checks as “未配置”, not “通过”; do not install unrelated tooling.

- [ ] **Step 6: Smoke-test the live read-only endpoints through the configured proxy target**

Use the existing configured backend target only for manual verification:

```powershell
$realtimeBase = 'http://39.106.202.228:8100/api/v1'
Invoke-RestMethod "$realtimeBase/market/indices/realtime"
Invoke-RestMethod "$realtimeBase/stocks/realtime?codes=600519,000001&interval=1m"
Invoke-RestMethod "$realtimeBase/stocks/600519/realtime?interval=1m"
```

This command is a read-only smoke check; application source must not contain `$realtimeBase` or that host.

- [ ] **Step 7: Inspect rendered layouts**

At 1440px verify five index columns and the full realtime snapshot. At 1024px verify horizontal index scrolling and no chart-header collision. At 390px verify no document-level horizontal overflow, long names truncate, and realtime status/price remain readable. Verify delayed state preserves visible values.

- [ ] **Step 8: Inspect final diff**

Run `git diff --check`, `git status --short`, and scan production source for the backend host plus `any`. Confirm only intended realtime files and previously approved workspace changes are present.

- [ ] **Step 9: Commit documentation/integration residue**

```bash
git add README.md src/app src/styles/terminal.css
git commit -m "docs: document realtime quote behavior"
```

Do not push without an explicit user request.

---

## Plan Self-Review

- Spec coverage: API contracts, API_BASE_URL, fixed five-index order, batch/single stock use, close-only current price, old daily percentage, Shanghai time, open/closed polling, focus/visibility lifecycle, request locking, cancellation, stale retention, status UI, responsive behavior, tests and documentation all map to explicit tasks.
- Scope: indices and stocks share one polling subsystem and integrate into one existing terminal, so a single ordered plan is cohesive.
- Type consistency: realtime type, mapper, API, hook and component prop names are identical across tasks.
- Placeholder scan: every implementation step names concrete functions, assertions, commands and expected results; no deferred feature remains.

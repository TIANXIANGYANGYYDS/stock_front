# Frontend Visual Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing application into a cohesive, readable institutional A-share trading desk while preserving the main framework and every business-data field.

**Architecture:** Keep React component ownership, API state, request contracts, and all primary view grids unchanged. Establish one native terminal token layer in `terminal.css`, remove inert header chrome, migrate the legacy market-analysis markup onto terminal classes, then tune each existing view and responsive breakpoint through scoped CSS and minimal semantic hooks.

**Tech Stack:** React 18, TypeScript, Vite 6, Vitest 4, jsdom, Tailwind CSS 4, Lucide React, lightweight-charts, native CSS Grid/Flexbox.

## Global Constraints

- Do not change API contracts, request libraries, date semantics, data state ownership, or data filtering behavior.
- Do not replace the main layout framework or introduce a new UI framework or dependency.
- Do not remove any business data.
- Preserve the two-level global header, all five market indices, and the four existing workspaces.
- Remove only the non-functional global search hint and settings button; preserve connection status.
- Preserve Chinese-market red-rise and green-fall semantics.
- Prefer CSS/token changes and minimal class hooks over component restructuring.
- Use 8 px panel, 6 px control, and 4 px tag radii; reserve pills for statuses and categorical tags.
- Respect `prefers-reduced-motion` and provide consistent keyboard focus visibility.
- Preserve unrelated working-tree changes.

---

## File Structure

- Modify: `src/app/components/TerminalHeader.tsx` — remove inert controls while keeping live connection and index data.
- Modify: `src/app/components/TerminalHeader.test.tsx` — lock functional-header content and removed inert chrome.
- Modify: `src/app/components/MarketAnalysis.tsx` — replace legacy utility skin with semantic terminal classes.
- Modify: `src/app/components/MarketAnalysis.test.tsx` — lock date, content, selection, and native terminal structure.
- Modify: `src/app/features/market/MarketInsightsView.tsx` — remove the legacy skin hook only.
- Modify: `src/app/features/market/MarketInsightsView.test.tsx` — preserve all market sections and date labels.
- Modify: `src/styles/terminal.css` — global tokens, controls, all view styling, responsive rules, focus, and reduced motion.
- Modify: `src/styles/theme.css` — align global scrollbar and base focus behavior with terminal tokens where necessary.
- Create: `.tmp-ui-check/frontend-visual-check.mjs` — local visual regression script for all four views and viewports; remain untracked unless the repo already tracks `.tmp-ui-check`.

---

### Task 1: Lock functional header behavior

**Files:**
- Modify: `src/app/components/TerminalHeader.test.tsx`
- Modify: `src/app/components/TerminalHeader.tsx`

**Interfaces:**
- Consumes: existing `TerminalHeaderProps` and `WorkspaceView`.
- Produces: the same component API with live status and all index telemetry, without non-functional search/settings elements.

- [ ] **Step 1: Write the failing test**

Add a test that renders a populated `TerminalHeader`, confirms all navigation labels, connection copy, trading date, and five expected index names remain, then asserts the inert labels are absent:

```tsx
it('keeps live market telemetry without inert global controls', () => {
  renderHeader({ realtimeIndices: populatedIndices });

  expect(document.body.textContent).toContain('数据在线');
  expect(document.body.textContent).toContain('行情数据日期');
  expect(document.body.textContent).toContain('上证指数');
  expect(document.body.textContent).toContain('沪深300');
  expect(document.body.textContent).not.toContain('股票 / 板块');
  expect(document.querySelector('[aria-label="终端设置"]')).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npx vitest run src/app/components/TerminalHeader.test.tsx`

Expected: FAIL because the search hint and settings button still render.

- [ ] **Step 3: Implement the minimal header change**

Remove `Search` and `Settings` imports and their two JSX nodes. Keep `.terminal-actions` and `.api-state` unchanged so live/delayed/error status remains. Do not change props, index ordering, formatting, or navigation.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `npx vitest run src/app/components/TerminalHeader.test.tsx`

Expected: all header tests PASS.

- [ ] **Step 5: Commit the header increment**

```powershell
git add src/app/components/TerminalHeader.tsx src/app/components/TerminalHeader.test.tsx
git commit -m "refactor: simplify functional terminal header"
```

---

### Task 2: Establish the terminal visual foundation

**Files:**
- Modify: `src/styles/terminal.css:1-418`
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: all existing terminal class names.
- Produces: shared color, radius, spacing, typography, focus, surface, control, scrollbar, and motion rules used by every workspace.

- [ ] **Step 1: Record the current baseline**

Run:

```powershell
rg -n "--terminal-|border-radius|box-shadow|font-size: (8|9|10)px|transition:" src/styles/terminal.css
```

Expected: output shows 14 px panels, multiple nested gradients/glows, and dense 8–10 px text requiring normalization.

- [ ] **Step 2: Replace the token block**

Use this exact token vocabulary at `:root` and update current consumers rather than introducing per-view colors:

```css
:root {
  --terminal-bg: #080f18;
  --terminal-panel: #0d1723;
  --terminal-panel-raised: #111e2c;
  --terminal-panel-soft: #0b1420;
  --terminal-control: #0a131e;
  --terminal-border: rgba(111, 139, 172, 0.20);
  --terminal-border-strong: rgba(121, 153, 190, 0.36);
  --terminal-text: #edf3fb;
  --terminal-text-soft: #c4cfdd;
  --terminal-muted: #8291a6;
  --terminal-faint: #607086;
  --terminal-accent: #31c7ed;
  --terminal-accent-soft: rgba(49, 199, 237, 0.10);
  --terminal-rise: #f05a5a;
  --terminal-fall: #18b98b;
  --terminal-warning: #e9b949;
  --terminal-violet: #a88af4;
  --terminal-radius: 8px;
  --terminal-control-radius: 6px;
  --terminal-tag-radius: 4px;
  --terminal-focus: 0 0 0 2px rgba(49, 199, 237, 0.30);
  --terminal-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}
```

- [ ] **Step 3: Normalize global surfaces and typography**

Change the application background to a flat navy with one subtle top wash, change `.terminal-panel` to a single panel fill plus an inset hairline, apply the 8 px radius, and remove broad panel drop shadows. Keep the brand mark as the only small gradient identity surface. Use the existing system stack, tabular numerals, and `--terminal-mono` for codes/dates/times/value telemetry.

- [ ] **Step 4: Normalize controls and focus states**

Unify inputs, buttons, selects, tab groups, chips, and icon buttons around `--terminal-control`, 6 px controls, 4 px tags, 120–180 ms color/background/border transitions, and no hover translation/scale. Add:

```css
.stock-terminal :where(button, input, select, a):focus-visible {
  outline: 0;
  box-shadow: var(--terminal-focus);
}

@media (prefers-reduced-motion: reduce) {
  .stock-terminal *,
  .stock-terminal *::before,
  .stock-terminal *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Align scrollbar rules**

Replace hard-coded `theme.css` scrollbar colors with terminal-compatible dark values and ensure terminal-local scrollbar selectors remain thinner. Do not change Tailwind tokens or application theme mode behavior.

- [ ] **Step 6: Run focused regression tests**

Run: `npx vitest run src/app/components/TerminalHeader.test.tsx src/app/features/decision/DecisionWorkspace.test.tsx src/app/features/news/NewsIntelligenceView.test.tsx src/app/features/creators/CreatorInsightsView.test.tsx`

Expected: all tests PASS; token-only changes do not alter behavior.

- [ ] **Step 7: Commit the foundation**

```powershell
git add src/styles/terminal.css src/styles/theme.css
git commit -m "style: establish terminal visual foundation"
```

---

### Task 3: Refine the global header and index strip

**Files:**
- Modify: `src/styles/terminal.css:54-333`

**Interfaces:**
- Consumes: header JSX from Task 1 and tokens from Task 2.
- Produces: a compact two-tier header with unchanged telemetry and clearer scan alignment.

- [ ] **Step 1: Update top-bar alignment**

Keep the current 58 px top bar and 54 px index strip. Change desktop columns to `240px minmax(430px, 1fr) auto`, reduce navigation glow to a 2 px accent line plus flat active tint, make `.terminal-actions` status-only, and ensure nav buttons keep at least 40 px interactive height.

- [ ] **Step 2: Refine session and index telemetry**

Use monospaced dates and numeric values, align each index tile to a consistent two-column scan grid, increase faint metadata contrast, and use border separators without card backgrounds. Preserve name, code, price, change, percentage, source time tooltip, market status, update time, and delayed/error text.

- [ ] **Step 3: Remove obsolete CSS**

Delete `.terminal-search-hint` and `.icon-button` selectors that no longer have consumers. Verify with:

Run: `rg -n "terminal-search-hint|icon-button" src`

Expected: no matches.

- [ ] **Step 4: Run header tests**

Run: `npx vitest run src/app/components/TerminalHeader.test.tsx`

Expected: all tests PASS.

- [ ] **Step 5: Commit the header styling**

```powershell
git add src/styles/terminal.css
git commit -m "style: refine terminal market header"
```

---

### Task 4: Refine the decision workspace

**Files:**
- Modify: `src/styles/terminal.css:333-1401`

**Interfaces:**
- Consumes: unchanged stock list, chart, real-time quote, intraday, snapshot, and chip-distribution component markup.
- Produces: the same three-column workspace with clearer primary-chart hierarchy and unified row/section states.

- [ ] **Step 1: Preserve and rebalance the grid**

Keep three columns. Use `272px minmax(580px, 1fr) 352px` at wide desktop with 10 px gaps. Retain existing tablet and stacked breakpoints. Do not hide the stock list, indicators, chart panes, or snapshot sections.

- [ ] **Step 2: Flatten stock-list hierarchy**

Reduce panel-header height, use a single control fill for search, set rows to flat separators, remove `translateX`, and implement hover/active as background tint plus a 2 px left rail. Keep name, code, price, change, date, missing-data, loading, and error content.

- [ ] **Step 3: Make the chart the primary surface**

Quiet chart header/toolbar backgrounds, unify period and indicator tabs, make dates/codes numeric-monospace, retain all chart toolbar controls, and use one selected-state grammar. Keep chart dimensions, drawing library integration, attribution, zoom/pan controls, and full-screen behavior unchanged.

- [ ] **Step 4: Normalize snapshot sections**

Use section separators and compact metric cells rather than multiple nested card shadows. Keep every OHLC, performance, volume, turnover, chip, distribution, moving-average, indicator, source-date, and disclaimer field.

- [ ] **Step 5: Run decision and chart tests**

Run:

```powershell
npx vitest run src/app/features/decision src/app/features/chart
```

Expected: all decision/chart tests PASS, including temporary real-time daily-bar behavior.

- [ ] **Step 6: Commit decision styling**

```powershell
git add src/styles/terminal.css
git commit -m "style: clarify decision workspace hierarchy"
```

---

### Task 5: Migrate market analysis to the native terminal language

**Files:**
- Modify: `src/app/components/MarketAnalysis.test.tsx`
- Modify: `src/app/components/MarketAnalysis.tsx`
- Modify: `src/app/features/market/MarketInsightsView.tsx`
- Modify: `src/app/features/market/MarketInsightsView.test.tsx`
- Modify: `src/styles/terminal.css:1402-1530`

**Interfaces:**
- Consumes: `analysisDate`, `getPreopenAnalysis`, `resolveMainLines`, and existing selection state.
- Produces: unchanged analysis requests and content in terminal-native semantic markup.

- [ ] **Step 1: Write the failing structure test**

Add assertions that the loaded panel contains `.market-analysis-panel`, `.market-analysis-date`, and one `.market-mainline-row` per main line, while legacy gradient/scale classes are absent:

```tsx
expect(document.querySelector('.market-analysis-panel')).not.toBeNull();
expect(document.querySelector('.market-analysis-date')?.textContent).toContain('2026-08-11');
expect(document.querySelectorAll('.market-mainline-row')).toHaveLength(2);
expect(document.querySelector('[class*="hover:scale"]')).toBeNull();
```

Retain assertions for main-line reason, source label, market advice, and detail dialog behavior.

- [ ] **Step 2: Run tests to verify RED**

Run: `npx vitest run src/app/components/MarketAnalysis.test.tsx src/app/features/market/MarketInsightsView.test.tsx`

Expected: FAIL because semantic terminal classes do not exist.

- [ ] **Step 3: Replace utility-heavy markup**

Keep all state and data logic. Replace the root and nested Tailwind class strings with:

```tsx
<section className="terminal-panel market-analysis-panel">
  <header className="market-analysis-head">...</header>
  <div className="market-analysis-body">
    <button className={`market-mainline-row is-${line.priority}`}>...</button>
  </div>
  {adviceText && <aside className="market-analysis-advice">...</aside>}
</section>
```

Use Lucide icons already imported; replace the emoji bulb with a Lucide icon. Keep loading, error, empty, priority, reason, rank, confidence, advice, analysis date, selected detail, risks, style, risk level, and risk summary.

- [ ] **Step 4: Remove the legacy skin hook**

Delete `legacy-panel-skin` from `MarketInsightsView`. Do not alter `marketTradeDate`, `analysisDate`, ranking-window state, or child components.

- [ ] **Step 5: Add native terminal styles**

Style the analysis as a compact ranked list with one priority rail: red high, amber medium, neutral low. Use flat selected/hover states, terminal panel header, 4 px tags, and the existing modal overlay. Reuse the global terminal tokens only.

- [ ] **Step 6: Run focused tests to verify GREEN**

Run: `npx vitest run src/app/components/MarketAnalysis.test.tsx src/app/features/market/MarketInsightsView.test.tsx src/app/lib/api-trade-date.test.ts src/app/App.test.tsx`

Expected: all tests PASS, including analysis-date/trade-date request separation.

- [ ] **Step 7: Commit market migration**

```powershell
git add src/app/components/MarketAnalysis.tsx src/app/components/MarketAnalysis.test.tsx src/app/features/market/MarketInsightsView.tsx src/app/features/market/MarketInsightsView.test.tsx src/styles/terminal.css
git commit -m "style: unify market intelligence presentation"
```

---

### Task 6: Refine news and creator intelligence views

**Files:**
- Modify: `src/styles/terminal.css:1531-2553`

**Interfaces:**
- Consumes: unchanged news and creator markup/state.
- Produces: consistent filter, row, metric, detail, tag, and selection grammar without data loss.

- [ ] **Step 1: Normalize news controls and rows**

Keep search inside `.news-filter-bar`. Use a single-height control line on desktop, allow wrapping at smaller widths, increase result metadata contrast, and change active stream rows to flat tint plus a 2 px rail. Preserve all result count, window, sort, source, time, sectors, summary, key points, impact, and detail content.

- [ ] **Step 2: Convert creator overview to a metric rail**

Keep the four existing `.creator-overview-card` nodes and values. Style their shared grid as one continuous surface with internal separators, no individual floating shadows, aligned labels, and larger tabular values.

- [ ] **Step 3: Normalize creator ranking, work, and detail panels**

Apply the same selected rail/tint used for stocks/news. Increase body/metadata readability, retain every score, effective sample, pending count, platform, time, direction, claim, chip, AI summary, verification, conditions, quote, reason, and source field. Keep current desktop inline detail and tablet/mobile drawer behavior.

- [ ] **Step 4: Run focused intelligence tests**

Run:

```powershell
npx vitest run src/app/features/news src/app/features/creators
```

Expected: all news and creator tests PASS.

- [ ] **Step 5: Commit intelligence styling**

```powershell
git add src/styles/terminal.css
git commit -m "style: refine intelligence workspaces"
```

---

### Task 7: Complete responsive and accessibility behavior

**Files:**
- Modify: `src/styles/terminal.css:2577-end`

**Interfaces:**
- Consumes: all redesigned desktop rules.
- Produces: usable 1280, 1024, 720, and 390 px layouts without hiding business data.

- [ ] **Step 1: Refine 1280 px behavior**

Keep header actions status-only, retain decision columns with slightly reduced side widths, and keep the existing creator detail drawer threshold. Ensure no viewport-level horizontal overflow outside intentional nav/index scrollers.

- [ ] **Step 2: Refine 1100 px stacked workspaces**

Keep navigation and index strips horizontally scrollable. Stack decision and market grids, preserve explicit chart/panel minimum heights, keep news stream/detail order, and preserve creator ranking/work layout plus detail drawer.

- [ ] **Step 3: Refine 720 px and mobile behavior**

Use 40 px interactive controls where feasible, keep body copy at least 12 px, keep primary titles at least 13 px, let metadata wrap below values, make filter groups full width, keep creator ranking/latest switch visible, and preserve full-screen creator detail. Do not scale the page or hide business fields.

- [ ] **Step 4: Add logical overflow safeguards**

Ensure all long titles/body/source text use `overflow-wrap: anywhere`; numeric/code cells use `white-space: nowrap`; only nav/index/chip groups scroll horizontally; and modal/drawer content scrolls vertically within the viewport.

- [ ] **Step 5: Run the full component suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit responsive rules**

```powershell
git add src/styles/terminal.css
git commit -m "style: improve terminal responsive readability"
```

---

### Task 8: Visual regression, type checking, build, and final review

**Files:**
- Verify all modified production and test files.
- Create locally: `.tmp-ui-check/frontend-visual-check.mjs`

**Interfaces:**
- Consumes: completed Tasks 1–7.
- Produces: behavior, type, build, accessibility, and screenshot evidence for completion.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all Vitest files and tests PASS with zero unhandled errors.

- [ ] **Step 2: Run explicit source type checking**

Run:

```powershell
$taskSourceFiles = rg --files src -g '*.ts' -g '*.tsx'
npx tsc --noEmit --allowImportingTsExtensions --jsx react-jsx --lib ES2023,DOM,DOM.Iterable --module ESNext --moduleResolution bundler --target ES2022 --skipLibCheck --types vite/client $taskSourceFiles
```

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite exits 0 and writes production assets.

- [ ] **Step 4: Create the local screenshot script**

Use the existing `.tmp-ui-check/creator-check.mjs` pattern. Capture decision, market, news, and creators at 1440×1000, 1024×1000, and 390×844. For creator widths below 1281 px also open the first work detail. Print `clientWidth`, `scrollWidth`, active view, visible panels, and error counts. Do not add a new dependency; use the browser automation package already available to the local audit environment, or fall back to manual browser inspection if unavailable.

- [ ] **Step 5: Inspect visual checkpoints**

Confirm:

- Header shows four views, live state, market date, and all five indices with no inert search/settings chrome.
- Decision view keeps all three desktop columns and makes the chart visually primary.
- Market view shows distinct analysis date and market data date and all ranked/heatmap/sector content.
- News view keeps search in the filter bar and retains stream/detail data.
- Creator view retains four metrics, ranking, works, and detail; mobile text is readable without page scaling.
- No unintended viewport horizontal overflow exists at 1440, 1024, or 390 px.
- Keyboard focus is visible and reduced-motion rules are present.

- [ ] **Step 6: Validate the diff**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; only planned files are modified. Do not commit `.tmp-ui-check` artifacts unless already tracked.

- [ ] **Step 7: Perform final code review**

Review the final diff against `docs/superpowers/specs/2026-08-13-frontend-visual-optimization-design.md`. Verify no API/date/request logic changed, no data-bearing JSX was deleted, obsolete legacy selectors have no consumers, and every new semantic class has a rule.

- [ ] **Step 8: Commit final verification fixes**

```powershell
git add src/app src/styles
git commit -m "style: complete frontend visual optimization"
```

If no post-verification fixes exist, do not create an empty commit.

---

## Plan Self-Review

- Spec coverage: visual tokens, header, all four workspaces, market-analysis migration, responsiveness, focus, reduced motion, data preservation, tests, types, build, and visual inspection each map to an explicit task.
- Placeholder scan: no TBD/TODO/deferred implementation language remains; each code-changing task names exact classes, files, commands, and expected outcomes.
- Type consistency: no component public props or API types change; `analysisDate`, `marketTradeDate`, `TerminalHeaderProps`, and existing view contracts remain unchanged.
- Scope: component markup changes are limited to inert header controls and the legacy market-analysis presentation; all other work is token/scoped CSS.


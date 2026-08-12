# Remove Intelligence Page Headings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the three low-value page heading banners while keeping the news search input inside the existing filter bar.

**Architecture:** Delete each `view-heading` subtree in its owning React view. Move the existing controlled news search label without changing its state or request flow, then collapse the news and creator CSS grid row definitions so substantive content starts at the top.

**Tech Stack:** React 18, TypeScript, Vitest, jsdom, Vite 6, CSS Grid.

## Global Constraints

- Remove the market and creator heading banners completely.
- Remove the news heading text but preserve the existing search behavior and placeholder.
- Place the news search input inside `news-filter-bar`.
- Do not change API calls, filter semantics, content components, or global page structure.
- Preserve unrelated dirty-worktree changes.

---

### Task 1: Lock the heading and search placement behavior

**Files:**
- Modify: `src/app/features/market/MarketInsightsView.test.tsx`
- Modify: `src/app/features/news/NewsIntelligenceView.test.tsx`
- Modify: `src/app/features/creators/CreatorInsightsView.test.tsx`

**Interfaces:**
- Consumes: the three existing view components.
- Produces: DOM behavior assertions for removed headings and relocated news search.

- [ ] **Step 1: Write failing DOM behavior tests**

Add assertions that each rendered view has no `.view-heading`. On the news page, select `input[placeholder="搜索新闻、股票或板块"]` and assert `input.closest('.news-filter-bar')` is not null. Keep assertions that market content, news controls, and creator overview content still render.

- [ ] **Step 2: Run tests to verify RED**

Run: `npx vitest run src/app/features/market/MarketInsightsView.test.tsx src/app/features/news/NewsIntelligenceView.test.tsx src/app/features/creators/CreatorInsightsView.test.tsx`

Expected: FAIL because all three headings still exist and the news input is not inside `.news-filter-bar`.

### Task 2: Remove headings and collapse layout

**Files:**
- Modify: `src/app/features/market/MarketInsightsView.tsx`
- Modify: `src/app/features/news/NewsIntelligenceView.tsx`
- Modify: `src/app/features/creators/CreatorInsightsView.tsx`
- Modify: `src/styles/terminal.css`

**Interfaces:**
- Consumes: existing component-local state and CSS class names.
- Produces: heading-free pages with a controlled search input in `news-filter-bar`.

- [ ] **Step 1: Implement minimal React changes**

Remove the three `<section className="view-heading ...">` nodes. Insert the unchanged `.news-search-box` markup at the end of `.news-filter-bar`. Remove only icon imports made unused by those deleted nodes; retain `Search` and `RotateCcw` where still used by creator filters.

- [ ] **Step 2: Implement minimal CSS changes**

Change `.news-intelligence-view` to `grid-template-rows: auto minmax(0, 1fr)` and `.creator-insights-view` to `grid-template-rows: auto auto minmax(0, 1fr)`. Give `.news-search-box` `margin-left: auto` in the desktop filter bar and reset it to `margin-left: 0` inside the existing `max-width: 720px` rule. Remove heading-specific selectors that no longer have consumers.

- [ ] **Step 3: Run focused tests to verify GREEN**

Run: `npx vitest run src/app/features/market/MarketInsightsView.test.tsx src/app/features/news/NewsIntelligenceView.test.tsx src/app/features/creators/CreatorInsightsView.test.tsx`

Expected: all focused tests pass.

### Task 3: Verify the complete application

**Files:**
- Verify all changed production and test files.

**Interfaces:**
- Consumes: completed Task 2 working tree.
- Produces: verified application build.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run source type checking**

Run: `$taskSourceFiles = rg --files src -g '*.ts' -g '*.tsx'; npx tsc --noEmit --allowImportingTsExtensions --jsx react-jsx --lib ES2023,DOM,DOM.Iterable --module ESNext --moduleResolution bundler --target ES2022 --skipLibCheck --types vite/client $taskSourceFiles`

Expected: exit code 0.

- [ ] **Step 3: Run production build and diff validation**

Run: `npm run build`

Run: `git diff --check`

Expected: both commands exit 0.

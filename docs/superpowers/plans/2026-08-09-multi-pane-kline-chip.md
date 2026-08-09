# Multi-pane K-line and Chip Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stable multi-pane K-line workspace whose legends, right-hand snapshot, and chip distribution all follow the exact Stock_Project trading-day record under the crosshair.

**Architecture:** Extend the daily API mapper without calculating indicators, derive availability and snapshot selection through pure helpers, keep one Lightweight Charts main instance while reconciling auxiliary series, and render chip XY data in a focused SVG component. The workspace owns the active date so the chart and right panel remain loosely coupled.

**Tech Stack:** React 18, TypeScript, Lightweight Charts 5.2, SVG, Vitest/jsdom, CSS.

## Global Constraints

- Stock_Project remains the only data source; no fabricated indicator or chip data.
- The global latest trade date gate and `/backend-api` request order remain unchanged.
- Indicator controls and legends appear only when the selected stock contains finite backend values.
- Crosshair exit returns the snapshot to the latest loaded bar; missing historic fields stay empty and never fall back to another date.
- Main chart creation must remain stable while auxiliary indicators are toggled.

---

### Task 1: Preserve complete daily indicator and chip fields

**Files:**
- Modify: `src/app/lib/api.ts`
- Test: `src/app/lib/stock-project-mappers.test.ts`

**Interfaces:**
- Produces: `VolumeMovingAverages`, `AtrIndicators`, expanded `ChipIndicators`, and complete `StockKlineBar` day fields.

- [ ] Add a mapper fixture containing `volume_ma`, `atr`, chip cost ranges, and paired chart arrays.
- [ ] Run the mapper test and confirm the missing fields fail.
- [ ] Extend raw/public types and `mapStockProjectDailyBar` with nullable numeric normalization.
- [ ] Run the mapper test and confirm it passes.

### Task 2: Derive available indicators and selected snapshots

**Files:**
- Modify: `src/app/features/chart/chart-data.ts`
- Test: `src/app/features/chart/chart-data.test.ts`
- Create: `src/app/features/decision/snapshot-state.ts`
- Create: `src/app/features/decision/snapshot-state.test.ts`

**Interfaces:**
- Produces: `getAvailableChartIndicators(bars)`, `getAvailableMaKeys(bars)`, and `selectSnapshotBar(stock, date)`.

- [ ] Write literal tests proving entirely-null groups are absent and partially populated groups/MA keys are present.
- [ ] Run focused tests and verify they fail because the helpers are missing.
- [ ] Implement finite-value availability checks and exact-date snapshot selection with latest-bar fallback only when no date is selected.
- [ ] Run focused tests and verify they pass.

### Task 3: Normalize and render chip distribution

**Files:**
- Create: `src/app/features/decision/chip-distribution.ts`
- Create: `src/app/features/decision/chip-distribution.test.ts`
- Create: `src/app/features/decision/ChipDistributionChart.tsx`

**Interfaces:**
- Consumes: `ChipIndicators` from Task 1.
- Produces: `normalizeChipDistribution(chip)` and `<ChipDistributionChart chip currentPrice />`.

- [ ] Write tests for mismatched arrays, invalid points, sorting, and maximum-density normalization.
- [ ] Run the test and verify the missing helper fails.
- [ ] Implement the pure normalizer and the accessible SVG distribution component.
- [ ] Run the focused test and verify it passes.

### Task 4: Add stable multi-pane chart selection

**Files:**
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx`
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

**Interfaces:**
- Adds prop: `onActiveDateChange?: (date: string | null) => void`.
- Consumes availability helpers from Task 2.

- [ ] Extend the chart harness to expose the crosshair callback and series removal.
- [ ] Write tests proving two auxiliary controls can remain active, unavailable controls are omitted, the chart is not recreated, and the callback receives the hovered date.
- [ ] Run the component test and confirm behavioral failures.
- [ ] Replace exclusive auxiliary state with an ordered multi-select set and reconcile only auxiliary series/panes.
- [ ] Render value-bearing legends for the active bar and call the date callback from crosshair movement.
- [ ] Run the component test and confirm it passes.

### Task 5: Synchronize and expand the right snapshot

**Files:**
- Modify: `src/app/features/decision/DecisionWorkspace.tsx`
- Modify: `src/app/features/decision/DecisionPanel.tsx`
- Create: `src/app/features/decision/DecisionPanel.test.tsx`

**Interfaces:**
- `DecisionPanel` consumes `stock` plus `bar: StockKlineBar | null`.

- [ ] Write a component test with different latest and selected-day data, asserting the selected date, OHLC, full chip ranges, and chart label.
- [ ] Run the test and confirm the old latest-only panel fails.
- [ ] Store active chart date in the workspace and select the exact bar through Task 2's helper.
- [ ] Render all available day-level indicator groups and the chip distribution without using latest-day fallbacks.
- [ ] Run focused decision tests and confirm they pass.

### Task 6: Soften visual hierarchy and verify

**Files:**
- Modify: `src/styles/terminal.css`
- Modify: `README.md`

**Interfaces:**
- No new runtime interface.

- [ ] Add flexible chart height, pane legend chips, chip SVG styles, softer panels, rounded controls, and short transitions.
- [ ] Run `npm test` and require all files/tests to pass with zero failures.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Load the running Vite page and verify real Stock_Project chip arrays, multiple panes, date linkage, and responsive scrolling.


# Auxiliary Axis Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除遮挡副图最新数据的彩色序列标题尾标，同时保留主图最新价格与副图刻度。

**Architecture:** 只调整 `ProfessionalCandlestickChart` 创建副图序列时传给 Lightweight Charts 的公共配置。现有固定指标图例继续作为指标名称和值的唯一展示位置。

**Tech Stack:** React、TypeScript、Lightweight Charts 5.2、Vitest

## Global Constraints

- 不修改后端、接口或行情数据。
- 主图最新价格标签保持可见。
- 所有副图序列不得设置非空 `title`。

---

### Task 1: 隐藏副图标题尾标

**Files:**
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx`
- Test: `src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

**Interfaces:**
- Consumes: Lightweight Charts `addSeries(seriesType, options, paneIndex)`。
- Produces: 无右轴标题尾标的成交量、VMA、MACD 与其他副图序列。

- [ ] **Step 1: Write the failing test**

渲染默认成交量和 MACD 后，检查副图 `addSeries` 调用的 options：不得包含非空 `title`；第一条蜡烛序列仍为 `lastValueVisible: true`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

Expected: FAIL，现有副图 options 包含 `VOL / VMA / DIF / DEA / HIST` 标题。

- [ ] **Step 3: Write minimal implementation**

删除副图 Line/Histogram 序列 options 中的 `title`，保留现有图例、数据和颜色逻辑。

- [ ] **Step 4: Run focused and full verification**

Run: `npx vitest run src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

Run: `npm test`

Run: `npm run build`

- [ ] **Step 5: Inspect runtime page**

在 `http://localhost:5188/` 截图确认副图右侧只剩数值刻度，主图最新价格标签仍在。

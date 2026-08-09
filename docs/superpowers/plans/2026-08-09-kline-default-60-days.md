# K-line Default 60 Days Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每次进入图表或切换股票时默认展示最近 60 个有效交易日，消除只显示 1–2 根 K 线的状态泄漏。

**Architecture:** 在图表组件内定义唯一默认窗口 `60`，股票变化时重置周期状态，并在建图可视区计算中对手动模式做 60 日兜底。数据请求继续获取 120 根历史记录，不修改后端。

**Tech Stack:** React、TypeScript、Lightweight Charts 5.2、Vitest

## Global Constraints

- 默认窗口为最近 60 个有效交易日。
- 周期选项为 10、20、30、60 日。
- 不生成、填充或推算不存在的 K 线。
- 后端接口与 `page_size=120` 不变。

---

### Task 1: 切股重置 60 日窗口

**Files:**
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx`
- Test: `src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

**Interfaces:**
- Consumes: `stock.code`、标准化后的 `bars.length` 与 Lightweight Charts `setVisibleLogicalRange`。
- Produces: 股票切换后 `{ from: max(0, bars.length - 60 - 0.5), to: bars.length + 0.5 }` 的初始窗口。

- [ ] **Step 1: Write the failing regression test**

渲染第一只股票，点击手动放大使周期进入 `null`，再用同一 React root 渲染第二只股票。断言“近60日”按钮存在且高亮，并断言新图可视区使用 60 日而不是 0 日。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

Expected: FAIL，当前没有“近60日”按钮，且切股会沿用 `null`。

- [ ] **Step 3: Implement the minimal state fix**

新增 `DEFAULT_WINDOW_SIZE = 60`，将 `windowSize` 类型扩展为 `10 | 20 | 30 | 60 | null`；股票代码变化时设置 60；建图使用 `windowSize ?? DEFAULT_WINDOW_SIZE`；周期按钮增加 60；重置按钮设为 60。

- [ ] **Step 4: Verify focused behavior**

Run: `npx vitest run src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

- [ ] **Step 5: Verify project and runtime**

Run: `npm test`

Run: `npm run build`

在 `http://localhost:5188/` 切换股票并检查默认 60 日窗口。

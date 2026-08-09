# K-line Crosshair Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 K 线十字光标日期从混合本地化格式统一为 `YYYY-MM-DD`。

**Architecture:** 通过 Lightweight Charts 已有的 `localization.dateFormat` 控制光标日期，不增加日期状态或自定义日期计算。普通横轴继续使用库的自适应刻度。

**Tech Stack:** React、TypeScript、Lightweight Charts 5.2、Vitest

## Global Constraints

- 光标日期格式必须为 `yyyy-MM-dd`。
- 不修改普通横轴自适应刻度。
- 不使用 `Date.now()` 或 `new Date()` 生成业务交易日。

---

### Task 1: 统一光标日期格式

**Files:**
- Modify: `src/app/features/chart/ProfessionalCandlestickChart.tsx:243`
- Test: `src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

**Interfaces:**
- Consumes: Lightweight Charts `LocalizationOptions.dateFormat`。
- Produces: `2026-08-04` 形式的十字光标日期标签。

- [ ] **Step 1: Write the failing test**

在图表组件测试中断言 `createChart` 收到：

```ts
expect(chartOptions.localization).toEqual({
  locale: 'zh-CN',
  dateFormat: 'yyyy-MM-dd',
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

Expected: FAIL，现有配置缺少 `dateFormat`。

- [ ] **Step 3: Write minimal implementation**

将图表配置改为：

```ts
localization: {
  locale: 'zh-CN',
  dateFormat: 'yyyy-MM-dd',
},
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/app/features/chart/ProfessionalCandlestickChart.test.tsx`

Run: `npm test`

Run: `npm run build`

在 `http://localhost:5188/` 检查光标标签。

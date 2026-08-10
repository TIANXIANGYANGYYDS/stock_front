# 行情盘后展示与日线/分钟线切换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 盘后展示接口最后行情，删除右栏实时快照，并把主图改为日线/分钟线切换。

**Architecture:** 轮询和 API 适配保持不变；纯函数将单股实时响应约束成当天有序分钟柱，独立分钟图组件负责绘图，现有专业 K 线组件只协调两种模式。右栏恢复为纯日线快照。

**Tech Stack:** React 18、TypeScript、Lightweight Charts、Vitest、jsdom、现有 CSS。

## Global Constraints

- 不修改后端，不硬编码域名或端口。
- 不在前端累计或持久化行情历史，不生成 mock 或伪造分钟柱。
- 闭市停止定时刷新但保留并显示成功响应。
- 先写失败测试，再写最小实现；禁止 `any`。

---

### Task 1: 当日分钟数据规则

**Files:** `src/app/lib/realtime-format.ts`、`src/app/lib/realtime-format.test.ts`

- [ ] 写入乱序、重复时间、跨日、其他代码、无效 OHLC 和单项响应测试。
- [ ] 运行 `npm test -- --run src/app/lib/realtime-format.test.ts`，确认因函数缺失而失败。
- [ ] 实现 `selectIntradayQuotes(items, code, tradingDate)`，只返回目标代码、目标日期的有效有序数据。
- [ ] 重跑测试并提交。

### Task 2: 分钟蜡烛图与模式切换

**Files:** `src/app/features/chart/IntradayCandlestickChart.tsx`、对应测试、`ProfessionalCandlestickChart.tsx`、对应测试、`terminal.css`

- [ ] 先测试“日线/分钟线”按钮、默认日线、切换后当日分钟图、单柱提示、闭市最后行情与失败保留文案。
- [ ] 运行组件测试确认旧的近 N 日按钮导致失败。
- [ ] 实现分钟图的蜡烛与成交量，并在主图中切换；分钟模式隐藏日线指标和近 N 日按钮。
- [ ] 重跑图表测试并提交。

### Task 3: 删除右栏实时快照并调整协调层

**Files:** `DecisionPanel.tsx`、对应测试、`DecisionWorkspace.tsx`、对应测试、`terminal.css`

- [ ] 先修改测试，要求右栏无“实时行情 1m”，主图收到完整单股实时响应。
- [ ] 运行测试确认失败。
- [ ] 删除右栏实时 props/UI；工作区改传 `realtimeData` 给主图并避免选中股票重复报价消费。
- [ ] 重跑工作区、图表和右栏测试并提交。

### Task 4: 盘后指数与最终验证

**Files:** `TerminalHeader.tsx`、对应测试、`README.md`

- [ ] 补充闭市有数据时仍显示五项数值和“最后行情”的测试。
- [ ] 仅在测试证明现有行为不满足时修改组件。
- [ ] 运行实时相关测试、完整 `npm test -- --run` 和 `npm run build`。
- [ ] 检查 1440px、1024px、390px，记录 live API 能力与搜索后端耗时结论。

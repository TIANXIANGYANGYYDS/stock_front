# 盘前分析与行情日期拆分设计

## 目标

修复前端把最新行情交易日同时用于日线行情和盘前报告的问题。日期接口返回的 `latest_trade_date` 与 `latest_analysis_date` 分别进入独立状态和请求链路；不新增历史日期选择器，不改变现有组件结构或请求库。

## 方案选择

采用最小 props 拆分方案：`App` 请求一次最新日期接口并保存 `marketTradeDate` 与 `analysisDate`，随后把行情日期继续传给决策、资讯、板块排行和顶部行情，把分析日期单独传给盘前分析。相比新增全局日期上下文或让盘前组件重复请求日期接口，该方案改动范围更小，也能保持单一接口调用和现有加载门禁。

## API 契约

日期接口原始 TypeScript 类型增加 `latest_analysis_date: string | null`。稳定返回值同时包含：

- `marketTradeDate`：由 `latest_trade_date` 校验并映射，供所有依赖已入库日线的模块使用。
- `analysisDate`：由 `latest_analysis_date` 校验并映射；字段缺失、为空或格式无效时为 `null`。

盘前请求函数接受 `string | null`：

- 有显式分析日期时请求 `/api/v1/morning-analyses/{analysis_date}`。
- 无分析日期时请求 `/api/v1/morning-analyses/latest`。
- 不读取或回退到 `marketTradeDate`。

盘前响应把 `analysis_date` 映射为独立的 `analysisDate` 展示字段；响应中的 `trade_date` 仍可保留为报告关联交易日，但不用于盘前分析日期标签。

## 状态与数据流

`App` 将原有单一 `tradeDate` 状态拆为：

- `marketTradeDate`：继续传给 `TerminalHeader`、`DecisionWorkspace`、`NewsIntelligenceView`，以及市场洞察中的 `SectorTrend` 和 `NewsHeatmap`。
- `analysisDate`：仅传给 `MarketInsightsView` 中的 `MarketAnalysis`。

现有非博主工作区仍以 `marketTradeDate` 完成加载门禁，避免改变现有页面挂载行为。`analysisDate` 允许为空；市场洞察挂载后由盘前组件请求 `/morning-analyses/latest`。

若未来调用方传入用户选择的历史 `analysis_date`，盘前组件 prop 变化会触发对应显式日期请求。当前不新增日期选择器。

## 页面文案

保持现有布局和视觉样式，只澄清日期语义：

- 盘前卡片显示“盘前分析日期”。
- 顶部行情区域显示“行情数据日期”。

盘前卡片不再把报告日期与行情交易日比较，也不再提示两者不一致，因为这两个日期本来就允许不同。

## 测试

先补失败测试，再实施最小代码修改：

- 日期接口返回行情日期 `2026-08-10`、分析日期 `2026-08-11` 时，稳定映射保留两个值。
- 应用状态传递确保日线相关工作区收到 `2026-08-10`，盘前组件收到 `2026-08-11`。
- 盘前默认显式请求 `/morning-analyses/2026-08-11`。
- `latest_analysis_date` 为空时请求 `/morning-analyses/latest`，且不请求 `2026-08-10`。
- 显式传入历史分析日期时严格请求该日期。
- 日期标签分别显示“盘前分析日期”和“行情数据日期”。

最终运行定向测试、完整单元测试、独立 TypeScript 检查（使用项目已安装的 TypeScript 编译器且不输出文件）和生产构建。

## 完成标准

- 盘前报告和日线行情不再共享同一个日期状态。
- 所有日线相关接口继续使用 `latest_trade_date`。
- 盘前默认路由遵守显式 `latest_analysis_date` 或 `/latest` 规则，绝不回退到行情日期。
- UI 结构、现有请求封装和组件职责保持不变。

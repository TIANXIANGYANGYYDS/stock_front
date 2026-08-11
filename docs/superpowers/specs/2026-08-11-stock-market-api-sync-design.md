# 最新股票行情接口同步设计

## 目标

在不修改后端、不引入新的全局状态框架、不重做无关页面的前提下，将现有 A 股终端同步到后端最新的三类行情契约：大盘指数实时行情、个股实时价格快照、个股指定交易日分时 K 线。所有业务请求继续通过 `src/app/lib/api.ts` 的 `VITE_API_BASE_URL` 发出，默认使用 `/backend-api`，由 Vite 开发代理连接现有 8100 后端。

本次修改必须彻底消除“把 realtime 快照当成分钟 K 线”的旧兼容逻辑。实时价格只消费 `price`，分钟图只消费 intraday 响应中的 `timestamp/open/high/low/close`。

## 已确认的项目现状

- `App.tsx` 使用本地 `activeView` 状态切换四个工作区，没有运行时路由表。
- 项目没有全局 store；页面本地状态和 hooks 是现有状态管理方式。
- `src/app/lib/api.ts` 是唯一后端适配层，负责 snake_case 到 camelCase 的边界映射。
- `useRealtimePolling` 已实现串行 `setTimeout`、页面隐藏暂停、恢复可见和窗口聚焦刷新、AbortController 取消、失败保留上一次成功数据。
- `DecisionWorkspace` 负责股票列表、当前股票、日线详情和实时行情协调。
- `ProfessionalCandlestickChart` 管理日线/分钟线模式；`IntradayCandlestickChart` 只负责 lightweight-charts 绘制。
- 当前 realtime 类型同时容纳快照 `price` 与分钟 OHLC，单股 realtime 响应被错误用于构造分钟模式数据源。
- 项目已有 A 股红涨绿跌视觉变量和终端式状态文案。
- 项目脚本包含 Vitest 测试和 Vite 构建，没有 ESLint 或独立 TypeScript 检查脚本。

## 后端契约与前端类型

### 大盘指数

`GET /api/v1/market/indices/realtime`

继续映射为 `RealtimeMarketIndicesResponse` 和 `MarketIndexQuote`。指数项保留后端明确返回的 `previous_close`、`change` 和 `change_pct`，数值缺失时使用 `null`，不得以 `0` 代替。

真实接口可能在交易时段返回 `market_status=stale`，且指数项的 `status` 也可能为 `stale`。前端将它展示为轻量延迟状态，但仍继续刷新；只有明确的 `closed` 才停止定时轮询。

### 个股实时价格

单只：`GET /api/v1/stocks/{code}/realtime`

批量：`GET /api/v1/stocks/realtime?codes=600519,000001`

定义独立的 `StockRealtimeQuote`：

- `code`
- `name`
- `market`
- `price`
- `volume`
- `amount`
- `sourceTime`
- `receivedAt`
- `provider`

定义 `StockRealtimeResponse`：

- `tradingDate`
- `marketStatus`
- `items`
- `missingCodes`

该类型不存在 `interval`、`timestamp`、OHLC、`previousClose`、`change` 或 `changePercent`。批量和单只 realtime 请求不再发送 `interval` 查询参数。

### 个股分时 K 线

`GET /api/v1/stocks/{code}/intraday?trade_date={tradeDate}&interval={interval}`

定义 `IntradayInterval` 联合类型：`'1m' | '5m' | '15m' | '30m' | '60m' | '120m'`。

定义独立的 `StockIntradayBar`：

- `code`
- `name`
- `market`
- `tradeDate`
- `interval`
- `timestamp`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `amount`
- `provider`

定义 `StockIntradayResponse`：

- `code`
- `name`
- `tradeDate`
- `interval`
- `count`
- `items`

`getStockIntraday` 对股票代码进行路径编码，传入现有 `preferredTradeDate` 作为 `trade_date`，并传入用户选择的 interval。响应映射只读取 `timestamp`，完全忽略 `created_at`、`updated_at`、`first_seen_at` 和 `last_seen_at`。

## 请求与轮询设计

### 通用状态机

保留 `useRealtimePolling` 的生命周期模型，并把成功后的定时策略从“仅 `open` 继续”修订为“除 `closed` 外继续”。这样能够处理真实后端的 `stale` 状态，同时仍在闭市后停止高频请求。

所有定时请求都在上一次请求完成后才安排下一次，不允许重叠。手动刷新、窗口聚焦和页面恢复可见期间若已有请求在途，只合并为一次待执行刷新。隐藏页面和卸载组件时中止请求并清理定时器。

### 刷新频率

- 大盘指数：非 `closed` 状态每 5 秒刷新。
- 批量个股实时价格：非 `closed` 状态每 5 秒刷新。
- 当前个股实时价格：非 `closed` 状态每 5 秒刷新。
- 当前个股 intraday：只在分钟线模式启用，交易中每 30 秒刷新；实时行情明确 `closed` 后保留最后成功的分时数据并停止定时刷新。
- 闭市期间恢复可见或窗口重新聚焦时，仍允许执行一次检查，以便发现新交易日或重新开市。

intraday 响应本身没有 `market_status`，其轮询调度使用当前单股 realtime 的最近成功市场状态。首次状态尚未返回时允许请求；若随后状态变为 `closed`，最多再执行一次最终分时刷新后停止。

### 查询切换

股票代码、交易日或 interval 变化时使用新的 query key，中止旧请求并清空旧查询数据，防止上一只股票、上一交易日或上一周期的数据泄漏。切回日线模式时停止 intraday 请求；再次进入分钟线时立即重新获取。

## 页面与交互设计

### 大盘指数区域

`TerminalHeader` 继续按固定顺序展示五个指数。上涨红色、下跌绿色、平盘或缺失方向使用中性色。

- 首次加载：保留现有五项骨架。
- 空 items：显示“暂无指数行情”。
- 首次失败：显示“行情暂不可用”。
- 后台刷新失败：保留旧指数并显示“数据可能延迟”。
- `market_status=stale` 或指数项 `status=stale`：保留数据、显示“行情延迟”，并继续轮询。
- `market_status=closed`：显示“已闭市 · 最后行情”，保留最后数据。

### 股票导航

批量 realtime 只覆盖列表项的有效 `price` 和有效 `amount`，继续保留日线 `changePercent`、交易日和其他日线信息。涨跌色仍来自真实日线涨跌幅，不从实时价格推算。

`missingCodes` 中的股票继续显示日线收盘价，并以轻量提示标明“实时缺失/日线收盘”。批量请求失败时保留当前列表和最近一次 realtime 合并结果，同时显示延迟状态。

### 个股图表头部

当前选中股票使用单股 realtime 获取 `price`。当日线图停留在最新 K 线时，主价格显示 realtime 的 `price`，旁边明确标记“实时价”，涨跌百分比仍标记为“日线涨跌”。用户把十字光标移动到历史日 K 后，价格和涨跌恢复为该历史 K 线值，实时价格不能覆盖历史观察。

分钟线模式的主价格优先显示 realtime `price`；没有快照时才回退到最后一根 intraday K 的 `close`。不展示或推导 realtime 涨跌额、涨跌幅。

### 分时图

保留现有“日线 / 分钟线”主模式切换。在分钟线模式增加紧凑的周期选择：1分、5分、15分、30分、60分、120分，默认 1分。

分时图只消费当前股票、当前交易日和当前 interval 的有效 K 线：

1. 校验股票代码、interval、`timestamp` 和 OHLC。
2. 只保留响应 `tradeDate` 对应的上海交易日。
3. 相同 `timestamp` 以后出现的项覆盖以前项。
4. 按 `timestamp` 升序绘制。
5. 横轴和 tooltip 始终来自 `timestamp`。
6. 成交量副图使用每根分时项的 `volume`。

加载、空数据、单根 K、延迟、闭市最后行情分别使用现有终端样式展示。intraday 失败不影响日线、实时价格、右侧日线快照或股票导航。

### 右侧行情快照

`DecisionPanel` 保持日线、筹码和指标语义，不新增 realtime 推导字段。该区域继续随日线十字光标联动，避免把实时快照和日线指标混为同一数据口径。

## 错误与数据保留

- 503 和网络错误统一由轮询 hook 转换为轻量延迟状态。
- 同一 query key 下请求失败时保留上一次成功数据。
- AbortError 属于生命周期控制，不显示为错误。
- 新 query key 不复用旧股票或旧 interval 数据。
- `missing_codes` 是成功响应的一部分，不转化为请求错误。
- 无 realtime 快照时不伪造价格；无 intraday K 线时不使用 realtime 合成蜡烛。
- 各行情域失败相互隔离，指数失败不阻塞工作区，实时价格失败不阻塞日线，intraday 失败不阻塞实时价格。

## 文件边界

- `src/app/lib/api.ts`：拆分原始/稳定 realtime 与 intraday 类型、映射器和请求函数。
- `src/app/lib/realtime-api.test.ts`：覆盖三类接口契约、查询参数、路径编码、503 和缺失字段。
- `src/app/lib/realtime-format.ts`：实时列表合并、快照选择、intraday 排序去重和状态判断纯函数。
- `src/app/lib/realtime-format.test.ts`：覆盖价格合并、missing、timestamp、周期和 stale 状态。
- `src/app/hooks/useRealtimePolling.ts`：修订 closed-only 停止策略。
- `src/app/hooks/useRealtimePolling.test.tsx`：覆盖 stale 继续和 closed 停止。
- `src/app/hooks/useRealtimeQuotes.ts`：指数、批量/单股 realtime 与 intraday 薄 hooks。
- `src/app/hooks/useRealtimeQuotes.test.tsx`：覆盖参数转发、启用条件和周期查询。
- `src/app/features/decision/DecisionWorkspace.tsx`：协调批量实时、单股实时、intraday 模式和 interval。
- `src/app/features/decision/StockNavigator.tsx`：显示批量实时延迟与 missing 状态。
- `src/app/features/chart/ProfessionalCandlestickChart.tsx`：分离 daily、realtime 和 intraday props，管理图表模式与周期交互。
- `src/app/features/chart/IntradayCandlestickChart.tsx`：消费 `StockIntradayBar[]`，横轴只使用 timestamp。
- `src/app/components/TerminalHeader.tsx`：显示 stale/closed/失败状态。
- `src/styles/terminal.css`：补充分时周期和轻量状态样式。
- `README.md`：更新接口清单和数据语义。

## 测试与验证

采用测试驱动开发，先让新契约测试在旧实现上失败，再进行最小实现。

自动化测试覆盖：

- realtime 快照不含 interval/OHLC/timestamp/change 字段。
- intraday 映射只使用 timestamp，并支持六种 interval。
- realtime 请求不发送 interval；intraday 正确发送 trade_date 和 interval。
- batch codes 去空、去重和 URL 编码；单股路径编码。
- stale 状态继续轮询，closed 停止轮询。
- 页面隐藏暂停、恢复立即刷新、请求不重叠、卸载取消。
- 失败保留旧数据，查询切换隔离旧数据。
- missing_codes 保留日线收盘并展示提示。
- 日线最新位置使用 realtime price，历史十字光标不被覆盖。
- 分钟图使用 intraday 数据、timestamp 排序和 interval 切换。

最终验证执行：

- `npm test`
- `npm run build`
- 通过 Vite `/backend-api` 代理实际请求指数、intraday、单股 realtime 和批量 realtime。
- 直接检查 1440px、1024px 和 390px 下的指数条、图表头、周期选择和空/延迟状态。

项目未配置 lint 和独立 typecheck 脚本，最终报告如实标记“未配置”，不会将 Vite build 冒充独立 TypeScript 检查。

## 完成标准

- 大盘区域只使用指数 realtime 接口。
- 股票当前价格只使用 realtime 的 `price`。
- 股票分时图只使用 intraday 的真实 `timestamp` 与 OHLC。
- realtime 不再承担分钟 K 线职责，也不发送 interval 参数。
- 开市和 stale 状态合理刷新，闭市后保留数据并停止高频轮询。
- 页面隐藏、恢复、聚焦、卸载和慢请求均符合生命周期要求。
- loading、空数据、missing_codes、503 和网络错误均有明确且轻量的表现。
- A 股红涨绿跌、平盘中性；不伪造后端未提供的涨跌字段。
- 无 `any`、无生产 mock、无硬编码新增后端地址、无无关页面重做。
- 完整测试、构建和真实代理联调结果均在交付报告中列明。

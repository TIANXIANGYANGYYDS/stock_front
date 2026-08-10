# 实时大盘指数与个股行情接入设计

## 目标

在现有 A 股终端中接入 Stock_Project 已提供的大盘指数和个股实时行情接口。顶部大盘指数条展示五个真实指数；决策工作台的股票列表、图表顶部和行情快照展示实时个股数据。所有请求继续使用项目现有 `API_BASE_URL`，不修改后端接口，不硬编码域名或端口，不生成行情历史或生产模拟数据。

实时行情只补充后端明确提供的字段。个股当前价格使用 `close`；个股实时响应没有 `previous_close`、`change` 或 `change_pct`，因此涨跌幅继续使用当前日线数据源，前端不根据实时价格推算。

## 非目标

- 不修改 Stock_Project 后端或代理配置。
- 不在浏览器中保存或累计分时历史。
- 不用指数数据替代个股数据，也不用个股数据冒充指数。
- 不从实时 `close` 推算个股涨跌额或涨跌幅。
- 不重做现有导航、K 线、指标、筹码或市场洞察布局。
- 不为本功能引入新的全局状态框架、请求库、lint 工具链或 TypeScript 工具链。

## 现有项目约束

- `src/app/lib/api.ts` 是唯一后端适配层，使用 `VITE_API_BASE_URL`，默认值为 `/backend-api`。
- 页面使用 React 组件本地状态和 hooks，没有全局状态库。
- `TerminalHeader` 的 `market-index-strip` 已预留五个指数位置，目前显示“接口待接入”。
- `DecisionWorkspace` 管理股票列表和当前选中股票；`ProfessionalCandlestickChart` 显示顶部价格和日 K；`DecisionPanel` 显示行情快照。
- 项目现有脚本只有 `test`、`test:watch`、`dev` 和 `build`，没有 ESLint、TypeScript CLI 或 `tsconfig`。

## 后端接口

### 大盘指数

`GET /api/v1/market/indices/realtime`

稳定 UI 响应类型包含：

- `tradingDate`
- `marketStatus`
- `updatedAt`
- `cacheAgeMs`
- `items`

每个指数项包含 `symbol`、`name`、`market`、`price`、`previousClose`、`change`、`changePercent`、`open`、`high`、`low`、`volume`、`amount`、`sourceTime`、`receivedAt`、`status` 和 `provider`。数值字段使用 `number | null`，不能用 `0` 代替缺失值。

页面按以下规范顺序展示，即使后端顺序发生变化：

1. `000001.SH` 上证指数
2. `399001.SZ` 深证成指
3. `399006.SZ` 创业板指
4. `000688.SH` 科创50
5. `000300.SH` 沪深300

### 个股实时行情

批量：`GET /api/v1/stocks/realtime?codes=600519,000001&interval=1m`

单只：`GET /api/v1/stocks/{code}/realtime?interval=1m`

稳定 UI 响应类型包含 `tradingDate`、`marketStatus`、`interval`、`items` 和 `missingCodes`。每个报价包含 `code`、`name`、`market`、`tradeDate`、`interval`、`timestamp`、`open`、`high`、`low`、`close`、`volume`、`amount` 和 `provider`。

`getRealtimeStocks` 忽略空代码、对代码去重并使用现有查询构造器编码。`getRealtimeStock` 对路径代码使用 `encodeURIComponent`。单只响应仍按 `items` 解析；目标代码缺失时返回成功的空快照，不制造报价。

## API 适配层

`requestJson` 增加可选 `AbortSignal`，并继续构造 `${API_BASE_URL}${path}${query}`。现有调用不传 signal 时行为不变。

新增：

- `mapRealtimeMarketIndex`
- `mapRealtimeStockQuote`
- `getRealtimeMarketIndices(signal?)`
- `getRealtimeStocks(codes, interval = '1m', signal?)`
- `getRealtimeStock(code, interval = '1m', signal?)`

映射器必须容忍字符串数值、空字段、空数组、未知 `market_status`、未知 provider 和单项脏数据。禁止使用 `any`。响应边界将 snake_case 映射为稳定 camelCase 类型，组件不直接读取原始字段。

## 通用实时轮询

新增 `useRealtimePolling<T>`，接收异步请求函数、从成功响应读取 `marketStatus` 的函数、5 秒间隔和启用条件。它返回：

- `data`：最近一次成功响应，初始为 `null`。
- `initialLoading`：尚无成功数据时正在请求。
- `refreshing`：已有成功数据时后台刷新。
- `delayed`：最近一次刷新发生 503、网络错误或其他请求错误。
- `error`：轻量错误文本。
- `marketStatus`：最近一次成功响应的市场状态。
- `lastSuccessAt`：最近一次成功时间。
- `refresh()`：手动请求；若已有请求则排队一次，不并发发出。

行为规则：

1. hook 挂载、启用且页面可见时立即请求。
2. 成功响应为 `open` 时，在本次请求完成后使用串行 `setTimeout` 安排 5 秒后的下一次请求，不使用 `setInterval`。
3. 成功响应为 `closed` 时清除定时器，保留最后报价。
4. 页面隐藏时清除定时器并中止当前请求；恢复可见时立即请求。
5. 窗口获得焦点时立即请求。若当时有请求在途，只记录一次待刷新，在当前请求结束后执行，绝不并发叠加。
6. 请求函数或关键参数变化时中止旧请求；旧响应不能覆盖新股票或新代码集。
7. 组件卸载时清除定时器、事件监听、排队刷新并中止请求。
8. 请求失败时保留 `data`；有旧数据时显示“数据可能延迟”，无旧数据时显示“行情暂不可用”。
9. 最近成功状态为 `open` 或尚未有成功响应时，失败后 5 秒重试；最近成功状态为 `closed` 时不定时重试。
10. 闭市期间窗口聚焦或页面恢复可见仍执行一次检查，以便发现新的开市状态。

指数、批量个股和单只个股基于同一个轮询核心封装薄 hooks，避免复制生命周期逻辑。

## 大盘指数展示

`App` 挂载指数实时 hook，并将结果、加载、延迟和错误状态传给 `TerminalHeader`。该请求独立于 `latest_trade_date` 日期门禁，因此任何一级工作区都能看到指数条。

`TerminalHeader` 用真实数据替换占位内容：

- 左侧显示指数响应的交易日期、开市/闭市状态以及 `updatedAt` 的上海时区时间。
- 五个指数按规范顺序展示名称、代码、当前价格、涨跌额和涨跌幅。
- `change > 0` 或 `changePercent > 0` 为红色；小于 0 为绿色；等于 0 或无法判断为中性色。
- 初次加载使用现有五项骨架。
- 整体空数据展示“暂无指数行情”。
- 单个指数缺失只在对应位置显示“暂无数据”。
- 首次失败显示“行情暂不可用”；有旧数据后失败显示“数据可能延迟”，旧价格保持可见。
- 闭市显示“已闭市”，不把闭市当错误。

现有横向滚动和五列桌面网格保留。价格和涨跌区域使用不换行、省略和最小宽度约束，移动端不发生文字覆盖。

## 个股列表、图表和快照

`DecisionWorkspace` 在股票列表成功后取得当前列表代码，并启动批量实时 hook：

- 按 `code` 建立报价索引。
- 仅用批量响应覆盖列表项的 `close` 和非空 `amount`。
- 保留列表原有的 `changePercent` 和其他日线字段。
- `missingCodes` 或缺失报价继续展示原有日线数据。
- 搜索导致代码集变化时中止旧批量请求并立即请求新代码集。

选中股票后启动单只实时 hook。结果作为独立 props 传给 `ProfessionalCandlestickChart` 和 `DecisionPanel`：

- 图表正在显示最新一根 K 线时，顶部主价格优先使用实时 `close`，显示“实时 1m”和 `timestamp`。
- 用户移动十字光标到历史 K 线时，顶部恢复使用历史 K 线的 OHLC 和价格，实时数据不覆盖历史观察。
- 图表涨跌幅继续来自现有日线或历史 K 线，并明确使用日线语义；不从实时数据推导。
- `DecisionPanel` 在原有“日线行情”之前增加“实时行情 1m”区，展示开、高、低、当前价、成交量、成交额、更新时间和开市/闭市状态。
- 实时报价尚未返回时显示轻量加载；空数据显示“暂无实时行情”；失败后有旧报价时显示“数据可能延迟”。
- 原有日线行情、筹码结构和指标区域不被清空或替换。

## 时间、数值与颜色

新增纯函数将 ISO 时间使用 `Intl.DateTimeFormat` 和 `timeZone: 'Asia/Shanghai'` 格式化为 `HH:mm:ss`。空值或无效时间显示 `--:--:--`。不能用本地浏览器时区直接截取字符串。

指数颜色按 A 股约定：上涨红色、下跌绿色、平盘中性色。个股实时 OHLC 不使用方向色暗示不存在的涨跌关系；当前价格只有在沿用现有日线方向时才使用当前页面已有的红绿状态，同时注明涨跌来源为日线。

## 错误与空状态隔离

- 指数请求失败不影响最新交易日、导航和任何工作区。
- 批量报价失败不影响股票列表搜索、选择或日线字段。
- 单只报价失败不影响 K 线、十字光标、日线行情、指标或筹码。
- 首次加载、首次失败、成功后延迟、空 items、单项缺失和闭市分别展示不同状态。
- AbortError 是生命周期控制结果，不显示为行情错误。
- 前端永远保留最近一次成功数据，直到查询对象发生变化或组件卸载；同一查询的失败不得清空它。

## 文件边界

- `src/app/lib/api.ts`：原始类型、稳定类型、映射器、三组实时请求和 signal 支持。
- `src/app/lib/realtime-api.test.ts`：响应解析、空值、查询、路径和 signal 请求契约。
- `src/app/hooks/useRealtimePolling.ts`：可复用轮询状态机。
- `src/app/hooks/useRealtimePolling.test.tsx`：定时器、可见性、焦点、并发、取消和旧数据保留。
- `src/app/hooks/useRealtimeQuotes.ts`：指数、批量个股和单只个股的薄封装。
- `src/app/lib/realtime-format.ts`：上海时区、市场状态、颜色和报价合并纯函数。
- `src/app/lib/realtime-format.test.ts`：时间格式、固定指数顺序和个股字段合并。
- `src/app/App.tsx`、`src/app/App.test.tsx`：指数 hook 挂载及与日期门禁隔离。
- `src/app/components/TerminalHeader.tsx`、对应测试：顶部五指数真实展示。
- `src/app/features/decision/DecisionWorkspace.tsx`、对应测试：批量和单只报价协调。
- `src/app/features/chart/ProfessionalCandlestickChart.tsx`、对应测试：最新价与历史十字光标优先级。
- `src/app/features/decision/DecisionPanel.tsx`、对应测试：实时快照区。
- `src/styles/terminal.css`：既有设计语言内的状态、数值和响应式样式。
- `README.md`：新增实时接口、刷新规则和环境变量说明。

## 测试与验收

API 和纯函数测试覆盖：

- 指数及个股 snake_case 响应映射。
- 字符串数值、空值、空数组、未知状态和缺失代码。
- API_BASE_URL 相对路径、批量 codes、interval 和单只路径编码。
- `source_time`、`timestamp`、`updated_at` 的上海时区 `HH:mm:ss`。
- 固定指数顺序、指数颜色和个股列表只覆盖允许字段。

轮询测试使用 Vitest 假定时器和可控 Promise，覆盖：

- 首次立即请求。
- `open` 每 5 秒串行刷新。
- `closed` 停止定时刷新。
- 隐藏暂停、恢复可见立即请求。
- 窗口 focus 立即请求。
- 慢请求不并发，并将额外刷新合并为一次。
- 参数变化和卸载中止请求。
- 首次成功后刷新失败保留旧数据并标记延迟。
- 503、网络错误、AbortError 的不同处理。

组件测试覆盖五指数展示、骨架、空状态、闭市、延迟、红涨绿跌、批量合并、单只实时快照，以及历史十字光标不被实时价格覆盖。

最终运行项目现有的完整 `npm test` 和 `npm run build`。项目没有 lint 或独立 TypeScript 检查脚本，最终报告明确标注“未配置”，不把它误报为已通过。另在 1440px、1024px 和 390px 检查指数条、实时快照和长股票名称不溢出。

## 完成标准

- 顶部五个预留指数位置显示真实指数行情和完整状态。
- 股票列表通过批量接口显示实时价格，同时保留原日线涨跌幅。
- 当前股票通过单只接口显示实时价格和实时快照。
- 开市轮询、闭市停止、焦点/可见性刷新、并发保护和卸载取消符合要求。
- 503 或网络错误保留最后成功数据并提示延迟。
- 无硬编码后端地址、无 `any`、无生产 mock、无前端行情历史。
- 现有工作区、日 K、指标和筹码行为不回归。
- 新增测试、完整测试和生产构建全部通过。

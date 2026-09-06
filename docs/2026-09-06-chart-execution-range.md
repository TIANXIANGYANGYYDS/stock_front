# 个股日K模拟成交区间接入

## 实现

- 沿用 React、TypeScript、现有请求封装及 Lightweight Charts 的 `createSeriesMarkers`，策略取自公开目录。浏览器请求仍走现有 API base URL / 开发代理。
- 日K默认按已加载K线的首末日期查询成交，也可展开“日期区间”手动查询。缩放、平移只改变视口，复用已加载标记，不逐交易日请求成交。
- 新增策略、方向、买卖标记开关、刷新和成交明细入口。图表标记、方向筛选和记录标题显示“买入／卖出”，记录性质保留在详情中的“数据说明与历史覆盖”。点击标记打开该交易日全部成交，同日多笔按方向聚合数量，明细逐笔保留。
- 仅绘制 `status=filled`；用每笔 `trade_date` 匹配日K，买入 `belowBar`，卖出 `aboveBar`。不使用原始成交价作为前复权K线的坐标，不使用计算时间定位。
- 成交量面板在同一日期量柱顶部增加向下指示箭头，买入红色、卖出绿色，与主图横坐标一致；可点击查看准确成交时间与原始成交价。关闭成交量时卸载对应标记，重新打开恢复，关闭买卖标记同时清除两个面板的标记。
- 量化表格、详情及嵌套记录的原始原因统一隐藏。未通过的原因显示“不满足”；已成交和缺失原因显示“—”。原因排序也使用显示值，不按隐藏的原因文本排序。
- 原始成交价保留接口数值精度，金额、费用直接取接口；缺少K线的记录仍保留在详情并提示无法定位。0 与 null 分开处理，时间统一上海。
- 历史覆盖、补录、重建与账户重算时间放在详情折叠区。数据缺口提示指向区间内账户快照，不推断当前股票行情全部缺失。
- 现有量化信号查询保持独立。此次不新增信号标记、不把未成交信号转成模拟成交。
- 总览继续使用后端 summary，明确仅纳入曾实际买入的账户（含已清仓账户），补充 `capital_inflow` 的新增本金标签，不计算本金或收益率。

## 分页和一致性

- 使用 `/api/v1/quant/strategies/{strategy_id}/executions`，同时传 code、start_date、end_date，直接读取顶层分页；不传单日 trade_date 或 overview.snapshot_id。
- 首次第一页不传 history_version；后续页固定第一页 history_version。全部加载后按策略与 event_id 去重、成交时间升序排列。
- 外层 snapshot_id 与 history_version 对齐校验，每笔来源日 snapshot_id 单独保留。
- 409 丢弃已获取分页，重新从第一页加载，最多重启一次；再次冲突展示明确错误及手动重试，不继续轮询。
- 缓存包含策略、代码、起止日期、方向和对应历史版本。每次重访都重新获取第一页验证版本，旧日重算也能失效。仅在内存缓存最多20组，不持久化成交数据。
- 查询变化防抖250ms，取消旧请求并隔离旧响应。成功后每60秒以及页面重新可见时校验；卸载清理定时器、监听与请求。单次更新只完成当前查询，不并行重复轮询。
- 全屏弹窗渲染于全屏容器内；窄屏按行情头实际高度设置滚动留白，避免日期和筛选控件被固定头遮挡。

## 真实接口联调（2026-09-06）

工作区不能访问交付文档的 Linux 路径，已读取已配置后端的 `/openapi.json` 并对真实响应核对。以下为联调结果，不作为页面常量或测试服务替代数据。

000036，2026-08-20 至 2026-09-04：

| 交易日 | 方向 | 原始模拟成交价（元/股） | 股数 | 成交金额（元） |
| --- | --- | ---: | ---: | ---: |
| 2026-08-20 | 模拟买入 | 4.002 | 24900 | 99649.80 |
| 2026-09-01 | 模拟卖出 | 3.98 | 24900 | 99102.00 |

- `page_size=1` 两页取全两笔，版本一致，无重复；本次 history_version 为 `hist_5b7f52c4a90d786e0b9894dc`。
- 分别查询以上两个交易日，单日与单日区间的 event_id、成交价、成交金额一致。
- action=buy / sell 各返回一笔；000001 无成交；2026年6月区间为空，不补造记录。
- 真实后端返回：过期 history_version → 409；混用单日与区间 → 422；未知策略 → 404。
- 当前 summary 返回 `return_basis=traded_accounts_initial_capital`，确认前端使用后端汇总，未恢复全市场股票数量乘固定本金的算法。

## 验证

- `npm run typecheck` 通过；额外对 `src/app/App.tsx` 入口及依赖进行完整严格 TypeScript 检查，通过。
- `npm test`：50个测试文件，365项通过。包含分页版本、缓存重验、409有限重试、快速切换请求取消、同日多笔、null/0、缺少K线、价格精度、原因隐藏及成交量面板标记生命周期。
- 最后滚动兼容调整后，图表与区间相关4个文件45项测试再次通过。
- `npm run build` 通过。
- Chromium 使用真实业务接口验证：实际买卖箭头位置、画布标记点击、按日期明细、原始成交价、买卖筛选、自定义日期、缩放不产生新成交请求、全屏弹窗、切换到无成交股票，无页面异常。
- 本轮再次实测000036，主图与量柱的买入、卖出标记横坐标分别一致，量柱标记可打开8月20日买入明细，原始成交价仍为4.002。买卖信号页本次50行原始原因均隐藏：40行“不满足”、10行“—”，详情同样不显示原始原因。未修改后端数据或交易状态。
- 浏览器故障注入单独验证 409、404、422、503 和网络中断：错误不伪装为空结果，409最多两次请求；手动重试与一次409后的自动重载均恢复真实接口数据。这里只注入失败状态，不注入成交数据。
- 1440、1280、768、390、320px 下检查展开日期控件与明细弹窗，控件可点击且无新增横向溢出；全屏1600px也已检查。

## 文件清单

| 文件 | 用途 |
| --- | --- |
| `src/app/features/quant/quant-execution-range-types.ts` | v1.2区间、历史及来源日类型 |
| `src/app/features/quant/quant-api.ts` | 区间请求与响应校验 |
| `src/app/features/quant/quant-execution-range.ts` | 固定版本分页、409重载、去重排序 |
| `src/app/features/quant/useQuantExecutionRange.ts` | 缓存、取消、防抖、刷新与错误状态 |
| `src/app/features/chart/execution-markers.ts` | 日期匹配、相对K线标记、原始价格格式化 |
| `src/app/features/chart/useChartExecutions.ts` | 目录、开关、区间筛选与明细状态 |
| `src/app/features/chart/ChartExecutions.tsx` | 筛选条、状态与成交详情 |
| `src/app/features/chart/ProfessionalCandlestickChart.tsx` | 原生图表标记和点击、清理、控件滚动定位 |
| `src/app/components/ui/dialog.tsx` | 可选全屏 Portal 容器，兼容已有弹窗 |
| `src/styles/chart-executions.css`、`src/styles/index.css` | 复用现有视觉变量的紧凑样式 |
| `src/app/features/quant/quant-types.ts`、`quant-detail-fields.ts`、`quant-field-format.ts`、`quant-format.ts` | 补录/本金字段、显示口径和区间错误文案 |
| `src/app/features/quant/QuantCommon.tsx`、`QuantOverview.tsx` | 本金与账户范围标签 |
| `src/app/features/quant/execution-range-test-fixtures.ts` | 仅供自动化测试使用的合成边界样本 |
| `src/app/features/quant/quant-execution-range.test.ts`、`useQuantExecutionRange.test.tsx`、`QuantV11Details.test.tsx` | 区间请求、竞态、异常与金额口径测试 |
| `src/app/features/chart/execution-markers.test.ts`、`ProfessionalCandlestickChart.test.tsx` | 定位、精度、同日成交和图表交互测试 |

当前无需要后端新增接口才能完成的阻塞。后端报告的历史快照数据缺口继续如实显示；前端不填补或推算缺失成交。

# 量化公开接口适配与联调记录

> 本文记录 v1.0 的历史适配。当前展示边界、完整数据模块和验证结果以 [v1.1 适配记录](./2026-09-06-quant-v1.1-api.md) 为准：只隐藏真实策略身份，允许查看接口提供的指标、参数与执行过程。

## 契约来源

指定的三份 Linux 交付文件在当前 Windows 工作区不可访问。本次通过项目已有 `/backend-api` 开发代理读取已配置后端的 `/openapi.json`，核对公开模型、枚举、分页约束及实际响应；确认代理目标端口为 8100。浏览器请求继续复用 `src/app/lib/api.ts` 的 API base URL 和环境配置，没有新增硬编码后端地址。

实际目录只有 `strategy_1`，公开名称为“策略1”，执行类型为 `shadow_simulation`。策略选择器完全使用目录响应；原先的固定策略配置已移除。

## 接入接口

| 接口 | 用途 | 响应读取 |
| --- | --- | --- |
| `GET /api/v1/quant/strategies` | 公开策略目录 | `items`、`total` |
| `GET /api/v1/quant/strategies/{strategy_id}/overview` | 账户资产、累计及当日收益、成交汇总 | `data` |
| `GET /api/v1/quant/strategies/{strategy_id}/performance` | 日度收益率、总资产、累计盈亏曲线 | 分页根对象 |
| `GET /api/v1/quant/strategies/{strategy_id}/observations` | 观察列表 | 分页根对象 |
| `GET /api/v1/quant/strategies/{strategy_id}/signals` | 买卖信号 | 分页根对象 |
| `GET /api/v1/quant/strategies/{strategy_id}/executions` | 当日模拟成交 | 分页根对象 |
| `GET /api/v1/quant/strategies/{strategy_id}/holdings` | 所选日期持仓和估值 | 分页根对象 |
| `GET /api/v1/quant/strategies/{strategy_id}/closed-trades` | 所选交易日完成的平仓 | 分页根对象 |
| `GET /api/v1/quant/strategies/{strategy_id}/daily-results/{trade_date}` | 同一快照的全部业务列表 | `data` |

## 代码变更

- `src/app/features/quant/quant-types.ts`：以线上公开 OpenAPI 模型重建 TypeScript 类型，仅包含公开字段。
- `quant-api.ts`：统一目录、总览、分页、收益历史及完整快照请求；区分响应层级，保留快照元信息，校验分页完整性与策略身份；将 HTTP 错误转为公开提示，不透传后端诊断文字。
- `quant-format.ts`：分离观察和信号状态映射，统一人民币金额、价格、股数、收益率及上海时间。未知状态只展示公开兜底文案，`null` 展示“—”，0 保留。很小的收益率使用四位小数，避免显示成零收益。
- `useQuantSnapshot.ts`：统一总览刷新、取消、快照更新及冲突恢复。以 `snapshot_id` 更新，手动刷新也清理旧列表；最新记录沿用 60 秒轮询和页面可见性处理，指定日期不重复轮询。
- `QuantWorkspace.tsx`：动态策略目录、全局日期选择、实际交易日期、模拟账户标识、补录计算时间与数据状态提示；新增当日平仓入口。
- `QuantCommon.tsx`：账户总览的 15 项指标、数据完整性提示、公共状态展示；移除不属于公开契约的字段处理。
- `QuantOverview.tsx`、`QuantPerformance.tsx`：账户总览、公开最近信号、观察统计和可切换的收益曲线。收益历史逐页读取、按交易日升序，起点不早于 2026-09-03，不补造缺失日期或 null 数值。盘中点在提示和数值表中明确标为非最终收盘记录。
- `QuantRecordsPage.tsx`、`QuantRecordTable.tsx`：复用筛选、分页、表格和排序。默认服务端分页；主动点击排序时获取该筛选条件的全部分页，统一排序后本地分页，保留跨页时间排序能力。
- `QuantSignalsPage.tsx`、`QuantObservationsPage.tsx`、`QuantExecutionsPage.tsx`、`QuantHoldingsPage.tsx`：改为复用公共业务列表。
- `QuantDailyPage.tsx`：完整公开快照中的五种业务列表，校验与总览一致，使用同一套业务列和格式化，不再兼容旧字段别名。
- `src/styles/quant-public.css`、`index.css`：沿用现有视觉风格，适配日期栏、曲线、账户指标与窄屏。`quant.css`、`quant-responsive.css`、`studio.css` 删除已废弃详情的样式。
- 量化测试更新及新增：公开契约、金额和状态、分页排序、取消、日期切换、完整快照、收益历史、目录和 409 恢复。`quant-test-fixtures.ts` 仅被测试引用，不参与正式页面数据来源。
- 删除固定策略配置文件；扫描并清理 `dist/assets` 中 28 份含过期量化信息的旧 JavaScript 产物，当前构建入口保持有效。

## 一致性与展示口径

先获取总览，分页列表只使用总览返回的 `trade_date` 和 `snapshot_id`。切换日期、策略或快照会重建列表；筛选变化重置页码，取消未完成请求，并忽略过期响应。409 由总览统一恢复，自动恢复最多一次；再次冲突清空账户及列表并提示手动刷新，避免无限重试。即使刷新后返回相同快照编号，也会清理旧分页并重新请求。

分页响应缺失、数量不符、快照不符不会被转换为空列表。404、503 等请求错误不展示零收益或虚假的空持仓。`partial`、`closed_partial`、`error` 有可见提示。当前页面没有数据导出入口，也没有量化原始响应调试输出；页面、提示框、状态文案、类型及当前构建不包含已移除的策略内部信息。

累计收益率、持仓收益率和账户当日收益率直接使用对应后端字段；费用不重复扣除。成交金额使用 `notional`；平仓净收益使用 `net_pnl` / `net_return`；持仓当天收益使用 `account_day_pnl` / `account_day_return`。金额均标注人民币元，价格为元/股，数量为股。

## 验证结果

- `npm test`：45 个测试文件、278 项测试全部通过，其中量化模块 72 项。
- `npm run typecheck`：通过。
- 完整应用严格 TypeScript 检查：通过。
- `npm run build`：通过。
- 通过真实浏览器读取目录及全部八个策略业务接口，检查模块切换、日期切换、筛选、分页、跨页时间排序、收益曲线三种指标、未成交 null 字段、空列表和完整日记录，页面没有 JavaScript 异常。
- 股票代码 `000423` 的真实筛选、待成交信号的真实空结果，以及从 2026-09-03 切换回最新记录均验证通过。
- 真实后端对过期快照编号返回 409，对没有正式记录的 2026-09-05 返回 404；自动恢复上限、503、过期响应、取消和多页历史完整性通过测试响应验证，没有修改后端运行状态制造故障。
- 390、768、1024、1280、1440 像素宽度检查无页面横向溢出，日期栏可正常点击。

联调时最新已有交易日为 **2026-09-04**：观察 539 条、信号 217 条、模拟成交 32 条、持仓 46 条、当日平仓 0 条。收益历史只有 **2026-09-03、2026-09-04** 两个正式交易日。当前账户总资产为 554,669,617.11 元，累计盈亏为 -30,382.89 元；这些值直接读取线上公开响应。

## 当前数据限制

没有阻塞本次前端交付的接口问题。后端当前标记为 `historical_replay`、`closed_partial`，2026-09-04 有 5 只股票的数据不完整，页面已明确提示。真实当日平仓列表为空，因此非空平仓展示通过契约测试验证；没有编造平仓或额外历史记录。

# 成交价格标注与价签

## 后续调整：移除左侧悬浮框

按用户反馈删除图内左侧价格框，同时清理组件、专属样式、悬浮预览状态和逐笔视口定位逻辑。保留K线上的买卖原价文本、量柱标记、点击标记查看当日明细及工具栏成交明细入口；同日多笔记录仍在明细中完整展示。交互说明同步更新，不再提示悬浮预览或价签切换。

本次移除后验证：类型检查、完整应用入口严格 TypeScript 检查、生产构建及2个相关测试文件的29项测试通过。真实接口000036的买入4.002、卖出3.98标记保留，浏览器实测点击买入标记可打开8月20日成交明细，全屏下也无左侧价格框或页面异常。

以下是首次实现时的记录，价签相关展示与验证已由上述调整替代。

本轮为现有交易图表的局部优化：保留日K、成交量、红涨绿跌语义、Geist 字体、深浅色和既有成交请求。重点突出成交原价，采用方向色、大号等宽数字及短暂淡入动画，不增加策略参数展示或重新计算成交。

## 展示与交互

- 单笔日K标记直接显示“买入 · ¥原价”或“卖出 · ¥原价”。同日同方向多笔继续显示笔数，逐笔价格在价签内查看，避免编造均价。
- 图内价签默认显示最新一笔记录，列出原始成交价、交易日、上海时间、股数、成交金额和记录序号。
- 悬浮日K或量柱标记更新价签；移开后保留刚查看的成交，方便读取价格与操作。
- 上一笔、下一笔逐笔切换；对应日期在视口外时移动视口。明细按钮打开所属交易日记录。
- 可收起为紧凑价格标签，收起偏好在现有工作区状态中保留。窄屏缩小布局，不增加横向滚动。
- 动效只切换真实记录，不对金额进行从零开始的数字补间。支持减少动态效果及减少透明效果。
- 原价与前复权K线明确区分。标记仍相对K线定位，未把原始成交价当成前复权纵坐标；没有创建错误的成交价水平线。
- 同日多笔、0、null、缺少对应K线记录均保留。关闭成交标记或切换股票时价签随当前请求状态清理。

## 参考

- [TradingView：图上成交历史](https://www.tradingview.com/support/solutions/43000754947-execution-history-on-the-chart/)——成交记录与价格图关联的展示方式。
- [Lightweight Charts：Tooltips](https://tradingview.github.io/lightweight-charts/tutorials/how_to/tooltips)——通过 crosshairMove 更新图内 HTML 信息。
- [Lightweight Charts：Series Markers](https://tradingview.github.io/lightweight-charts/tutorials/how_to/series-markers)——继续复用现有原生标记能力。

## 变更文件

- `src/app/features/chart/ExecutionPriceCard.tsx`：图内价格、逐笔导航、展开收起。
- `src/app/features/chart/useChartExecutions.ts`：按成交组保存悬浮预览，隔离过期结果。
- `src/app/features/chart/ProfessionalCandlestickChart.tsx`：事件联动、价签挂载及交易日视口定位。
- `src/app/features/chart/execution-markers.ts`：主图原价文本与量柱紧凑标记。
- `src/app/features/chart/ChartExecutions.tsx`：交互说明。
- `src/styles/chart-executions.css`：方向色、数字层级、微动效、深浅色和窄屏适配。
- `src/app/features/chart/execution-markers.test.ts`、`ProfessionalCandlestickChart.test.tsx`：价格精度、0/null、悬浮预览、逐笔切换、收起恢复和清理验证。

## 验证

- 类型检查、完整应用入口的严格 TypeScript 检查、生产构建通过。
- 全量50个测试文件、368项测试通过。
- 真实接口000036：图上买入标记4.002、卖出标记3.98，与成交详情一致。
- Chromium 实测悬浮后保持可读、上一笔/下一笔、打开明细、收起恢复、全屏、深浅色，以及768/390/320px布局，无页面异常。
- 业务数据来自现有区间接口；没有新增 mock 成交、策略计算、外部依赖或后端请求。

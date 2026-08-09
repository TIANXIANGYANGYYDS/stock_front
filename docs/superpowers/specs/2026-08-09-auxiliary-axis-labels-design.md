# 副图右轴尾标精简设计

## 问题

成交量与技术指标序列设置了 `title`。Lightweight Charts 5.2 即使在 `lastValueVisible: false` 时也会单独绘制标题尾标，导致 `VMA10 / VMA5 / VOL / DIF / DEA / HIST` 覆盖最近的数据。

## 设计

- 所有副图序列不再传入 `title`，继续保持 `lastValueVisible: false` 和 `priceLineVisible: false`。
- 副图右侧数值刻度保留；十字光标、顶部固定指标图例和曲线颜色保留。
- 主图蜡烛最新价格标签保持不变。
- 不引入 CSS 遮挡、标签错位或新的悬停状态。

## 验证

组件边界测试确认所有副图序列配置都没有非空 `title`，同时主图仍显示最新价格。最后运行全量测试、构建和实际页面截图检查。

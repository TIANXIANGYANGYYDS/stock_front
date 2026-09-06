# 现代 CSS 交互增强 · 2026-09-05

在现有视觉样式和紧凑表格基础上，增加帮助用户感知主题变化、阅读位置和内容展开的交互效果。接口、行情数据、分析文本和排序逻辑保持原有行为，没有新增动画依赖。

## 实现

- **主题圆形扩散**：从主题按钮中心展开新主题，420ms 完成。使用原生 View Transition API 捕获画面，CSS `clip-path: circle()` 控制扩散；React 同步提交主题颜色，已有 K 线实例继续保留。连续点击会跳过当前动画，并正确处理每次切换和本地存储。
- **阅读进度**：新闻详情、博主分析和原始内容加入顶部细线。CSS `animation-timeline` 根据滚动距离更新，桌面跟随阅读面板，手机博主阅读跟随页面。无需滚动事件监听；内容无需滚动时不显示虚假进度。修正手机祖先容器的 overflow，使指示线保持可见，并让桌面指示线贴边、不穿过正文。
- **平滑展开**：博主“原文依据与有效期”和量化数据质量说明使用 `interpolate-size`、`::details-content` 与离散可见性过渡，支持未知内容高度；保留原生 details/summary 操作。
- **定位反馈**：点击分析标的后，对定位到的观点短暂高亮，保留焦点边线，帮助用户找到对应分析。

## 兼容与可访问性

新 CSS 均通过 `@supports` 渐进启用。浏览器没有 View Transition API，或者原生切换启动失败时，直接切换主题。系统设置“减少动态效果”时，跳过主题快照、展开动画与阅读进度动画。进度条属于装饰元素，对辅助技术隐藏。

主要实现：`src/styles/reading-motion.css`、`src/app/hooks/useAppearance.tsx`、`src/app/components/ReadingProgress.tsx`。

## 官方资料

- [MDN：使用 View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)
- [MDN：使用 CSS 实现滚动进度动画](https://developer.mozilla.org/en-US/blog/scroll-progress-animations-in-css/)
- [Chrome：动画过渡到自动高度](https://developer.chrome.com/docs/css-ui/animate-to-height-auto)
- [Chrome：details 样式与展开动画](https://developer.chrome.com/blog/styling-details)

## 验证

- 全量 40 个测试文件、230 项测试通过，生产构建通过。
- 项目 `npm run typecheck` 通过；应用入口及主题测试的额外严格 TypeScript 检查通过。额外把历史图表测试文件纳入严格检查时，仍存在可选 kline 和隐式 any 类型问题，本轮未改动相关断言。
- 新增主题快照完成后的清理、减少动态效果、原生 API 启动失败、快照尚未完成时连续点击四类回归测试。
- Chromium 连接真实后端验证主题扩散、K 线 canvas 实例保留、连续切换、偏好持久化和不支持 API 时的回退。
- 验证桌面博主阅读进度从 0%、约 50% 到 100%，手机滚动时指示线保持在可视区域顶部；原文展开存在中间高度，展开/折叠及观点焦点正确。
- 新闻在 1440px 桌面、320/390/720/959px 窄屏验证进度、短文不产生虚假进度、无横向溢出和 Escape 关闭；博主原文在 320–1440px 七档宽度无页面横向溢出。
- 上述浏览器检查未发现运行时错误。

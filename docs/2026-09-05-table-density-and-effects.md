# 紧凑表格与 CSS 光效 · 2026-09-05

## 表格

此前持仓表最小宽度为 1900px，成交表为 1360px，信号表为 1220px，所有时间字段强制保持单行，导致常用桌面也必须左右拖动才能看到完整数据。

本轮去掉这些固定最小宽度。量化总览、观察池、信号、成交、持仓以及历史日结果中的三种表格统一铺满可用宽度：缩小列间距、允许表头换行，日期与时刻分行，价格、金额与收益率保持原来的格式和精度。

容器宽度不足 900px 时，每条记录改为四列字段网格；不足 520px 改为两列。每项数据带对应的字段名称，表头仍作为排序按钮显示。保留完整数据、表格语义、键盘排序和撮合尝试展开，移除“左右滑动查看更多列”提示和相关监听。手机量化子导航也允许换行。

## 光效

- 导航选中态使用渐变边框，鼠标悬停时播放一次边框流光。
- 行情卡片增加随涨跌颜色变化的高光线与柔和阴影。
- 主查询按钮增加单次扫光，关键指标提供高光与短线反馈。
- 博主核心摘要及盘前研判使用主题渐变，增强重点内容的辨识度。
- 弹窗加入短距离淡入；系统开启“减少动态效果”时禁用动画和过渡。
- 所有效果由 CSS 实现，适配深浅模式，不新增动画依赖。半透明材质提供减少透明效果的回退。

实现文件：`src/styles/quant-responsive.css`、`src/styles/effects.css`、`QuantCommon.tsx` 和各量化表格组件。

技术依据：[CSS 容器查询](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries)、[color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix)、[backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)。

## 验证

- 全量 226 项测试通过，生产构建及项目 TypeScript 检查通过。
- 新增跨午夜的上海时间显示、无效时间占位回归测试。
- Chromium 连接真实后端检查六个量化入口，共十一档宽度：320、390、720、959、960、1024、1126、1280、1440、1600、1920px。表格和单元格均无横向溢出。
- 检查窄屏排序按钮、撮合详情展开、两种主题和减少动态效果；未发现浏览器运行时错误。

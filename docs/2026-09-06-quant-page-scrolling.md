# 量化页面滚动与分页调整

量化页采用浏览器整页纵向滚动。去掉桌面页面主体、业务内容区和数据表的独立滚动限制；表格按当前页实际记录展开，窄屏继续使用现有带字段标签的记录布局。

普通分页列表和当日完整记录均在列表顶部、底部提供分页，显示当前记录范围。翻页、修改每页条数、排序或提交筛选后，将阅读位置与键盘焦点移到结果区开头；异步加载结束后重新对齐，避免停在新页面底部。首次加载不自动跳入表格。切换量化模块回到模块导航所在位置。

变更文件：

- `src/styles/quant-public.css`：整页滚动、分页布局与结果定位。
- `src/styles/quant.css`：移除表格高度限制和滚轮拦截。
- `src/app/features/quant/QuantCommon.tsx`：共享结果区与上下分页，替换内层滚动容器。
- `src/app/features/quant/QuantRecordTable.tsx`：移除内部滚动重置逻辑。
- `src/app/features/quant/QuantRecordsPage.tsx`：分页接口列表接入共享结果区。
- `src/app/features/quant/QuantDailyPage.tsx`：完整记录内的业务列表接入相同交互。
- `src/app/features/quant/QuantWorkspace.tsx`：模块切换时定位页面。
- `src/app/features/quant/QuantListUsability.test.tsx`：增加底部分页、异步加载完成后滚动与焦点回归验证。

验证：

- `npm run typecheck`、`npm run build` 通过。
- `npm test -- --run`：47 个测试文件、341 项测试通过。
- 通过现有开发代理连接真实接口，在 1440、1280、768、390 像素宽度验证逐股账户列表。各宽度均无页面横向溢出、无正文或表格内层滚动；滚轮移动 420 像素时文档同步移动 420 像素。
- 从底部切到第 2 页后，结果区距视口顶部约 16 像素，首条记录可见；详情弹窗关闭后保留文档位置。
- 验证当日完整记录分页、总览进入信号页、切到资讯页、浏览器返回、每页 20 条与跳转第 3 页。

本次浏览器检查使用后端返回的真实记录，没有替换接口响应。无实际阻塞。

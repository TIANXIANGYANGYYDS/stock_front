# 量化页面手机适配与加载兼容

## 问题与修复

- 手机布局原先将11个量化入口换成多行按钮，滚动固定后占用过多高度。700px及以下改用同一份导航目录生成的原生功能选择器，与策略选择并排；保留全部入口和路由行为。390px视口导航高度从170px缩至82px。
- 手机交易日期选择后直接加载，最新日期仍来自接口。去掉手机上重复的确认、返回最新按钮，保留日期中的“最新”选项和44px刷新按钮；桌面原有按钮保留。切换功能继续沿用当前日期与快照。
- 收益历史、全量列表和图表成交区间曾直接调用`signal.throwIfAborted()`。浏览器缺少该方法时，在发出收益请求前就会抛出异常，被页面显示成“交易日期与收益历史加载失败”。新增统一取消检查，使用`aborted`并保留取消原因；没有`reason`时抛出`AbortError`。没有取消检查的空操作降级，也不新增业务数据或改变重试规则。

API语义参考：[MDN AbortSignal.throwIfAborted](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted)。

## 修改文件

- `src/app/features/quant/QuantWorkspace.tsx`：手机导航、日期直接加载及刷新按钮。
- `src/styles/quant-public.css`：手机导航网格、44px触控区域和16px选择控件。
- `src/app/lib/abort-signal.ts`：兼容旧浏览器的统一请求取消检查。
- `src/app/features/quant/quant-records.ts`、`quant-execution-range.ts`：替换不兼容的方法调用。
- `QuantWorkspace.test.tsx`、`quant-performance.test.ts`、`quant-records.test.ts`、`quant-execution-range.test.ts`：手机日期和功能切换、旧浏览器加载和分页取消回归。

## 验证结果

- 通过现有开发代理实际读取策略目录、总览和收益历史：均200，收益历史返回12个交易日。业务数据没有替换成mock。
- 浏览器移除`AbortSignal.prototype.throwIfAborted`可在修复前复现截图相同的错误；修复后同时移除该方法及`reason`仍能正常加载历史、总览和持仓。
- Chromium手机模式验证历史日期切换、功能切换保留日期、导航滚动固定于顶部、前进后退、手机与桌面布局切换和深浅色切换。
- 检查320、360、390、430、700、768、1280px宽度，无页面横向溢出；手机导航高度82px。
- 仅对收益请求注入网络失败，页面保留错误提示、禁用无效日期、清除旧数据；恢复真实网络后手动重试成功。
- 类型检查、完整应用入口严格TypeScript检查、生产构建通过。全量50个测试文件、372项测试通过。

用户截图的手机网址与浏览器内核尚未确认；目前证实的是一个能复现同样症状的兼容问题。尚未核验用户手机实际访问的部署地址，也未推送或发布部署。

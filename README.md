# 综合股票决策终端

面向 A 股行情观察的专业交易台，唯一数据源为 `Stock_Project`。顶部固定展示大盘指数身份，决策工作台用于检索个股和切换日线、分钟线蜡烛图，市场洞察、实时资讯与博主观点作为互不跳转的独立工作区。

## 主要能力

- 专业 K 线：可切换日线与分钟线，支持红涨绿跌、十字光标、区间缩放和全屏；MA/BOLL 按真实字段显示，成交量、MACD、KDJ、RSI、CCI、WR、ATR 可同时开启多个副图且不重建主图
- 实时个股：当前已部署的个股实时路由提供最新报价快照；只有后端返回带真实 `timestamp` 和 OHLC 的当日分钟项时才绘制完整分钟 K，前端不累计历史、不从快照合成 K 线
- 个股导航：按最新交易日成交额展示股票池，支持代码/名称检索，选择后只更新该股票的行情、K 线和指标
- 行情快照：随十字光标交易日同步 OHLC、涨跌、成交、换手和全部可用技术指标；展示获利比例、平均成本、70%/90%成本区间及后端筹码 XY 分布图
- 市场洞察：Stock_Project 盘前分析以详情弹窗阅读；投资倾向和新闻热力均支持 1 小时、1 天、3 天、7 天快照窗口
- 新闻情报：支持当日、3 天、7 天范围，利好/利空过滤，以及按分数或时间正序/倒序排列
- 博主观点：展示真实 A 股相关作品、结构化观点、原始内容和历史验证；准确率排行同时标注有效样本与待验证数量，空评分不会显示为 0 分

## 本地运行

```bash
npm install
copy .env.example .env.local
npm run dev
```

浏览器访问 `http://localhost:5188/`。端口已固定为 5188，并启用严格端口检查，不会占用另一个前端正在使用的 5173。生产构建与测试：

```bash
npm test
npm run build
```

## 后端配置

前端统一请求 `/backend-api`，Vite 会将其代理到 `VITE_API_PROXY_TARGET`：

```env
VITE_API_PROXY_TARGET=http://39.106.202.228:8100
```

行情工作区唯一业务日期来自 `GET /api/v1/market/latest-trade-date` 的 `data.latest_trade_date`。该请求完成前不会挂载行情、板块排行、盘前分析或资讯查询；返回空值或请求失败时会停止后续日期请求并展示明确状态，不会使用 `/stats`、`latest` 路由或浏览器当天日历日期回退。博主观点属于周末和收盘后仍会更新的实时内容，可独立进入，并按作品实际发布时间筛选，不受最新交易日截断。

当前接入 `Stock_Project` 的只读接口：

- `GET /api/v1/market/latest-trade-date`
- `GET /api/v1/stats`
- `GET /api/v1/news`
- `GET /api/v1/news-rankings?biz_date={trade_date}`
- `GET /api/v1/morning-analyses/{trade_date}`
- `GET /api/v1/stocks`
- `GET /api/v1/stocks/{code}/daily`
- `GET /api/v1/stock-daily/{trade_date}`
- `GET /api/v1/stocks/realtime`
- `GET /api/v1/stocks/{code}/realtime`
- `GET /api/v1/creator-accounts`
- `GET /api/v1/creator-works`
- `GET /api/v1/creator-works/{work_key}`
- `GET /api/v1/creator-opinion-analyses`
- `GET /api/v1/creator-opinion-analyses/{creator_id}`

`/stocks/{code}/daily` 返回的 OHLC、量均线、MA、MACD、BOLL、KDJ、RSI、CCI、WR、ATR 与筹码字段用于绘制蜡烛图、多副图和联动行情快照。筹码图直接使用同一交易日 `chip.chart.x/y`。当前已部署的 `/stocks/realtime` 与 `/stocks/{code}/realtime` 返回 `price/source_time` 最新报价快照，并不等同于分钟 K；完整当日分钟图只会在后端返回真实 `timestamp/open/high/low/close` 序列时显示。前端不把快照价格复制为 OHLC、不伪造时间戳、不累计或合成分钟历史，也不自行推导指标、不接入第三方行情、不补造样例数据，不生成单股研判、推荐或交易价位。顶部大盘指数在闭市后仍保留最近一次成功的行情，并标注“已闭市”和“最后行情”。`Stock_Project` 后端可在其项目目录启动：

```bash
uvicorn app.api.app:create_app --factory --host 0.0.0.0 --port 8100
```

开发环境默认通过公网地址 `http://39.106.202.228:8100` 访问 Stock_Project。`npm run dev` 只启动前端；接口不可用时，界面会展示明确的失败或空状态，不会伪造行情。

接口契约以 [`Stock_Project/docs/API.md`](https://github.com/TIANXIANGYANGYYDS/Stock_Project/blob/main/docs/API.md) 为准。

## 关键目录

- `src/app/features/chart`：K 线数据规范化与图表实现
- `src/app/features/decision`：个股检索、K 线与行情快照三栏工作台
- `src/app/features/market`：市场洞察工作区
- `src/app/features/news`：新闻情报工作区
- `src/app/features/creators`：博主评分排行、观点流、详情与验证状态
- `src/styles/terminal.css`：终端视觉系统与响应式布局
  

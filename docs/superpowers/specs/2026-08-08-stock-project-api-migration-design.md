# Stock Project API Migration Design

## Goal

Migrate the stock decision terminal from the retired `daily_pe_reporter` dashboard API to the read-only query API in `TIANXIANGYANGYYDS/Stock_Project`, while preserving the professional three-column UI and rendering candlesticks exclusively from persisted `stock_daily_detail` records.

## Source API

The backend listens on `0.0.0.0:8100`; the same-machine Vite proxy connects through `http://127.0.0.1:8100`. The frontend may use only these Stock Project endpoints:

- `GET /api/v1/health`
- `GET /api/v1/stats`
- `GET /api/v1/news`
- `GET /api/v1/news-rankings/latest`
- `GET /api/v1/morning-analyses/latest`
- `GET /api/v1/stocks`
- `GET /api/v1/stocks/{code}/daily`
- `GET /api/v1/stock-daily/{trade_date}`

## Architecture

Keep `src/app/lib/api.ts` as an anti-corruption layer. Raw Stock Project documents are parsed into the existing UI-facing types, so chart, news, ranking, and workspace components remain independent from Mongo field names. Pure mapper functions are exported and unit-tested.

The retired endpoints are removed completely. No compatibility request is sent to `/market/indices`, `/news/recent`, `/morning-analysis`, `/rankings/*`, or `/sector-stock-analysis`.

## Data Mapping

### Terminal header

`/stats` supplies the latest trade date and system counts. `/stock-daily/{latest_trade_date}?sort_by=pct_chg&sort_order=desc&page_size=5` supplies five real market movers. The strip label changes from index overview to latest market data. No index values are fabricated because Stock Project currently exposes no index endpoint.

### Sector rankings

`/news-rankings/latest` contains both `investment_ranking` and `heat_ranking`. `final_score`, `news_count`, positive/negative counts, and `latest_publish_ts` map to the radar and market insight types. The new API provides a current snapshot rather than history arrays; each chart series therefore contains one dated point instead of invented history.

### Sector-to-stock resolution

For the selected sector, request `/news?sector_name=...&status=finished&page_size=100`. Collect company names from the matching `sector_llm_analysis` entry. Resolve each unique company through `/stocks?keyword=...`, then request `/stocks/{code}/daily?page_size=120&adjust=qfq` for up to four unique stocks.

Daily rows are sorted by the existing chart normalizer. The latest row supplies OHLC, change, amount, turnover, indicators, and chip data. If a sector has no resolvable company, return an empty list with an explicit UI state instead of unrelated fallback stocks.

### Technical decision

Stock Project does not expose per-stock AI buy/stop/take conclusions. The frontend derives a transparent technical-rule assessment from persisted data:

- bullish/watch when price and MA alignment are positive;
- bearish/sell when price and MA alignment are negative;
- hold otherwise;
- entry uses the latest close;
- stop uses the lowest low of the most recent five valid bars;
- take-profit uses recent risk distance at a 2:1 reward/risk ratio;
- the panel copy identifies the result as technical-rule analysis, not backend AI output.

Missing inputs produce `null` levels and neutral conclusions.

### News

`/news` already supports keyword, source, sector, and pagination. Sentiment and impact are derived from the strongest absolute sector score in `sector_llm_analysis`; companies and sectors come from the same entries. Sentiment filtering and impact sorting remain client-side because the backend does not expose those query parameters.

### Morning analysis

`/morning-analyses/latest` maps `analysis.mainlines`, `analysis.market_style`, `market_bias`, `risk_level`, and `risk_summary` into the market view. Mainline role and confidence are preserved in the reason text.

## Error Handling

Network errors include the HTTP status and backend `detail` when available. Health and data errors remain panel-local. A missing backend produces the existing offline and empty states; it never triggers mocked market values.

## Testing

Unit tests cover Stock Project news mapping, ranking mapping, daily-bar mapping, technical decision derivation, and sector company extraction. Existing K-line normalization and decision-state tests remain green. Production build plus a mock Stock Project API browser smoke test verifies the complete rendering path.

## Non-goals

- No modification or deployment of `Stock_Project`.
- No client-side fabrication of market indices or historical ranking series.
- No minute K-line until the backend exposes a minute-data query endpoint.

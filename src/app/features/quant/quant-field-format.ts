import { formatQuantDateTime, formatQuantDecimal, formatQuantMoney, formatQuantNumber, formatQuantPrice, formatQuantRatio, quantDataStatusPresentation, quantDetailPresentation, quantObservationPresentation, quantPositionPresentation, quantStatusPresentation, recordingLabel } from './quant-format';
import { formatQuantReason, isQuantReasonField } from './quant-format';

export const QUANT_FIELD_LABELS: Record<string, string> = {
  reference_price_method: '历史参考价格口径', historical_bar_policy: '历史行情柱取数规则', history_rebased_at: '历史重建时间（非成交时间）',
  historical_bar_source_counts: '历史行情柱来源计数', historical_reference_counts: '历史参考价格来源计数',
  captured_quote_reference: '已采集报价参考', captured_minute_quotes: '已采集分钟行情',
  id: '公开编号', name: '名称', code: '股票代码', execution_kind: '成交类型', version: '版本', schema_version: '数据结构版本',
  macd_parameters: 'MACD 参数', intraday_interval: '盘中周期', minimum_shrink_ratio: '最小收缩比例', confirmation_bars: '所需确认柱数',
  buy_filter: '买入过滤条件', indicator: '指标', period: '周期', minimum: '最低阈值', comparison: '比较条件', cutoff: '取数截止口径',
  exit_policy: '退出规则', recording_start_date: '正式记录起点', mode: '运行方式', initial_cash_per_stock: '每股独立账户初始本金',
  slippage_rate: '滑点比例', commission_rate: '佣金费率', stamp_duty_rate: '印花税率', lot_size: '每手股数', settlement: '交收约定', price_limit: '涨跌停成交约定',
  data_status_detail: '数据细分状态', data_status: '数据质量', last_complete_bar_at: '最近完整行情柱时间', next_evaluation_at: '下次评估时间',
  expected_complete_bar_count: '预期完整行情柱数', bars_per_complete_day: '完整交易日柱数', complete_observation_count: '完整观察数', incomplete_observation_count: '不完整观察数',
  tracked_code_count: '跟踪股票数', source: '行情来源', preparation_quality: '准备数据质量', resource_limits: '运行资源限制', observation_state_counts: '运行观察细分计数',
  last_error: '最近错误说明', last_error_at: '最近错误时间', evaluated_at: '评估时间', last_valuation_at: '最近估值时间', incomplete_code_count: '不完整股票数', incomplete_codes: '不完整股票代码',
  daily: '日线来源', intraday: '盘中来源', intraday_source_interval: '原始盘中周期', strategy_interval: '计算周期', adjustment: '复权口径',
  stock_count: '股票总数', eligible_stock_count: '符合选股范围数量', stale_daily_count: '日线过期数量', insufficient_history_count: '历史不足数量', adx_weak_or_missing_buy_observation_count: '趋势弱或缺失的买入观察数',
  tracked_codes: '跟踪股票数', max_tracked_codes: '跟踪股票上限', max_daily_bars_per_code: '每股日线柱上限', max_minute_rows_per_code: '每股分钟数据上限', max_three_minute_bars_total: '三分钟行情柱总上限', mongo_stream_batch_size: '数据读取批量', latest_mark_query_batch_size: '估值查询批量',
  start_date: '记录起点', market_data_trade_date: '行情交易日', computed_at: '计算时间（非成交时间）', data_kind: '行情类型', strategy_version: '策略版本',
  watching_count: '观察中数量（账户汇总）', not_triggered_count: '未触发数量', sell_candidate_count: '卖出候选数', realized_return: '累计已实现收益率（全账户）',
  gross_unrealized_pnl: '当前持仓毛浮盈亏', gross_unrealized_return: '当前持仓毛浮动收益率', unrealized_return: '未实现收益率',
  holding_market_day_pnl: '持仓相对昨收盈亏', holding_market_day_return: '持仓相对昨收涨跌幅', open_position_account_day_pnl: '未平仓部分账户当日盈亏', open_position_account_day_return: '未平仓部分账户当日收益率',
  closed_position_account_day_pnl: '已平仓部分账户当日盈亏', closed_position_account_day_return: '已平仓部分账户当日收益率', return_basis: '总收益率分母口径', account_count: '独立账户数',
  initial_capital: '初始本金', capital_inflow: '当日新增本金（非盈利）', cash_balance: '现金余额', market_value: '持仓市值', total_assets: '总资产', total_pnl: '累计净盈亏', total_return: '累计净收益率', realized_pnl: '累计已实现盈亏', unrealized_pnl: '当前浮盈亏',
  account_day_pnl: '账户当日盈亏', account_day_return: '账户当日收益率', observation_count: '观察记录数', preselection_count: '买入预选数', buy_count: '当日买入笔数', sell_count: '当日卖出笔数', holding_count: '持仓股票数',
  t1_locked_holding_count: 'T+1 锁定持仓数', closed_trade_count: '当日平仓数', signal_count: '信号数', pending_signal_count: '待成交信号数', rejected_signal_count: '未执行信号数',
  buy_notional: '当日买入金额', sell_notional: '当日卖出金额', turnover: '当日总成交金额', total_fees: '总费用', net_cash_flow: '当日净现金流', has_position: '是否持仓', shares: '数量', marked_at: '估值时间',
  reason: '原因', observation_before_date: '观察前一交易日', observation_date: '观察日期', reference_histogram: '参考柱值', provisional_dif: '盘中 DIF', provisional_dea: '盘中 DEA', provisional_histogram: '盘中柱值',
  shrink_ratio: '收缩比例', adx_14: 'ADX14', adx_14_3_days_ago: '三个市场交易日前 ADX14', factor_completed_date: '指标完成日期', factor_comparison_date: '指标比较日期',
  state_detail: '观察细分状态', condition_met: '条件是否满足', consecutive_confirmations: '连续确认次数', required_confirmations: '所需确认次数', adx_buy_allowed: '趋势条件允许买入', adjustment_factor: '复权因子', exit_state: '退出状态',
  action: '动作', state: '观察通用状态', signal_id: '信号编号', status_detail: '信号细分状态', confirmation_count: '确认次数', execution_reference_price: '参考成交价', attempt_count: '累计执行尝试次数', attempts: '已保存执行尝试',
  exit_reason: '退出原因', deferred_from: '延期起点', estimated_net_return: '估算净收益率（非已实现）', status: '状态', signal_at: '信号时间', signal_price: '信号价', execution_at: '模拟成交时间', execution_price: '模拟成交价',
  attempt_at: '尝试时间', execution_bar_end_at: '成交行情柱结束时间', reference_open: '参考开盘价', daily_price_limit: '当次涨跌停价格', execution_price_source: '成交价格来源', previous_close: '前收盘价',
  execution_bar_low: '成交行情柱最低价', execution_bar_high: '成交行情柱最高价', event_id: '成交编号', notional: '成交金额', commission: '佣金', stamp_duty: '印花税', cash_flow: '现金流',
  entry_signal_at: '买入信号时间', entry_signal_price: '买入信号价', entry_reference_price: '买入参考价', gross_total_pnl: '持仓毛盈亏', gross_total_return: '持仓毛收益率',
  entry_event_id: '买入成交编号', entry_execution_at: '建仓成交时间', entry_execution_price: '买入成交价', entry_notional: '买入成交金额', buy_commission: '买入佣金', cost_basis: '含费持仓成本', mark_price: '估值价',
  market_day_pnl: '股票相对昨收盈亏', market_day_return: '股票相对昨收涨跌幅', sellable_today: '今日可卖', t1_locked: 'T+1 锁定', exit_signal_at: '卖出信号时间', exit_signal_price: '卖出信号价', exit_reference_price: '卖出参考价',
  exit_event_id: '卖出成交编号', exit_execution_at: '卖出成交时间', exit_execution_price: '卖出成交价', exit_notional: '卖出成交金额', sell_commission: '卖出佣金', gross_pnl: '毛盈亏', net_pnl: '净盈亏', net_return: '净收益率',
  reference_price: '参考价格', at: '记录时点', entry_at: '建仓时间', state_before: '判断前状态', state_after: '判断后状态', original_sell: '原始卖出条件', adx_state: 'ADX 趋势状态', adx: 'ADX', adx_3_days_ago: '三个市场交易日前 ADX',
  allow_delay: '允许延期', data_anomaly: '数据异常', quote_price: '判断报价', quote_net_proceeds: '估算卖出净收入', entry_cost: '建仓含费成本', stage: '运行阶段',
};

const VALUE_LABELS: Record<string, string> = {
  captured_or_validated_daily_change_reference: '已采集参考价或经验证的日涨跌参考价',
  complete_observed_day_else_verified_historical_day: '优先完整已观测交易日，否则使用经验证的历史交易日',
  shadow_simulation: '模拟成交', shadow: '模拟运行', historical_replay: '真实历史行情补录', live: '实时运行', unknown: '未注明',
  explicit_reference_price_with_bounded_slippage: '明确参考价，滑点受行情区间约束',
  limit_up_buy_cancelled_and_limit_down_sell_deferred: '涨停取消买入，跌停延期卖出',
  next_3m_bar_open: '下一根三分钟行情柱开盘价', previous_completed_day: '前一完整交易日',
  previous_close_ratio_to_qfq_state: '按前收盘比例对应前复权状态', all_independent_accounts_initial_capital: '全部独立账户初始本金',
  traded_accounts_initial_capital: '曾实际买入账户的初始本金（含已清仓账户）',
  after_close_selection: '收盘后选股', intraday_monitoring: '盘中监控', daily_close: '日终记录', completed: '已完成',
  HOLDING: '持有中', holding: '持有中', hold: '继续持有', buy: '买入', sell: '卖出', strong: '强', weak: '弱',
};
const MONEY_FIELDS = new Set(['initial_cash_per_stock', 'initial_capital', 'capital_inflow', 'cash_balance', 'market_value', 'total_assets', 'cost_basis', 'notional', 'commission', 'stamp_duty', 'total_fees', 'cash_flow', 'net_cash_flow', 'turnover', 'buy_commission', 'sell_commission', 'quote_net_proceeds', 'entry_cost']);
const PRICE_FIELDS = new Set(['previous_close', 'daily_price_limit', 'reference_open', 'execution_bar_low', 'execution_bar_high']);
export const isQuantMoneyField = (key: string) => MONEY_FIELDS.has(key) || key.endsWith('_pnl') || key.endsWith('_notional');
export const isQuantPriceField = (key: string) => PRICE_FIELDS.has(key) || key.endsWith('_price');
export function quantFieldLabel(key: string): string {
  const unit = isQuantMoneyField(key) ? '（元）' : isQuantPriceField(key) ? '（元/股）' : key === 'shares' || key === 'lot_size' ? '（股）' : '';
  return `${QUANT_FIELD_LABELS[key] ?? key}${unit}`;
}
export function formatQuantField(key: string, value: unknown, model?: string): string {
  if (isQuantReasonField(key)) return formatQuantReason(value);
  if (key === 'has_position') return quantPositionPresentation(typeof value === 'boolean' ? value : null).label;
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') {
    if (key.endsWith('_return') || key.endsWith('_rate') || key === 'shrink_ratio' || key === 'minimum_shrink_ratio') return formatQuantRatio(value);
    if (isQuantPriceField(key)) return formatQuantPrice(value);
    if (isQuantMoneyField(key)) return formatQuantMoney(value);
    if (key.endsWith('_count') || key === 'shares') return formatQuantNumber(value);
    return formatQuantDecimal(value);
  }
  if (typeof value !== 'string') return '—';
  if (key.endsWith('_at') || key === 'at' || key === 'deferred_from' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return formatQuantDateTime(value);
  if (key === 'mode' && model === 'Recording') return recordingLabel(value as 'unknown');
  if (key === 'state_detail' || key === 'status_detail') return quantDetailPresentation(value).label;
  if (key === 'state' && model === 'Observation') return quantObservationPresentation(value).label;
  if (key === 'status' && (model === 'Signal' || model === 'Execution')) return quantStatusPresentation(value).label;
  if (key === 'data_status') return quantDataStatusPresentation(value).label;
  if (key === 'data_status_detail') {
    const known = quantDataStatusPresentation(value);
    return known.label === '状态待更新' ? value : known.label;
  }
  if (key === 'status' && (model === 'Candidate' || model === 'ExecutionAttempt')) return quantDetailPresentation(value).label;
  // Remaining values are plain text, never interpreted as markup or synthesized identities.
  return Object.hasOwn(VALUE_LABELS, value) ? VALUE_LABELS[value] : value;
}

import type { Emotion, EmotionState, SentimentEvent, SentimentSnapshot, SentimentStock, SentimentTheme } from './sentiment-model';
import { createDemoSecondSeries, DEMO_SECONDS_START } from './sentiment-seconds-demo';

// All values in this module are fictional UI fixtures, never a feed or a trading signal.
export const DEMO_DATE = '2026-10-14';
const time = (clock: string) => `${DEMO_DATE}T${clock}+08:00`;
const emotion = (state: EmotionState, previous: EmotionState, direction: Emotion['intraday_change'], evidence: string[], counter: string[]): Emotion => ({
  state, previous_state: previous, intraday_change: direction, status: '已确认', extreme_tag: null,
  state_since: time('13:15:00'), evidence, counter_evidence: counter,
});
const themes: SentimentTheme[] = [
  { theme_id: 'aerospace', name: '商业航天', subtitle: '卫星互联网 · 航天制造', member_count: 86, coverage: 1, yesterday_premium: .0432,
    emotion: emotion('主升', '扩散发酵', '改善', ['高位连板延续，低位首板补充。', '昨日涨停群体今日涨幅中位数 +4.32%。'], ['高位个股换手增加，仍需观察封板稳定性。']), trend: [3, 3, 4, 3, 5, 6, 5, 7, 7, 8] },
  { theme_id: 'computing', name: 'AI 算力', subtitle: '算力基础设施 · 液冷', member_count: 142, coverage: .993, yesterday_premium: .0268,
    emotion: emotion('扩散发酵', '试错整理', '改善', ['首板家数增加，强势向基础设施环节扩散。', '昨日涨停群体反馈保持正向。'], ['新晋首板占比较高，接力持续性有待确认。']), trend: [2, 3, 2, 4, 3, 5, 6, 6, 7, 8] },
  { theme_id: 'robotics', name: '人形机器人', subtitle: '执行器 · 精密传动', member_count: 118, coverage: 1, yesterday_premium: .0176,
    emotion: emotion('主升中分歧', '主升', '平稳', ['连板核心仍在，低位补涨出现。', '高位分化，部分触板股暂未回封。'], ['午后仍有回封，尚未形成一致退潮。']), trend: [3, 4, 6, 7, 6, 5, 7, 6, 7, 8] },
  { theme_id: 'battery', name: '固态电池', subtitle: '新型电池 · 材料升级', member_count: 65, coverage: 1, yesterday_premium: .0215,
    emotion: emotion('扩散发酵', '试错整理', '改善', ['材料端与设备端同时出现首板。', '涨停股不再集中于单一环节。'], ['高度仍低于市场主线。']), trend: [1, 2, 2, 3, 2, 4, 4, 6, 7, 8] },
  { theme_id: 'semiconductor', name: '半导体', subtitle: '国产设备 · 先进封装', member_count: 176, coverage: .989, yesterday_premium: .0083,
    emotion: emotion('退潮中修复', '退潮', '改善', ['昨日强势股反馈转正。', '午后回封增多，当前未封住数量减少。'], ['反弹覆盖仍不充分，高位延续尚未确认。']), trend: [6, 5, 4, 3, 4, 3, 4, 5, 6, 8] },
  { theme_id: 'consumer', name: '大消费', subtitle: '零售 · 食品饮料', member_count: 284, coverage: .996, yesterday_premium: -.0124,
    emotion: emotion('震荡分化', '主升中分歧', '恶化', ['昨日强势股反馈转负。', '涨停集中在少数个股，扩散不足。'], ['仍有低位首板，尚不能判定整体退潮。']), trend: [6, 7, 6, 8, 6, 7, 5, 6, 7, 8] },
];
type StockSeed = [string, string, number];
const seeds: Record<string, StockSeed[]> = {
  aerospace: [['600118', '中国卫星', 7], ['002025', '航天电器', 5], ['600879', '航天电子', 4], ['600343', '航天动力', 3], ['002389', '航天彩虹', 2], ['600501', '航天晨光', 2], ['600893', '航发动力', 1], ['600150', '中国船舶', 1], ['600391', '航发科技', 1]],
  computing: [['603019', '中科曙光', 5], ['000977', '浪潮信息', 4], ['002261', '拓维信息', 3], ['603083', '剑桥科技', 2], ['002281', '光迅科技', 2], ['002837', '英维克', 1], ['002463', '沪电股份', 1], ['000938', '紫光股份', 1], ['603881', '数据港', 1]],
  robotics: [['002031', '巨轮智能', 4], ['002896', '中大力德', 3], ['002472', '双环传动', 3], ['601100', '恒立液压', 2], ['002600', '领益智造', 2], ['002527', '新时达', 1], ['002747', '埃斯顿', 1], ['603667', '五洲新春', 1], ['002050', '三花智控', 1]],
  battery: [['002850', '科达利', 3], ['002074', '国轩高科', 3], ['002709', '天赐材料', 2], ['002812', '恩捷股份', 2], ['002460', '赣锋锂业', 2], ['603659', '璞泰来', 1], ['002340', '格林美', 1], ['002407', '多氟多', 1], ['600487', '亨通光电', 1]],
  semiconductor: [['002156', '通富微电', 3], ['002371', '北方华创', 2], ['600584', '长电科技', 2], ['002185', '华天科技', 2], ['603986', '兆易创新', 1], ['603501', '韦尔股份', 1], ['002049', '紫光国微', 1], ['600703', '三安光电', 1], ['600460', '士兰微', 1]],
  consumer: [['002251', '步步高', 2], ['600859', '王府井', 2], ['002264', '新华都', 2], ['600785', '新华百货', 1], ['600887', '伊利股份', 1], ['603288', '海天味业', 1], ['600597', '光明乳业', 1], ['002568', '百润股份', 1], ['600600', '青岛啤酒', 1]],
};
// Keep fixture identity plausible; price/boards/times are intentionally simulated.
const stocks: SentimentStock[] = Object.entries(seeds).flatMap(([themeId, list], themeIndex) => list.map(([code, name, height], index) => {
  const history = Array.from({ length: 10 }, (_, day) => day >= 10 - height);
  if (code === '002896') history.splice(0, 10, true, true, true, false, true, true, false, true, true, true);
  const sealed = index < 8;
  history[history.length - 1] = sealed;
  const firstTime = index === 0 ? '09:25:00' : `09:${String(30 + index * 3 + themeIndex).padStart(2, '0')}:${String(6 + index * 5).padStart(2, '0')}`;
  return {
    code, name, theme_ids: code === '002600' ? ['robotics', 'semiconductor'] : [themeId],
    price: +(12.85 + themeIndex * 8.23 + index * 3.15).toFixed(2), change_ratio: sealed ? .1 + ((index % 3) - 1) * .0001 : .0623,
    limit_status: sealed ? 'sealed' : 'opened', confirmed_streak_before_today: height - 1, intraday_streak: sealed ? height : null,
    first_seal_at: time(firstTime), time_source: 'observed', last_reseal_at: null, observed_open_count: sealed ? 0 : 1,
    window_days: 10, limit_up_days: history.filter(Boolean).length, board_history: history,
    seal_amount_yuan: sealed ? (32 - index * 3 + themeIndex) * 1e7 : null,
    amount_yuan: (8 + index * 1.7 + themeIndex) * 1e8, turnover_ratio: .037 + index * .016,
    source_time: time('14:32:05'), is_stale: false,
  };
}));
const baseEvents: SentimentEvent[] = [
  { id: 'base-1', time: time('14:31:42'), kind: '情绪变化', text: '半导体：退潮 → 退潮中修复', theme_id: 'semiconductor' },
  { id: 'base-2', time: time('14:30:18'), kind: '首次封板', text: '中国船舶首次观察到封板', stock_code: '600150', theme_id: 'aerospace' },
  { id: 'base-3', time: time('14:29:36'), kind: '开板', text: '三花智控打开涨停，观察承接', stock_code: '002050', theme_id: 'robotics' },
  { id: 'base-4', time: time('14:28:05'), kind: '首次封板', text: '多氟多首次观察到封板', stock_code: '002407', theme_id: 'battery' },
];
// Align the displayed event log with the current snapshot's observation timestamps.
stocks.find(stock => stock.code === '600150')!.first_seal_at = time('14:30:18');
stocks.find(stock => stock.code === '002407')!.first_seal_at = time('14:28:05');
stocks.forEach((stock, index) => {
  if (index % 9 === 4) stock.first_seal_at = time(`14:31:${35 + Math.floor(index / 9) * 2}`);
});
themes.find(theme => theme.theme_id === 'semiconductor')!.emotion.state_since = time('14:31:42');

export const demoFeedback = [
  { name: '昨日首板', count: 32, available: 32, opening: .0121, current: .0326, promoted: 13, red: 24 },
  { name: '昨日连板', count: 18, available: 18, opening: .0285, current: .0418, promoted: 10, red: 12 },
  { name: '昨日高位板', count: 7, available: 6, opening: .0240, current: -.0182, promoted: 2, red: 2 },
  { name: '昨日炸板', count: 16, available: 16, opening: -.0186, current: -.0267, promoted: 0, red: 4 },
];
export const demoHistory = [
  { date: '09/23', sealed: 25, opened: 12, state: '退潮' }, { date: '09/24', sealed: 19, opened: 15, state: '情绪低迷' },
  { date: '09/25', sealed: 28, opened: 10, state: '退潮中修复' }, { date: '09/28', sealed: 24, opened: 12, state: '试错整理' },
  { date: '09/29', sealed: 32, opened: 8, state: '扩散发酵' }, { date: '09/30', sealed: 39, opened: 9, state: '扩散发酵' },
  { date: '10/09', sealed: 46, opened: 7, state: '主升' }, { date: '10/12', sealed: 53, opened: 5, state: '主升' },
  { date: '10/13', sealed: 44, opened: 12, state: '主升中分歧' }, { date: '10/14', sealed: 48, opened: 6, state: '主升中分歧' },
];
const marketEmotion = {
  ...emotion('主升中分歧', '主升', '改善', ['午后首板补充，当前未封住比例下降。', '昨日连板群体仍有晋级，接力尚未中断。'], ['昨日高位股涨幅中位数转负，亏损反馈仍在。']),
  state_since: time('10:15:00'),
};
export function createDemoSnapshot(step = 0, elapsedSeconds = step * 5): SentimentSnapshot {
  step = Math.max(0, Math.min(3, Math.floor(step)));
  const timestamp = DEMO_SECONDS_START + Math.max(0, Math.min(30, elapsedSeconds)) * 1000;
  const asOf = new Date(timestamp + 8 * 3600000).toISOString().replace('Z', '+08:00');
  const currentStocks = stocks.map(stock => ({ ...stock, board_history: [...stock.board_history], source_time: asOf }));
  const events = baseEvents.filter(event => event.kind === '情绪变化');
  const changes: Array<{ code: string; kind: '开板' | '回封'; clock: string }> = [
    { code: '002031', kind: '开板', clock: '14:32:10' },
    { code: '002050', kind: '回封', clock: '14:32:15' },
    { code: '002031', kind: '回封', clock: '14:32:20' },
  ];
  for (const [index, change] of changes.slice(0, step).entries()) {
    const stock = currentStocks.find(item => item.code === change.code)!;
    const sealed = change.kind === '回封';
    const previousClose = stock.price / (1 + stock.change_ratio);
    stock.limit_status = sealed ? 'sealed' : 'opened';
    stock.intraday_streak = sealed ? stock.confirmed_streak_before_today! + 1 : null;
    stock.change_ratio = sealed ? .1 : .0826;
    stock.price = +(previousClose * (1 + stock.change_ratio)).toFixed(2);
    stock.board_history[stock.board_history.length - 1] = sealed;
    stock.limit_up_days = stock.board_history.filter(Boolean).length;
    stock.observed_open_count = 1;
    stock.last_reseal_at = sealed ? time(change.clock) : null;
    stock.seal_amount_yuan = sealed ? 1.86e8 : null;
    events.unshift({ id: `demo-${index}`, time: time(change.clock), kind: change.kind, stock_code: stock.code,
      theme_id: stock.theme_ids[0], text: `${stock.name}${sealed ? '回封涨停，封单 1.86 亿' : '打开涨停，暂离当前封板梯队'}` });
  }
  const seconds = createDemoSecondSeries(stocks, timestamp);
  const existingEventKeys = new Set(events.filter(event => event.stock_code).map(event => `${event.stock_code}-${Date.parse(event.time)}-${event.kind}`));
  seconds.forEach(series => {
    const stock = currentStocks.find(item => item.code === series.code)!;
    const base = stocks.find(item => item.code === series.code)!;
    stock.change_ratio = series.points.at(-1)!.change_ratio!;
    stock.price = +(base.price / (1 + base.change_ratio) * (1 + stock.change_ratio)).toFixed(2);
    stock.observed_open_count = series.events.filter(event => event.kind === '开板').length;
    const reseal = series.events.filter(event => event.kind === '回封').at(-1);
    stock.last_reseal_at = reseal ? new Date(reseal.time + 8 * 3600000).toISOString().replace('Z', '+08:00') : null;
    for (const event of series.events) {
      const kind = event.kind === '封板' ? '首次封板' : event.kind;
      if (event.time < DEMO_SECONDS_START - 180000 || existingEventKeys.has(`${stock.code}-${event.time}-${kind}`)) continue;
      events.push({ id: event.id, time: new Date(event.time + 8 * 3600000).toISOString().replace('Z', '+08:00'),
        kind, stock_code: stock.code, theme_id: stock.theme_ids[0], text: `${stock.name}${event.kind === '开板' ? '打开涨停，继续观察回封' : event.kind === '回封' ? '回封涨停' : '首次观察到封板'}` });
    }
  });
  events.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  return {
    meta: { trade_date: DEMO_DATE, session: 'continuous', scope: 'hs_mainboard', snapshot_id: `demo-${timestamp}`, as_of: asOf,
      is_final: false, is_stale: false, coverage: .996, rule_version: 'demo-only' },
    emotion: marketEmotion,
    themes, stocks: currentStocks, seconds, events, limit_down_count: 5,
  };
}

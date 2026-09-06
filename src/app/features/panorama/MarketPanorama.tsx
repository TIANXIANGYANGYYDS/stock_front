import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownRight, ArrowUpRight, BarChart3, Box, CandlestickChart, ListFilter, MousePointer2, RotateCcw, Search, X } from 'lucide-react';
import { getStockList, type StockListItem } from '../../lib/api';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  amountLabel, changeLabel, changeTone, filterPanoramaStocks, finiteValue, panoramaStocks, stockComparison, summarizePanorama,
  type PanoramaFilter, type PanoramaSort,
} from './panorama-data';
import type { createMarketScene } from './market-scene';
import { followPointerLight } from '../../lib/pointer-light';

type SceneController = ReturnType<typeof createMarketScene>;
export default function MarketPanorama({ tradeDate, onClose, onStock, onRestoreFocus }: {
  tradeDate?: string; onClose: () => void; onStock: (code: string) => void; onRestoreFocus: () => void;
}) {
  const [stocks, setStocks] = useState<StockListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selectedCode, setSelectedCode] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PanoramaFilter>('all');
  const [sort, setSort] = useState<PanoramaSort>('amount');
  const [mode, setMode] = useState<'list' | 'scene'>('list');
  const [graphicsError, setGraphicsError] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const controller = useRef<SceneController | null>(null);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const select = useCallback((code: string) => setSelectedCode(code), []);
  const summary = useMemo(() => summarizePanorama(stocks), [stocks]);
  const visible = useMemo(() => filterPanoramaStocks(stocks, query, filter, sort), [stocks, query, filter, sort]);
  const selected = visible.find((stock) => stock.code === selectedCode) ?? visible[0];
  const comparison = selected ? stockComparison(selected, stocks, summary) : null;
  const sortLabels: Record<PanoramaSort, string> = { amount: '成交额从高到低', gain: '涨幅从高到低', loss: '跌幅从大到小', move: '涨跌幅绝对值从大到小' };

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError(''); setStocks([]);
    if (!tradeDate) { setLoading(false); setError('交易日尚未就绪，请稍后重试。'); return; }
    void getStockList(tradeDate, '', abort.signal).then((items) => {
      if (abort.signal.aborted) return;
      const next = panoramaStocks(items); setStocks(next); setSelectedCode(next[0]?.code ?? '');
    }).catch((reason: unknown) => {
      if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : '行情加载失败');
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [tradeDate, reload]);

  useEffect(() => {
    let cancelled = false;
    setSceneReady(false); setGraphicsError(false);
    if (mode !== 'scene' || !visible.length || !host.current) return;
    void import('./market-scene').then(({ createMarketScene }) => {
      if (cancelled || !host.current) return;
      const instance = createMarketScene(host.current, visible, reduced, select, () => {
        setGraphicsError(true); setSceneReady(false);
        controller.current?.dispose(); controller.current = null;
      }, summary.maxMove);
      controller.current = instance; setSceneReady(true);
    }).catch(() => { if (!cancelled) setGraphicsError(true); });
    return () => { cancelled = true; controller.current?.dispose(); controller.current = null; };
  }, [mode, visible, reduced, select, summary.maxMove]);
  useEffect(() => { if (selected) controller.current?.select(selected.code); }, [selected?.code, sceneReady]);
  useEffect(() => { if (list.current) list.current.scrollTop = 0; }, [query, filter, sort]);

  function focusLeader(stock: StockListItem, nextSort: PanoramaSort) {
    setQuery(''); setFilter('all'); setSort(nextSort); setSelectedCode(stock.code);
    if (list.current) list.current.scrollTop = 0;
  }
  function clearFilters() { setQuery(''); setFilter('all'); }

  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="studio-immersive-backdrop" />
      <Dialog.Content className="market-panorama" onPointerMove={followPointerLight} onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}>
        <header className="panorama-header">
          <div><span className="panorama-eyebrow"><BarChart3 size={14} />ACTIVE STOCKS</span><Dialog.Title>活跃股速览</Dialog.Title>
            <Dialog.Description>先比较涨跌与成交活跃度，再进入 K 线核对走势。</Dialog.Description></div>
          <Dialog.Close className="panorama-icon-button" aria-label="关闭活跃股速览"><X size={20} /></Dialog.Close>
        </header>
        <p className="panorama-scope">{tradeDate || '--'} · 成交额前 50 只 · 前复权日线快照<span>以下统计仅覆盖已加载的 {stocks.length} 只股票</span></p>
        {stocks.length > 0 && <section className="panorama-summary" aria-label="样本概况">
          <div className="panorama-breadth">
            <span className="panorama-summary-label">这组活跃股的涨跌分布</span>
            <div><button type="button" className="is-rise" onClick={() => { setQuery(''); setFilter('rise'); setSort('gain'); }}>上涨 <b>{summary.rise}</b></button>
              <button type="button" className="is-fall" onClick={() => { setQuery(''); setFilter('fall'); setSort('loss'); }}>下跌 <b>{summary.fall}</b></button></div>
            <div className="panorama-breadth-track" aria-hidden="true"><i style={{ flex: summary.rise, background: '#ff8295' }} /><i style={{ flex: summary.fall, background: '#46deba' }} /><i style={{ flex: summary.flat + summary.unknown, background: '#647899' }} /></div>
            <small>平盘 {summary.flat} · 涨跌缺失 {summary.unknown} · 点击上涨 / 下跌筛选</small>
          </div>
          {([{ label: '样本涨幅首位', stock: summary.gainLeader, sort: 'gain', Icon: ArrowUpRight }, { label: '样本跌幅首位', stock: summary.lossLeader, sort: 'loss', Icon: ArrowDownRight }] as const).map(({ label, stock, sort: nextSort, Icon }) =>
            <button type="button" className="panorama-leader" key={label} disabled={!stock} onClick={() => stock && focusLeader(stock, nextSort)}>
              <span className="panorama-summary-label">{label}<Icon size={17} /></span>
              <span className="panorama-leader-value"><strong>{stock?.name ?? '暂无'}</strong><b className={`is-${changeTone(stock?.changePercent ?? null)}`}>{changeLabel(stock?.changePercent ?? null)}</b></span>
              <small>{stock ? `${stock.code} · 成交额 ${amountLabel(stock.amount)} · 点击定位` : '该样本中暂无符合方向的股票'}</small>
            </button>)}
        </section>}
        <div className="panorama-toolbar">
          <label className="panorama-search"><Search size={16} /><input type="search" aria-label="在活跃股样本中搜索" placeholder="搜名称 / 代码" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="清空样本搜索" onClick={() => setQuery('')}><X size={14} /></button>}</label>
          <label className="panorama-sort"><ListFilter size={15} /><select aria-label="行情排序" value={sort} onChange={(event) => setSort(event.target.value as PanoramaSort)}>{Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="panorama-mode" role="group" aria-label="展示方式"><button type="button" aria-pressed={mode === 'list'} onClick={() => setMode('list')}><BarChart3 size={15} />行情对比</button><button type="button" aria-pressed={mode === 'scene'} onClick={() => setMode('scene')} title="用柱高比较涨跌幅绝对值，点选后查看具体数据"><Box size={15} />3D 探索</button></div>
        </div>
        <div className="panorama-filterbar">
          <div role="group" aria-label="行情筛选">{([{ value: 'all', label: '全部' }, { value: 'rise', label: '只看上涨' }, { value: 'fall', label: '只看下跌' }, { value: 'large', label: '|涨跌幅| ≥ 5%' }] as const).map(({ value, label }) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
          <span role="status">显示 {visible.length} / {stocks.length} 只</span>
        </div>
        <div className={`panorama-body ${mode === 'scene' ? 'has-scene' : ''}`}>
          <section className="panorama-results" aria-label="活跃股行情">
            {(loading || error || !visible.length) ? <div className="panorama-empty" role="status"><BarChart3 size={30} /><strong>{loading ? '正在读取真实行情' : error ? '行情暂不可用' : stocks.length ? '样本内没有匹配的股票' : '该交易日暂无数据'}</strong>
              <p>{error || (stocks.length ? '搜索范围仅限成交额前 50 只，可清除筛选后继续比较。' : '行情就绪后会显示涨跌、成交额及样本排名。')}</p>
              {error ? <button type="button" onClick={() => setReload((value) => value + 1)}>重试行情</button> : !loading && stocks.length > 0 && <button type="button" onClick={clearFilters}>清除筛选</button>}
            </div> : <>
              {mode === 'scene' && <section className="panorama-stage" aria-label="三维行情分布">
                <div className="panorama-legend"><span className="is-rise">红色上涨</span><span className="is-fall">绿色下跌</span><span>当前筛选 {visible.length} 只</span></div>
                <div ref={host} className="panorama-canvas" />
                {(graphicsError || !sceneReady) && <div className="panorama-state" role="status"><Box size={30} /><strong>{graphicsError ? '当前环境无法显示 3D 场景' : '正在构建行情分布'}</strong><p>{graphicsError ? '行情数据仍可在下方列表中查看。' : '与行情对比使用同一组数据。'}</p>{graphicsError && <button type="button" onClick={() => setMode('list')}>返回行情对比</button>}</div>}
                <div className="panorama-stage-footer"><span><MousePointer2 size={14} />拖动旋转 · 滚轮缩放 · 点选查看数据</span><button type="button" disabled={!sceneReady} onClick={() => controller.current?.reset()}><RotateCcw size={14} />复位</button></div>
                <p className="panorama-height-note">柱高 = |涨跌幅|，颜色区分方向；筛选前后刻度不变。平盘 / 缺失显示底座。</p>
              </section>}
              <div className="panorama-list-heading"><span>{sortLabels[sort]}</span><small>条长 = |涨跌幅| · 点击行查看对比依据</small></div>
              <div ref={list} className="panorama-quote-list terminal-scroll" aria-label="活跃股列表">
                {visible.map((stock) => <div className={`panorama-quote is-${changeTone(stock.changePercent)}`} data-selected={selected?.code === stock.code} key={stock.code}>
                  <button type="button" className="panorama-quote-select" aria-pressed={selected?.code === stock.code} aria-label={`查看 ${stock.name} ${stock.code} 的对比依据`} onClick={() => select(stock.code)}>
                    <span className="panorama-quote-name"><b>{stock.name}</b><small>{stock.code} · 成交额第 {stockComparison(stock, stocks, summary).amountRank ?? '--'}</small></span>
                    <span className="panorama-quote-value"><b>{changeLabel(stock.changePercent)}</b><small>成交额 {amountLabel(stock.amount)}</small></span>
                    <span className="panorama-move-track" aria-hidden="true"><i style={{ width: `${finiteValue(stock.changePercent) ? Math.abs(stock.changePercent) / summary.maxMove * 100 : 0}%` }} /></span>
                  </button>
                  <button type="button" className="panorama-quote-open" onClick={() => onStock(stock.code)} aria-label={`打开 ${stock.name} ${stock.code} 的 K 线`} title={`打开 ${stock.name} 的 K 线`}><CandlestickChart size={17} /><span>K 线</span></button>
                  {selected?.code === stock.code && comparison && <div className="panorama-inline-evidence">
                    <span>占样本成交额<b>{comparison.amountShare === null ? '--' : `${comparison.amountShare.toFixed(2)}%`}</b></span>
                    <span>比样本涨跌幅中位数<b>{comparison.medianDifference === null ? '--' : `${comparison.medianDifference > 0 ? '+' : ''}${comparison.medianDifference.toFixed(2)} 个百分点`}</b></span>
                    <small>收盘 {finiteValue(stock.close) ? stock.close.toFixed(2) : '--'} · {stock.tradeDate || '--'}</small>
                  </div>}
                </div>)}
              </div>
            </>}
          </section>
          <aside className="panorama-inspector terminal-scroll">
            {selected && comparison ? <section className="panorama-selected" aria-label="选中股票">
              <span className="panorama-eyebrow">对比依据 · {selected.code}</span>
              <h2>{selected.name}</h2>
              <strong className={`is-${changeTone(selected.changePercent)}`}>{changeLabel(selected.changePercent)}<small>当日涨跌幅</small></strong>
              <div className="panorama-selected-quotes"><span>收盘 <b>{finiteValue(selected.close) ? selected.close.toFixed(2) : '--'}</b></span><span>成交额 <b>{amountLabel(selected.amount)}</b></span></div>
              <dl className="panorama-evidence">
                <div><dt>成交额排名</dt><dd>{comparison.amountRank === null ? '--' : `第 ${comparison.amountRank} / ${summary.amountCount} 名`}</dd></div>
                <div><dt>占样本成交额</dt><dd>{comparison.amountShare === null ? '--' : `${comparison.amountShare.toFixed(2)}%`}</dd></div>
                <div><dt>样本涨跌幅中位数</dt><dd>{changeLabel(summary.median)}</dd></div>
              </dl>
              <p className="panorama-comparison-note">{comparison.medianDifference === null ? '涨跌数据不足，暂无法比较相对表现。' : Math.abs(comparison.medianDifference) < .005 ? '当日涨跌幅与样本中位数持平。' : `当日涨跌幅比样本中位数${comparison.medianDifference > 0 ? '高' : '低'} ${Math.abs(comparison.medianDifference).toFixed(2)} 个百分点。`}</p>
              <button type="button" onClick={() => onStock(selected.code)}>查看 K 线与策略<ArrowUpRight size={17} /></button>
              <p className="panorama-next-step">继续核对价格走势与策略信号，判断过程在决策工作台查看。</p>
              <p className="panorama-quote-date">个股数据日期 {selected.tradeDate || '--'}</p>
            </section> : <div className="panorama-inspector-empty">{loading ? '正在准备对比数据…' : '有匹配股票后，这里会显示排名与相对表现。'}</div>}
            <details className="panorama-method"><summary>数据口径与比较方法</summary><p>范围：所选交易日按成交额降序返回的前 50 只股票。排名与占比始终基于完整已加载样本，筛选不会改变分母；相同成交额并列排名。</p><p>中位数是样本涨跌幅排序后的中间值，缺失值不参与计算。有效成交额 {summary.amountCount} / {stocks.length} 只。成交额为交易金额，不代表净流入；此页展示日线快照与相对位置，不生成买卖信号。</p></details>
          </aside>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

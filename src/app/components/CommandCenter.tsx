import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { ArrowUpRight, BarChart3, CandlestickChart, Command as CommandIcon, Moon, Search, X } from 'lucide-react';
import { getCachedStockList, getStockList, type StockListItem } from '../lib/api';
import type { WorkspaceView } from './TerminalHeader';
import { followPointerLight } from '../lib/pointer-light';

export default function CommandCenter({ tradeDate, onClose, onView, onStock, onPanorama, onTheme, onRestoreFocus }: {
  tradeDate?: string; onClose: () => void; onView: (view: WorkspaceView) => void; onStock: (code: string) => void;
  onPanorama: () => void; onTheme: () => void; onRestoreFocus: () => void;
}) {
  const [search, setSearch] = useState('');
  const [stocks, setStocks] = useState<StockListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const query = search.trim();
  useEffect(() => {
    const abort = new AbortController();
    const cached = tradeDate && query ? getCachedStockList(tradeDate, query) : undefined;
    setStocks(cached ?? []); setError(''); setLoading(Boolean(query && tradeDate && !cached));
    if (!query || !tradeDate) return;
    const timer = window.setTimeout(() => {
      void getStockList(tradeDate, query, abort.signal).then((items) => { if (!abort.signal.aborted) setStocks(items); })
        .catch(() => { if (!abort.signal.aborted) setError('股票搜索暂不可用，请重新输入后重试。'); })
        .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    }, cached ? 0 : 180);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [query, tradeDate]);
  const actions = [
    { id: 'panorama', label: '活跃股速览 · 比涨跌、查排名', keywords: '3d hangqing panorama 行情 成交额 筛选', Icon: BarChart3, run: onPanorama },
    ...([{ id: 'decision', label: '决策工作台', keywords: '股票 k线 juece' }, { id: 'quant', label: '量化影子盘', keywords: 'lianghua quant 策略' },
      { id: 'market', label: '市场洞察', keywords: 'shichang market' }, { id: 'news', label: '实时资讯', keywords: '新闻 news zixun' },
      { id: 'creators', label: '博主观点', keywords: 'bozhu creators 分析' }] as const)
      .map((item) => ({ ...item, Icon: ArrowUpRight, run: () => onView(item.id) })),
    { id: 'theme', label: '切换深浅主题', keywords: 'zhuti theme dark light', Icon: Moon, run: onTheme },
  ].filter((action) => !query || `${action.label} ${action.keywords}`.toLowerCase().includes(query.toLowerCase()));

  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="command-backdrop" />
    <Dialog.Content className="command-center" onPointerMove={followPointerLight} onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}>
      <Dialog.Title className="sr-only">指令中心</Dialog.Title><Dialog.Description className="sr-only">搜索股票代码或名称，使用方向键选择，按回车打开。</Dialog.Description>
      <Command label="搜索股票或操作" shouldFilter={false} loop>
        <div className="command-search"><Search size={21} /><Command.Input autoFocus value={search} onValueChange={setSearch} placeholder="搜索股票、页面或操作…" aria-label="搜索股票或操作" /><Dialog.Close aria-label="关闭指令中心"><X size={17} /></Dialog.Close></div>
        <Command.List>
          {actions.length > 0 && <Command.Group heading={query ? '相关操作' : '快捷操作'}>{actions.map(({ id, label, Icon, run }) => <Command.Item key={id} value={`action:${id}`} onSelect={run}><Icon size={18} /><span>{label}</span><ArrowUpRight size={14} /></Command.Item>)}</Command.Group>}
          {loading && <div className="command-status" role="status">正在搜索股票…</div>}
          {error && <div className="command-status" role="status">{error}</div>}
          {!tradeDate && query && <div className="command-status" role="status">交易日就绪后可搜索股票。</div>}
          {stocks.length > 0 && <Command.Group heading="股票">{stocks.map((stock) => <Command.Item key={stock.code} value={`stock:${stock.code}`} onSelect={() => onStock(stock.code)}><CandlestickChart size={18} /><span>{stock.name}<small>{stock.code}</small></span><small>打开 K 线</small></Command.Item>)}</Command.Group>}
          {!loading && !error && <Command.Empty>没有匹配结果，试试股票代码或“博主观点”。</Command.Empty>}
        </Command.List>
        <footer><span><CommandIcon size={13} />快速直达</span><span><kbd>↑ ↓</kbd>选择 <kbd>Enter</kbd>打开 <kbd>Esc</kbd>关闭</span></footer>
      </Command>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}

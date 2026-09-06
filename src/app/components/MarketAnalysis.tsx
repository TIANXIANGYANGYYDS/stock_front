import { ArrowUpRight, Sunrise, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getPreopenAnalysis, type PreopenAnalysisResponse } from '../lib/api';
import { analysisAdviceText, resolveMainLines } from '../features/market/market-analysis-state';

interface MarketAnalysisProps {
  analysisDate: string | null;
}

export function MarketAnalysis({ analysisDate }: MarketAnalysisProps) {
  const [analysis, setAnalysis] = useState<PreopenAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedLine, setSelectedLine] = useState<PreopenAnalysisResponse['mainLines'][number] | null>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalysis() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPreopenAnalysis(analysisDate);
        if (!cancelled) setAnalysis(data);
      } catch (requestError: unknown) {
        if (!cancelled) {
          setAnalysis(null);
          setError(requestError instanceof Error ? requestError.message : '盘前分析加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAnalysis();
    return () => { cancelled = true; };
  }, [analysisDate, reload]);

  const mainLines = resolveMainLines(analysis);
  const dateLabel = analysis?.analysisDate || '--';
  const adviceText = analysisAdviceText(analysis);

  const getPriorityLabel = (priority: string) => {
    if (priority === 'high') return '核心主线';
    if (priority === 'medium') return '次级主线';
    return '观察主线';
  };

  return (
    <section className="terminal-panel market-brief">
      <header className="market-brief-header">
        <div><span className="market-brief-icon"><Sunrise size={22} /></span><div><h2>每日盘前分析</h2><p>盘前分析日期：{dateLabel}</p></div></div>
        <span className="market-brief-count">{loading ? '更新中' : mainLines.length ? `${mainLines.length} 个市场主线` : '暂无主线数据'}</span>
      </header>
      {loading && <div className="terminal-empty"><span className="loading-pulse" />分析加载中...</div>}
      {!loading && error && <div className="terminal-empty workspace-recovery" role="alert"><span>{error}</span><button type="button" className="terminal-button" onClick={() => setReload((value) => value + 1)}>重试</button></div>}
      {!loading && !error && <div className={'market-brief-body' + (adviceText ? ' has-context' : '')}>
        {adviceText && <section className="market-brief-context">
          <h3>市场研判</h3><p>{adviceText}</p>
          <div className="market-brief-facts">
            {analysis?.marketStyle && <span>市场风格 <b>{analysis.marketStyle}</b></span>}
            {analysis?.riskLevel && <span>风险等级 <b>{analysis.riskLevel}</b></span>}
          </div>
        </section>}
        <div className="market-brief-lines">
          {mainLines.length === 0 && <div className="terminal-empty">该盘前分析日期暂无盘前分析数据</div>}
          {mainLines.map((line) => <button type="button" className={'market-brief-line is-' + line.priority} key={`${line.rank}-${line.title}`} onClick={(event) => { detailTrigger.current = event.currentTarget; setSelectedLine(line); }}>
            <span className="market-brief-rank">{String(line.rank).padStart(2, '0')}</span>
            <span className="market-brief-line-content"><span><strong>{line.title}</strong><em>{getPriorityLabel(line.priority)}</em></span><span className="market-brief-reason">{line.reason?.trim() || '后端未返回详细理由'}</span></span>
            <span className="market-brief-open"><ArrowUpRight size={17} /><span>查看详情</span></span>
          </button>)}
        </div>
      </div>}
      {selectedLine && (
        <Dialog.Root open onOpenChange={(open) => { if (!open) setSelectedLine(null); }}><Dialog.Portal>
          <Dialog.Overlay className="analysis-detail-backdrop" />
          <Dialog.Content
            className="analysis-detail-dialog"
            aria-label={`${selectedLine.title}盘前分析详情`}
            onCloseAutoFocus={(event) => { event.preventDefault(); detailTrigger.current?.focus(); }}
          >
            <Dialog.Description className="sr-only">所选市场主线的判断依据、风险因素和市场环境</Dialog.Description>
            <header>
              <div>
                <span className="eyebrow">MORNING MAINLINE #{selectedLine.rank}</span>
                <Dialog.Title>{selectedLine.title}</Dialog.Title>
              </div>
              <Dialog.Close aria-label="关闭详情"><X size={18} /></Dialog.Close>
            </header>
            <div className="analysis-detail-meta">
              <span>{selectedLine.role || '观察方向'}</span>
              <span>置信度 {selectedLine.confidence ?? '--'}</span>
              <span>盘前分析日期 {dateLabel}</span>
            </div>
            <section><h3>主线逻辑</h3><p>{selectedLine.reason || '后端未返回详细理由'}</p></section>
            <section>
              <h3>风险因素</h3>
              {(selectedLine.risks?.length ?? 0) > 0
                ? <ul>{selectedLine.risks?.map((risk) => <li key={risk}>{risk}</li>)}</ul>
                : <p>后端未返回风险因素</p>}
            </section>
            <section className="analysis-market-context">
              <h3>市场环境</h3>
              <p><b>市场风格：</b>{analysis?.marketStyle || '未提供'}</p>
              <p><b>风险等级：</b>{analysis?.riskLevel || '未提供'}</p>
              <p><b>风险摘要：</b>{analysis?.riskSummary || '未提供'}</p>
            </section>
          </Dialog.Content>
        </Dialog.Portal></Dialog.Root>
      )}
    </section>
  );
}

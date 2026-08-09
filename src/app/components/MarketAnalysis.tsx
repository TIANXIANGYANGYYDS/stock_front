import { Flame, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPreopenAnalysis, type PreopenAnalysisResponse } from '../lib/api';
import { analysisAdviceText, resolveMainLines } from '../features/market/market-analysis-state';

interface MarketAnalysisProps {
  preferredTradeDate: string;
}

export function MarketAnalysis({ preferredTradeDate }: MarketAnalysisProps) {
  const [analysis, setAnalysis] = useState<PreopenAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<PreopenAnalysisResponse['mainLines'][number] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalysis() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPreopenAnalysis(preferredTradeDate);
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
  }, [preferredTradeDate]);

  const mainLines = resolveMainLines(analysis);
  const dateLabel = analysis?.tradeDate || analysis?.date || '--';
  const dateIsBehind = dateLabel !== '--' && preferredTradeDate !== dateLabel;
  const adviceText = analysisAdviceText(analysis);

  const getPriorityStyle = (priority: string) => {
    if (priority === 'high') return {
      badge: 'bg-red-500/10 border-red-500/30 text-red-400',
      border: 'border-red-500/30',
      icon: 'text-red-400',
    };
    if (priority === 'medium') return {
      badge: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
      border: 'border-yellow-500/30',
      icon: 'text-yellow-400',
    };
    return {
      badge: 'bg-slate-700/30 border-slate-600/30 text-slate-400',
      border: 'border-slate-700/50',
      icon: 'text-slate-400',
    };
  };

  const getPriorityLabel = (priority: string) => {
    if (priority === 'high') return '核心主线';
    if (priority === 'medium') return '次级主线';
    return '观察主线';
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 bg-gradient-to-r from-slate-800/30 to-slate-900/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm text-white">每日盘前分析</h3>
            <p className="text-xs text-slate-400">交易日：{dateLabel}</p>
            {dateIsBehind && (
              <p className="text-[11px] text-amber-400 mt-0.5">
                接口返回日期与当前交易日 {preferredTradeDate} 不一致
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <span className="text-xs text-blue-400">后端盘前分析</span>
          </div>
          <div className="px-2.5 py-1 bg-slate-800/50 border border-slate-600/40 rounded-lg">
            <span className="text-xs text-slate-300">{mainLines.length ? `${mainLines.length} 个市场主线` : '暂无主线数据'}</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading && <div className="text-xs text-slate-400">分析加载中...</div>}
        {!loading && error && <div className="text-xs text-red-400">{error}</div>}
        {!loading && !error && mainLines.length === 0 && (
          <div className="text-xs text-slate-400">该交易日暂无盘前分析数据</div>
        )}

        {!loading && !error && mainLines.map((line) => {
          const style = getPriorityStyle(line.priority);
          return (
            <button
              type="button"
              key={`${line.rank}-${line.title}`}
              onClick={() => setSelectedLine(line)}
              className={`block w-full text-left p-3 border-2 rounded-xl transition-all cursor-pointer hover:scale-[1.01] bg-slate-800/20 ${style.border} hover:bg-slate-800/40`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 bg-slate-900/50 border border-slate-700/50 rounded-lg">
                    <span className={`text-xs ${style.icon}`}>#{line.rank}</span>
                  </div>
                  <div>
                    <h4 className="text-sm text-white mb-0.5 flex items-center gap-2">
                      {line.title}
                      {line.rank === 1 && <TrendingUp className="w-3.5 h-3.5 text-red-400" />}
                    </h4>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs ${style.badge}`}>
                      {getPriorityLabel(line.priority)}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-1 rounded border text-xs bg-slate-800/50 border-slate-600/40 text-slate-300">
                  查看详情
                </span>
              </div>
              <p className="pl-9 text-xs text-slate-400 leading-relaxed">
                <span className="text-slate-500 mr-1.5">理由：</span>
                {line.reason?.trim() || '后端未返回详细理由'}
              </p>
            </button>
          );
        })}
      </div>

      {adviceText && <div className="px-4 pb-4">
        <div className="p-2.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-500/20 rounded flex items-center justify-center flex-shrink-0"><span className="text-xs">💡</span></div>
            <div>
              <p className="text-xs text-blue-400 mb-0.5">市场研判</p>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{adviceText}</p>
            </div>
          </div>
        </div>
      </div>}

      {selectedLine && (
        <div className="analysis-detail-backdrop" onMouseDown={() => setSelectedLine(null)}>
          <section
            className="analysis-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedLine.title}盘前分析详情`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">MORNING MAINLINE #{selectedLine.rank}</span>
                <h2>{selectedLine.title}</h2>
              </div>
              <button type="button" onClick={() => setSelectedLine(null)} aria-label="关闭详情">×</button>
            </header>
            <div className="analysis-detail-meta">
              <span>{selectedLine.role || '观察方向'}</span>
              <span>置信度 {selectedLine.confidence ?? '--'}</span>
              <span>交易日 {dateLabel}</span>
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
          </section>
        </div>
      )}
    </div>
  );
}

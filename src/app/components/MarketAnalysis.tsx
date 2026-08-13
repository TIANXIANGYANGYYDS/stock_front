import { Flame, Lightbulb, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPreopenAnalysis, type PreopenAnalysisResponse } from '../lib/api';
import { analysisAdviceText, resolveMainLines } from '../features/market/market-analysis-state';

interface MarketAnalysisProps {
  analysisDate: string | null;
}

export function MarketAnalysis({ analysisDate }: MarketAnalysisProps) {
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
  }, [analysisDate]);

  const mainLines = resolveMainLines(analysis);
  const dateLabel = analysis?.analysisDate || '--';
  const adviceText = analysisAdviceText(analysis);

  const getPriorityLabel = (priority: string) => {
    if (priority === 'high') return '核心主线';
    if (priority === 'medium') return '次级主线';
    return '观察主线';
  };

  return (
    <section className="terminal-panel market-analysis-panel">
      <header className="market-analysis-head">
        <div className="market-analysis-title">
          <span className="market-analysis-icon"><Flame size={15} /></span>
          <div>
            <h3>每日盘前分析</h3>
            <p className="market-analysis-date">盘前分析日期：{dateLabel}</p>
          </div>
        </div>
        <div className="market-analysis-meta">
          <span>后端盘前分析</span>
          <span>{mainLines.length ? `${mainLines.length} 个市场主线` : '暂无主线数据'}</span>
        </div>
      </header>

      <div className="market-analysis-body">
        {loading && <div className="market-analysis-state"><span className="loading-pulse" />分析加载中...</div>}
        {!loading && error && <div className="market-analysis-state is-error">{error}</div>}
        {!loading && !error && mainLines.length === 0 && (
          <div className="market-analysis-state">该盘前分析日期暂无盘前分析数据</div>
        )}

        {!loading && !error && mainLines.map((line) => {
          return (
            <button
              type="button"
              key={`${line.rank}-${line.title}`}
              onClick={() => setSelectedLine(line)}
              className={`market-mainline-row is-${line.priority}`}
            >
              <span className="market-mainline-rank">{String(line.rank).padStart(2, '0')}</span>
              <div className="market-mainline-content">
                <div className="market-mainline-heading">
                  <div>
                    <h4>
                      {line.title}
                      {line.rank === 1 && <TrendingUp size={14} />}
                    </h4>
                  </div>
                  <span className="market-priority-tag">{getPriorityLabel(line.priority)}</span>
                </div>
                <p><span>理由</span>{line.reason?.trim() || '后端未返回详细理由'}</p>
              </div>
              <span className="market-mainline-action">查看详情</span>
            </button>
          );
        })}
      </div>

      {adviceText && <aside className="market-analysis-advice">
        <Lightbulb size={15} />
        <div><strong>市场研判</strong><p>{adviceText}</p></div>
      </aside>}

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
          </section>
        </div>
      )}
    </section>
  );
}

import { Building2, Sparkles, Tag } from 'lucide-react';
import type { NewsItem, Sentiment } from '../../lib/api';
import { ReadingProgress } from '../../components/ReadingProgress';
import * as m from 'motion/react-m';
import { useEntranceMotion } from '../../components/StudioMotion';

export function sentimentLabel(sentiment: Sentiment): string {
  return sentiment === 'positive' ? '利好' : sentiment === 'negative' ? '利空' : '中性';
}

export function scoreText(score: number): string {
  return `${score > 0 ? '+' : ''}${score.toFixed(0)}`;
}

export function NewsArticle({ item }: { item: NewsItem }) {
  const headlineEntrance = useEntranceMotion({ lift: true });
  const contentEntrance = useEntranceMotion({ delay: .035 });
  const analysisEntrance = useEntranceMotion({ lift: true, delay: .07 });
  const isMeaningful = (value: string) => !/^(不涉及[板版]块|暂无|无|未涉及)$/.test(value.trim());
  const sectors = item.relatedSectors?.filter(isMeaningful) ?? [];
  const points = item.keyPoints.filter(isMeaningful);
  return (
    <>
      <ReadingProgress />
      <m.header key={`${item.id}:headline`} className="news-detail-head" {...headlineEntrance}>
        <div className="news-detail-meta">
          <span>{item.source}</span><span>{item.publishTime || item.time}</span>
          <span className={`sentiment-pill sentiment-${item.sentiment}`}>
            {sentimentLabel(item.sentiment)} {scoreText(item.impact)}
          </span>
        </div>
        <h2>{item.title}</h2>
      </m.header>
      <m.section key={`${item.id}:content`} className="news-detail-section news-content" {...contentEntrance}><p>{item.content || item.summary || '暂无正文'}</p></m.section>
      {item.analysisReason && (
        <m.section key={`${item.id}:analysis`} className="news-detail-section ai-analysis-block" {...analysisEntrance}>
          <h3><Sparkles size={14} />AI 影响分析</h3><p>{item.analysisReason}</p>
        </m.section>
      )}
      {points.length > 0 && (
        <section className="news-detail-section">
          <h3><Tag size={14} />关键要点</h3>
          <ul className="news-key-points">{points.map((point, index) => <li key={index}>{point}</li>)}</ul>
        </section>
      )}
      {(item.relatedStocks.length > 0 || sectors.length > 0) && (
        <section className="news-detail-section relation-block">
          <h3><Building2 size={14} />关联标的</h3>
          <div className="relation-chips">
            {item.relatedStocks.map((stock) => <span key={`stock-${stock}`}>{stock}</span>)}
            {sectors.map((sector) => <span key={`sector-${sector}`}>{sector}</span>)}
          </div>
        </section>
      )}
    </>
  );
}

import { TrendingUp, TrendingDown, Clock, Minus } from 'lucide-react';

interface NewsCardProps {
  id: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedStocks: string[];
  impact: number;
  isActive: boolean;
  onClick: () => void;
}

function toDisplayScore(
  impact: number,
  sentiment: 'positive' | 'negative' | 'neutral',
): string {
  const absValue = Math.abs(impact);
  const baseText =
    absValue < 1
      ? absValue.toFixed(1).replace(/\.0$/, '')
      : Math.round(absValue).toString();
  if (sentiment === 'negative') return `-${baseText}`;
  return baseText;
}

export function NewsCard({
  title,
  summary,
  source,
  time,
  sentiment,
  impact,
  isActive,
  onClick,
}: NewsCardProps) {
  const score = toDisplayScore(impact, sentiment);

  const getSentimentStyle = () => {
    if (sentiment === 'positive') return 'bg-green-500/10 border-green-500/30 text-green-400';
    if (sentiment === 'negative') return 'bg-red-500/10 border-red-500/30 text-red-400';
    return 'bg-slate-700/30 border-slate-600/30 text-slate-400';
  };

  const getSentimentIcon = () => {
    if (sentiment === 'positive') return <TrendingUp className="w-3 h-3" />;
    if (sentiment === 'negative') return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getSentimentLabel = () => {
    if (sentiment === 'positive') return '利好';
    if (sentiment === 'negative') return '利空';
    return '中性';
  };

  return (
    <div
      onClick={onClick}
      className={`p-2.5 rounded-xl cursor-pointer transition-all ${
        isActive
          ? 'bg-blue-500/10 border border-blue-500/50'
          : 'bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/50 hover:border-slate-600/50'
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs shrink-0 ${getSentimentStyle()}`}
        >
          {getSentimentIcon()}
          <span>{score}分</span>
          <span className="opacity-70">·</span>
          <span>{getSentimentLabel()}</span>
        </div>
        <h4 className="flex-1 text-sm text-white line-clamp-2 leading-snug">{title}</h4>
      </div>

      <p className="text-xs text-slate-400 mb-2 line-clamp-2 leading-relaxed">{summary}</p>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>{source}</span>
        <span>·</span>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}

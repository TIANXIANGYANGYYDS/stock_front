import { TrendingUp, TrendingDown, Clock, Share2, Bookmark } from 'lucide-react';

interface NewsData {
  id: string;
  title: string;
  content: string;
  source: string;
  time: string;
  author: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedStocks: string[];
  impact: number;
  keyPoints: string[];
}

interface NewsDetailProps {
  news: NewsData;
}

export function NewsDetail({ news }: NewsDetailProps) {
  const getSentimentColor = () => {
    switch (news.sentiment) {
      case 'positive': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'negative': return 'text-red-400 bg-red-500/10 border-red-500/30';
      default: return 'text-slate-400 bg-slate-700/30 border-slate-600/30';
    }
  };

  const getSentimentText = () => {
    switch (news.sentiment) {
      case 'positive': return '利好';
      case 'negative': return '利空';
      default: return '中性';
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="mb-3 text-lg text-white">{news.title}</h1>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{news.source}</span>
              <span>·</span>
              <span>{news.author}</span>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{news.time}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors">
              <Share2 className="w-4 h-4 text-slate-400" />
            </button>
            <button className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors">
              <Bookmark className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-slate-800/50">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getSentimentColor()}`}>
            {news.sentiment === 'positive' ? <TrendingUp className="w-4 h-4" /> :
             news.sentiment === 'negative' ? <TrendingDown className="w-4 h-4" /> : null}
            <span className="text-sm">{getSentimentText()}</span>
          </div>

          <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-sm">
            预期影响: {news.impact > 0 ? '+' : ''}{news.impact}%
          </div>

          <div className="flex items-center gap-2">
            {news.relatedStocks.map((stock) => (
              <span key={`stock-${news.id}-${stock}`} className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300">
                {stock}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="mb-3 text-sm text-white">核心要点</h3>
          <div className="space-y-2">
            {news.keyPoints.map((point, index) => (
              <div key={`keypoint-${news.id}-${index}`} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center flex-shrink-0 text-xs">
                  {index + 1}
                </div>
                <p className="flex-1 text-sm text-slate-300 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm text-white">详细内容</h3>
          <div className="space-y-4">
            {news.content.split('\n\n').map((paragraph, index) => (
              <p key={`paragraph-${news.id}-${index}`} className="text-sm text-slate-400 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

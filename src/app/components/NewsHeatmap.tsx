import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Flame } from 'lucide-react';
import { getNewsHeatmap, type NewsHeatmapResponse, type RankingWindow, type TrendSeries } from '../lib/api';

interface NewsHeatmapProps {
  bizDate: string;
  window: RankingWindow;
  onSectorClick: (sector: string | null) => void;
  selectedSector: string | null;
}

function formatDateLabel(date: string) {
  if (!date) return '';
  return date.length >= 10 ? date.slice(5) : date;
}

function buildChartData(series: TrendSeries[]) {
  const dateMap = new Map<string, Record<string, number | string>>();

  series.forEach((line) => {
    line.data.forEach((point) => {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, { date: formatDateLabel(point.date) });
      }
      dateMap.get(point.date)![line.name] = point.value;
    });
  });

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

export function NewsHeatmap({ bizDate, window, onSectorClick, selectedSector }: NewsHeatmapProps) {
  const [data, setData] = useState<NewsHeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHeatmap() {
      setLoading(true);
      setError(null);
      try {
        const response = await getNewsHeatmap(bizDate, window);
        if (!cancelled) {
          setData(response);
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : '板块热度加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHeatmap();

    return () => {
      cancelled = true;
    };
  }, [bizDate, window]);

  const hotSectors = data?.items ?? [];
  const baseSeries = data?.series ?? [];

  const hasSelected = !!selectedSector && hotSectors.some((s) => s.name === selectedSector);
  const displaySeries = hasSelected
    ? baseSeries.filter((s) => s.name === selectedSector)
    : baseSeries.slice(0, 5);
  const displayChartData = useMemo(() => buildChartData(displaySeries), [displaySeries]);

  const lineColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#64748b'];

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return (
          <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded text-xs">
            利好
          </span>
        );
      case 'negative':
        return (
          <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-xs">
            利空
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-700/30 border border-slate-600/30 text-slate-400 rounded text-xs">
            中性
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm text-white">版块新闻热度</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1">Stock_Project 资讯热度与情绪 · {bizDate}</p>
      </div>

      <div className="p-5">
        {loading && <div className="text-xs text-slate-400 mb-3">热度加载中...</div>}
        {!loading && error && <div className="text-xs text-red-400 mb-3">{error}</div>}

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={displayChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#334155" tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#334155" tickLine={false} width={35} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {displaySeries.map((sector, index) => (
              <Line
                key={sector.name}
                type="monotone"
                dataKey={sector.name}
                stroke={lineColors[index % lineColors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={sector.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="px-5 pb-5">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 gap-px bg-slate-700/30">
            <div className="px-3 py-2 bg-slate-800/50 text-xs text-slate-400">排名</div>
            <div className="px-3 py-2 bg-slate-800/50 text-xs text-slate-400 col-span-2">板块</div>
            <div className="px-3 py-2 bg-slate-800/50 text-xs text-slate-400 text-right">资讯数</div>
            <div className="px-3 py-2 bg-slate-800/50 text-xs text-slate-400 text-center">当前情绪</div>
          </div>
          <div className="divide-y divide-slate-700/30">
            {hotSectors.map((sector) => (
              <div
                key={`${sector.rank}-${sector.name}`}
                className={`grid grid-cols-5 gap-px cursor-pointer transition-colors ${
                  selectedSector === sector.name ? 'bg-blue-500/20' : 'bg-slate-800/20 hover:bg-slate-800/40'
                }`}
                onClick={() => onSectorClick(selectedSector === sector.name ? null : sector.name)}
              >
                <div className="px-3 py-2.5 text-xs text-slate-400">#{sector.rank}</div>
                <div
                  className={`px-3 py-2.5 text-sm col-span-2 ${
                    selectedSector === sector.name ? 'text-blue-300' : 'text-slate-200'
                  }`}
                >
                  {sector.name}
                </div>
                <div className="px-3 py-2.5 text-right">
                  <div className="text-sm text-white">{sector.count}</div>
                  {sector.score !== undefined && <div className="text-xs text-slate-500">评分 {sector.score.toFixed(2)}</div>}
                </div>
                <div className="px-3 py-2.5 flex items-center justify-center">
                  {getSentimentBadge(sector.avgSentiment)}
                </div>
              </div>
            ))}

            {!loading && !hotSectors.length && (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">该周期暂无排行榜快照</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

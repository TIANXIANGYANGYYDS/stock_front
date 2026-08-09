import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity, Flame } from 'lucide-react';

export function SentimentAnalysis() {
  const sentimentData = [
    { id: 'positive', name: '利好', value: 45, color: '#22c55e' },
    { id: 'neutral', name: '中性', value: 30, color: '#94a3b8' },
    { id: 'negative', name: '利空', value: 25, color: '#ef4444' }
  ];

  const trendData = [
    { id: 'mon', date: '周一', positive: 38, negative: 28, neutral: 34 },
    { id: 'tue', date: '周二', positive: 42, negative: 25, neutral: 33 },
    { id: 'wed', date: '周三', positive: 40, negative: 30, neutral: 30 },
    { id: 'thu', date: '周四', positive: 45, negative: 22, neutral: 33 },
    { id: 'fri', date: '周五', positive: 48, negative: 20, neutral: 32 }
  ];

  const hotTopics = [
    { id: 1, topic: '科技创新', count: 156, sentiment: 'positive' },
    { id: 2, topic: '政策利好', count: 134, sentiment: 'positive' },
    { id: 3, topic: '市场波动', count: 98, sentiment: 'neutral' },
    { id: 4, topic: '业绩下滑', count: 76, sentiment: 'negative' },
    { id: 5, topic: '行业整合', count: 65, sentiment: 'neutral' }
  ];

  return (
    <div className="space-y-5">
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-green-400">利好资讯</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-2xl text-green-400">45%</div>
          <div className="text-xs text-green-500/70 mt-1">较昨日 +3%</div>
        </div>

        <div className="p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">中性资讯</span>
            <Minus className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl text-slate-300">30%</div>
          <div className="text-xs text-slate-500 mt-1">较昨日 -1%</div>
        </div>

        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-red-400">利空资讯</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl text-red-400">25%</div>
          <div className="text-xs text-red-500/70 mt-1">较昨日 -2%</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm text-white">情绪分布</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={sentimentData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
              >
                {sentimentData.map((entry) => (
                  <Cell key={`sentiment-cell-${entry.id}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#e2e8f0'
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm text-white">周度趋势</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#64748b' }}
                stroke="#334155"
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                stroke="#334155"
                tickLine={false}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#e2e8f0'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Bar dataKey="positive" stackId="a" fill="#22c55e" name="利好" radius={[0, 0, 0, 0]} />
              <Bar dataKey="neutral" stackId="a" fill="#94a3b8" name="中性" radius={[0, 0, 0, 0]} />
              <Bar dataKey="negative" stackId="a" fill="#ef4444" name="利空" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hot Topics */}
      <div className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm text-white">热点话题</h3>
        </div>
        <div className="space-y-2">
          {hotTopics.map((topic) => {
            const getSentimentIcon = () => {
              if (topic.sentiment === 'positive') return <TrendingUp className="w-4 h-4 text-green-400" />;
              if (topic.sentiment === 'negative') return <TrendingDown className="w-4 h-4 text-red-400" />;
              return <Minus className="w-4 h-4 text-slate-400" />;
            };

            const getSentimentBg = () => {
              if (topic.sentiment === 'positive') return 'bg-green-500/10 border-green-500/30';
              if (topic.sentiment === 'negative') return 'bg-red-500/10 border-red-500/30';
              return 'bg-slate-700/30 border-slate-600/30';
            };

            return (
              <div
                key={`topic-${topic.id}`}
                className={`flex items-center justify-between p-3 border rounded-xl ${getSentimentBg()} hover:bg-opacity-50 transition-all duration-200`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 bg-slate-800/50 rounded-full text-xs text-slate-400">
                    {topic.id}
                  </span>
                  <span className="text-sm text-slate-300">{topic.topic}</span>
                  {getSentimentIcon()}
                </div>
                <span className="text-sm text-slate-500">{topic.count} 条</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

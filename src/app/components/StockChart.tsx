import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StockChartProps {
  stockCode: string;
  stockName: string;
}

export function StockChart({ stockCode, stockName }: StockChartProps) {
  const data = [
    { time: '09:30', price: 15.23 },
    { time: '10:00', price: 15.45 },
    { time: '10:30', price: 15.38 },
    { time: '11:00', price: 15.67 },
    { time: '11:30', price: 15.82 },
    { time: '13:00', price: 15.76 },
    { time: '13:30', price: 15.91 },
    { time: '14:00', price: 16.05 },
    { time: '14:30', price: 16.18 },
    { time: '15:00', price: 16.32 }
  ];

  const change = ((data[data.length - 1].price - data[0].price) / data[0].price * 100).toFixed(2);
  const isPositive = parseFloat(change) >= 0;
  const gradientId = `priceGradient-${stockCode}`;

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm text-white">{stockName}</h4>
            <span className="text-xs text-slate-500">{stockCode}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-lg ${isPositive ? 'text-red-400' : 'text-green-400'}`}>
              ¥{data[data.length - 1].price.toFixed(2)}
            </span>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${
          isPositive ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span className="text-xs">
            {isPositive ? '+' : ''}{change}%
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? "#f87171" : "#4ade80"} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={isPositive ? "#f87171" : "#4ade80"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#64748b' }}
              stroke="#334155"
              tickLine={false}
              interval={2}
            />
            <YAxis
              domain={['dataMin - 0.1', 'dataMax + 0.1']}
              tick={{ fontSize: 10, fill: '#64748b' }}
              stroke="#334155"
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '11px',
                padding: '8px 12px',
                color: '#e2e8f0'
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? "#f87171" : "#4ade80"}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

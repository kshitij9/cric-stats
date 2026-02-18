'use client';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

export default function EraChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500 italic">
        No era data available for this player...
      </div>
    );
  }

  // Sort data by year ascending for the chart
  const sortedData = [...data].sort((a, b) => a.year - b.year);

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sortedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIndex" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="year" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#71717a', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            domain={[0.5, 'auto']} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#71717a', fontSize: 12 }} 
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
            itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
          />
          {/* Baseline: 1.0 represents the global average for that year */}
          <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Avg', fill: '#ef4444', fontSize: 10 }} />
          <Area 
            type="monotone" 
            dataKey="era_index" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorIndex)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
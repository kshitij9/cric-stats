import { Trophy, Swords, BarChart3, TrendingUp } from 'lucide-react';

interface StatsData {
  matches: number;
  wins_1: number;
  wins_2: number;
  no_result: number;
}

interface Props {
  data: StatsData;
  t1: string;
  t2: string;
}

export default function ComparisonCard({ data, t1, t2 }: Props) {
  const winRate1 = ((data.wins_1 / data.matches) * 100).toFixed(1);
  const winRate2 = ((data.wins_2 / data.matches) * 100).toFixed(1);

  return (
    <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
      {/* Header Comparison */}
      <div className="flex items-center justify-between mb-10">
        <div className="text-center flex-1">
          <div className="h-20 w-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black mb-3 shadow-lg shadow-blue-900/20">
            {t1[0]}
          </div>
          <p className="text-lg font-bold tracking-tight">{t1}</p>
        </div>

        <div className="px-6">
          <Swords className="text-zinc-600 w-8 h-8" />
        </div>

        <div className="text-center flex-1">
          <div className="h-20 w-20 bg-red-600 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black mb-3 shadow-lg shadow-red-900/20">
            {t2[0]}
          </div>
          <p className="text-lg font-bold tracking-tight">{t2}</p>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase mb-2">
            <BarChart3 size={14} /> Total Played
          </div>
          <div className="text-4xl font-black">{data.matches}</div>
        </div>
        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase mb-2">
            <TrendingUp size={14} /> No Result
          </div>
          <div className="text-4xl font-black text-zinc-400">{data.no_result}</div>
        </div>
      </div>

      {/* Win Bars */}
      <div className="space-y-6">
        <StatBar label={`${t1} Victories`} value={data.wins_1} percent={winRate1} color="bg-blue-600" />
        <StatBar label={`${t2} Victories`} value={data.wins_2} percent={winRate2} color="bg-red-600" />
      </div>
    </div>
  );
}

function StatBar({ label, value, percent, color }: { label: string, value: number, percent: string, color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
        <span className="text-sm font-black">{value} <span className="text-zinc-500 font-normal">({percent}%)</span></span>
      </div>
      <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
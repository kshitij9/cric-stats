'use client';
import { useMemo, useState } from 'react';
import { useCricketStats } from '@/hooks/useCricketStats';
import EraChart from '@/components/EraChart';
import MatchupTable from '@/components/MatchupTable';
import PlayerRadar from '@/components/PlayerRadar';
import NavTabs from '@/components/NavTabs';
import { Search, ShieldAlert, BarChart3 } from 'lucide-react';

export default function PlayerPage() {
  const [inputName, setInputName] = useState('V Kohli');
  const [searchName, setSearchName] = useState('V Kohli');
  const [format, setFormat] = useState<string>('ODI');

  const { data: careerByFormat } = useCricketStats('career', searchName);
  const { data: matchups } = useCricketStats('matchup', searchName);
  const { data: era } = useCricketStats('era', searchName);
  const { data: fullProfileByFormat } = useCricketStats('player_full_profile', searchName);

  const availableFormats = useMemo(() => {
    if (!Array.isArray(careerByFormat)) return ['ODI', 'T20', 'Test'];
    const unique = new Set<string>();
    careerByFormat.forEach((r: any) => r?.format && unique.add(r.format));
    return Array.from(unique.values());
  }, [careerByFormat]);

  const career = useMemo(() => {
    if (!Array.isArray(careerByFormat)) return null;
    return careerByFormat.find((r) => r?.format === format) ?? null;
  }, [careerByFormat, format]);

  const eraForFormat = useMemo(() => {
    if (!Array.isArray(era)) return [];
    return era.filter((r) => r?.format === format);
  }, [era, format]);

  const eraIndexAvg = useMemo(() => {
    if (!Array.isArray(eraForFormat) || eraForFormat.length === 0) return null;
    const sum = eraForFormat.reduce((s: number, x: any) => s + Number(x.era_index ?? 0), 0);
    return sum / eraForFormat.length;
  }, [eraForFormat]);

  const profile = useMemo(() => {
    if (!Array.isArray(fullProfileByFormat)) return null;
    return fullProfileByFormat.find((r) => r?.format === format) ?? null;
  }, [fullProfileByFormat, format]);

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      <header className="max-w-7xl mx-auto flex flex-col gap-4 mb-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">
            Cric<span className="text-blue-500">Intell</span>
          </h1>
          <NavTabs />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="w-full md:w-[420px] space-y-2">
            <div className="relative flex">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                size={18}
              />
              <input
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-l-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Search Player (e.g., V Kohli)"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && setSearchName(inputName.trim())
                }
              />
              <button
                className="px-4 bg-blue-500 hover:bg-blue-600 text-sm font-semibold rounded-r-2xl border border-blue-500"
                onClick={() => setSearchName(inputName.trim())}
              >
                Go
              </button>
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-500">
          Viewing insights for{' '}
          <span className="font-semibold text-zinc-100">{searchName}</span>
        </p>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <FormatPicker formats={availableFormats} value={format} onChange={setFormat} />

          {career && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-wrap gap-6 items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-1">
                  Career Snapshot
                </p>
                <p className="text-lg font-semibold">
                  {career.player_name ?? searchName}{' '}
                  <span className="text-zinc-500 text-sm font-normal">({format})</span>
                </p>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-zinc-500 text-[11px] uppercase font-bold">
                    Innings
                  </p>
                  <p className="font-semibold">{career.innings}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-[11px] uppercase font-bold">
                    Runs
                  </p>
                  <p className="font-semibold">{career.runs}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-[11px] uppercase font-bold">
                    Avg
                  </p>
                  <p className="font-semibold">{career.average}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-[11px] uppercase font-bold">
                    SR
                  </p>
                  <p className="font-semibold">{career.strike_rate}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold mb-2">
              <BarChart3 className="text-sky-400" /> Player Profile Shape
            </h2>
            <p className="text-xs text-zinc-500 max-w-2xl mb-4">
              A quick way to understand a batter&apos;s style in {format}. Power hitters
              spike on <span className="text-zinc-200 font-semibold">Boundary %</span> and{' '}
              <span className="text-zinc-200 font-semibold">Strike Rate</span>. Anchors spike
              on <span className="text-zinc-200 font-semibold">Survival Rate</span> and{' '}
              <span className="text-zinc-200 font-semibold">Balls / Dismissal</span>.
              Era index shows how their scoring rate compares to the era average (1.00 = average).
            </p>
            <PlayerRadar format={format} profile={profile} eraIndexAvg={eraIndexAvg} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
              <BarChart3 className="text-blue-500" /> Era-Adjusted Performance
            </h2>
            <p className="text-xs text-zinc-500 max-w-xl mb-2">
              Era index compares a player&apos;s strike rate in a given season and format
              to the global average for that same season and format. 1.00 means they are
              exactly era-average; 1.20 means they score 20% faster than the typical batter
              in that context.
            </p>
            <EraChart data={eraForFormat ?? []} />
          </div>
        </section>

        <section className="space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold mb-6">
              <ShieldAlert className="text-red-500" /> Tactical Matchups
            </h2>
            <MatchupTable data={matchups} />
          </div>
        </section>
      </div>
    </main>
  );
}

function FormatPicker({
  formats,
  value,
  onChange,
}: {
  formats: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs text-zinc-500">Format:</span>
      {formats.map((f) => (
        <button
          key={f}
          className={[
            'px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors',
            f === value
              ? 'bg-blue-500/15 border-blue-500 text-blue-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-blue-500/70 hover:text-blue-200',
          ].join(' ')}
          onClick={() => onChange(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}


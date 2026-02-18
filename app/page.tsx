'use client';
import { useMemo, useState } from 'react';
import { useCricketStats } from '@/hooks/useCricketStats';
import EraChart from '@/components/EraChart';
import MatchupTable from '@/components/MatchupTable';
import PlayerRadar from '@/components/PlayerRadar';
import NavTabs from '@/components/NavTabs';
import { Search, ShieldAlert, BarChart3, Swords } from 'lucide-react';

export default function PlayerIntelligence() {
  // Single-player search
  const [inputName, setInputName] = useState('V Kohli');
  const [searchName, setSearchName] = useState('V Kohli');

  // Two-player duel + multi-player comparison (up to 4)
  const [compareA, setCompareA] = useState('V Kohli');
  const [compareB, setCompareB] = useState('RG Sharma');
  const [compareC, setCompareC] = useState('KS Williamson');
  const [compareD, setCompareD] = useState('SPD Smith');

  const [format, setFormat] = useState<string>('ODI');

  // Single-player stats
  const { data: careerByFormat } = useCricketStats('career', searchName);
  const { data: matchups } = useCricketStats('matchup', searchName);
  const { data: era } = useCricketStats('era', searchName);
  const { data: fullProfileByFormat } = useCricketStats('player_full_profile', searchName);

  // Comparison stats (career + era-adjusted)
  const { data: careerA } = useCricketStats('career', compareA);
  const { data: careerB } = useCricketStats('career', compareB);
  const { data: careerC } = useCricketStats('career', compareC);
  const { data: careerD } = useCricketStats('career', compareD);

  const { data: eraA } = useCricketStats('era', compareA);
  const { data: eraB } = useCricketStats('era', compareB);
  const { data: eraC } = useCricketStats('era', compareC);
  const { data: eraD } = useCricketStats('era', compareD);

  const availableFormats = useMemo(() => {
    const sets: string[] = [];
    const add = (rows: any) => {
      if (!Array.isArray(rows)) return;
      for (const r of rows) {
        if (r?.format && !sets.includes(r.format)) sets.push(r.format);
      }
    };
    add(careerByFormat);
    add(era);
    add(careerA);
    add(careerB);
    add(careerC);
    add(careerD);
    add(eraA);
    add(eraB);
    add(eraC);
    add(eraD);
    return sets.length ? sets : ['ODI', 'T20', 'Test'];
  }, [careerByFormat, era, careerA, careerB, careerC, careerD, eraA, eraB, eraC, eraD]);

  const career = useMemo(() => {
    if (!Array.isArray(careerByFormat)) return null;
    return careerByFormat.find((r) => r?.format === format) ?? null;
  }, [careerByFormat, format]);

  const eraForFormat = useMemo(() => {
    if (!Array.isArray(era)) return null;
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

  const latestEraA = useMemo(
    () =>
      Array.isArray(eraA) && eraA.length
        ? [...eraA]
            .filter((r) => r?.format === format)
            .sort((a, b) => a.year - b.year)
            .at(-1)
        : null,
    [eraA, format]
  );
  const latestEraB = useMemo(
    () =>
      Array.isArray(eraB) && eraB.length
        ? [...eraB]
            .filter((r) => r?.format === format)
            .sort((a, b) => a.year - b.year)
            .at(-1)
        : null,
    [eraB, format]
  );

  const avgEraA = useMemo(
    () =>
      Array.isArray(eraA) && eraA.length
        ? (() => {
            const rows = eraA.filter((r: any) => r?.format === format);
            return rows.length
              ? rows.reduce((s: number, x: any) => s + x.era_index, 0) / rows.length
              : null;
          })()
        : null,
    [eraA, format]
  );
  const avgEraB = useMemo(
    () =>
      Array.isArray(eraB) && eraB.length
        ? (() => {
            const rows = eraB.filter((r: any) => r?.format === format);
            return rows.length
              ? rows.reduce((s: number, x: any) => s + x.era_index, 0) / rows.length
              : null;
          })()
        : null,
    [eraB, format]
  );

  const quickPlayers = ['V Kohli', 'RG Sharma', 'KS Williamson', 'SPD Smith'];

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      {/* Top bar with nav + search */}
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

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-zinc-500">Quick picks:</span>
              {quickPlayers.map((p) => (
                <button
                  key={p}
                  className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 hover:border-blue-500 hover:text-blue-400 text-[11px] font-medium"
                  onClick={() => {
                    setInputName(p);
                    setSearchName(p);
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-500">
          Viewing insights for{' '}
          <span className="font-semibold text-zinc-100">{searchName}</span>
        </p>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Column 1–2: Era-adjusted analysis + quick career summary */}
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
              Power hitters spike on <span className="text-zinc-200 font-semibold">Boundary %</span> and{' '}
              <span className="text-zinc-200 font-semibold">Strike Rate</span>. Anchors spike on{' '}
              <span className="text-zinc-200 font-semibold">Survival Rate</span> and{' '}
              <span className="text-zinc-200 font-semibold">Balls / Dismissal</span>. Era index shows
              how scoring rate compares to the era average (1.00 = average).
            </p>
            <PlayerRadar format={format} profile={profile} eraIndexAvg={eraIndexAvg} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold mb-6">
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

        {/* Column 3: Tactical matchups */}
        <section className="space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold mb-6">
              <ShieldAlert className="text-red-500" /> Tactical Matchups
            </h2>
            <MatchupTable data={matchups} />
          </div>
        </section>
      </div>

      {/* Era-adjusted comparison section */}
      <section className="max-w-7xl mx-auto mt-10">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Swords className="text-emerald-400" /> Era-Adjusted Duel
          </h2>
          <p className="text-sm text-zinc-500">
            Compare how two players stack up once you normalize for the scoring
            environment of their eras. Era index &gt; 1 means a player is performing
            better than the average batter for that year and format; &lt; 1 means they&apos;re
            below the era baseline.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Player A</p>
              <input
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Player B</p>
              <input
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <EraComparisonCard label={compareA} latest={latestEraA} avg={avgEraA} format={format} />
            <EraComparisonCard label={compareB} latest={latestEraB} avg={avgEraB} format={format} />
          </div>
        </div>
      </section>

      {/* Multi-player stats comparison table */}
      <section className="max-w-7xl mx-auto mt-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <BarChart3 className="text-sky-400" /> Multi-Player Comparison
          </h2>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-sm text-zinc-500">
              Line up multiple greats and compare their raw numbers plus era-adjusted index.
              Era index shows how a player&apos;s scoring rate compares to the average batter
              in the same era and format.
            </p>
            <FormatPicker formats={availableFormats} value={format} onChange={setFormat} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <CompareInput label="Player 1" value={compareA} onChange={setCompareA} />
            <CompareInput label="Player 2" value={compareB} onChange={setCompareB} />
            <CompareInput label="Player 3" value={compareC} onChange={setCompareC} />
            <CompareInput label="Player 4" value={compareD} onChange={setCompareD} />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-4 text-left font-semibold">Player</th>
                  <th className="py-2 px-4 text-right font-semibold">Innings</th>
                  <th className="py-2 px-4 text-right font-semibold">Runs</th>
                  <th className="py-2 px-4 text-right font-semibold">Avg</th>
                  <th className="py-2 px-4 text-right font-semibold">SR</th>
                  <th className="py-2 pl-4 text-right font-semibold">Era Index (avg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                <CompareRow label={compareA} career={careerA} era={eraA} format={format} />
                <CompareRow label={compareB} career={careerB} era={eraB} format={format} />
                <CompareRow label={compareC} career={careerC} era={eraC} format={format} />
                <CompareRow label={compareD} career={careerD} era={eraD} format={format} />
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function EraComparisonCard({
  label,
  latest,
  avg,
  format,
}: {
  label: string;
  latest: any | null;
  avg: number | null;
  format: string;
}) {
  if (!latest && avg == null) {
    return (
      <div className="h-24 rounded-2xl border border-dashed border-zinc-800 flex items-center justify-center text-xs text-zinc-500">
        No era data yet for{' '}
        <span className="ml-1 font-semibold text-zinc-300">{label}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-2">
      <p className="text-sm font-semibold">{label}</p>
      {latest && (
        <p className="text-xs text-zinc-400">
          Latest season ({latest.year}, {format}):{' '}
          <span className="font-semibold text-emerald-400">
            {latest.era_index.toFixed(2)}× era index
          </span>
        </p>
      )}
      {avg != null && (
        <p className="text-xs text-zinc-400">
          Career era-adjusted index ({format}):{' '}
          <span className="font-semibold text-emerald-400">
            {avg.toFixed(2)}×
          </span>
        </p>
      )}
    </div>
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

function CompareInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <input
        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CompareRow({
  label,
  career,
  era,
  format,
}: {
  label: string;
  career: any;
  era: any;
  format: string;
}) {
  const hasCareer = Array.isArray(career) && career.length > 0;
  const row = hasCareer ? career.find((r: any) => r?.format === format) ?? null : null;

  const eraAvg =
    Array.isArray(era) && era.length
      ? (() => {
          const rows = era.filter((r: any) => r?.format === format);
          return rows.length
            ? rows.reduce((s: number, x: any) => s + x.era_index, 0) / rows.length
            : null;
        })()
      : null;

  if (!hasCareer && eraAvg == null) {
    return null;
  }

  return (
    <tr>
      <td className="py-2 pr-4 font-semibold text-zinc-100">{label}</td>
      <td className="py-2 px-4 text-right">
        {row ? row.innings : <span className="text-zinc-600">–</span>}
      </td>
      <td className="py-2 px-4 text-right">
        {row ? row.runs : <span className="text-zinc-600">–</span>}
      </td>
      <td className="py-2 px-4 text-right">
        {row ? row.average : <span className="text-zinc-600">–</span>}
      </td>
      <td className="py-2 px-4 text-right">
        {row ? row.strike_rate : <span className="text-zinc-600">–</span>}
      </td>
      <td className="py-2 pl-4 text-right">
        {eraAvg != null ? (
          <span className="font-semibold text-emerald-400">
            {eraAvg.toFixed(2)}×
          </span>
        ) : (
          <span className="text-zinc-600">–</span>
        )}
      </td>
    </tr>
  );
}
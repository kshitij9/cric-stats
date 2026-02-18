'use client';
import { useMemo, useState } from 'react';
import { useCricketStats } from '@/hooks/useCricketStats';
import EraChart from '@/components/EraChart';
import DuelRadar from '@/components/DuelRadar';
import NavTabs from '@/components/NavTabs';
import { Swords, Search } from 'lucide-react';

export default function DuelPage() {
  const [playerA, setPlayerA] = useState('V Kohli');
  const [playerB, setPlayerB] = useState('RG Sharma');
  const [format, setFormat] = useState<string>('ODI');

  const { data: eraA } = useCricketStats('era', playerA);
  const { data: eraB } = useCricketStats('era', playerB);
  const { data: profileAByFormat } = useCricketStats('player_full_profile', playerA);
  const { data: profileBByFormat } = useCricketStats('player_full_profile', playerB);

  const latestEraA = useMemo(
    () =>
      Array.isArray(eraA)
        ? [...eraA]
            .filter((r) => r?.format === format)
            .sort((a, b) => a.year - b.year)
            .at(-1)
        : null,
    [eraA, format]
  );

  const latestEraB = useMemo(
    () =>
      Array.isArray(eraB)
        ? [...eraB]
            .filter((r) => r?.format === format)
            .sort((a, b) => a.year - b.year)
            .at(-1)
        : null,
    [eraB, format]
  );

  const avgEraA = useMemo(() => {
    if (!Array.isArray(eraA)) return null;
    const rows = eraA.filter((r: any) => r?.format === format);
    return rows.length
      ? rows.reduce((s: number, x: any) => s + x.era_index, 0) / rows.length
      : null;
  }, [eraA, format]);

  const avgEraB = useMemo(() => {
    if (!Array.isArray(eraB)) return null;
    const rows = eraB.filter((r: any) => r?.format === format);
    return rows.length
      ? rows.reduce((s: number, x: any) => s + x.era_index, 0) / rows.length
      : null;
  }, [eraB, format]);

  const eraAForFormat = useMemo(
    () =>
      Array.isArray(eraA)
        ? eraA.filter((r: any) => r?.format === format)
        : [],
    [eraA, format]
  );

  const eraBForFormat = useMemo(
    () =>
      Array.isArray(eraB)
        ? eraB.filter((r: any) => r?.format === format)
        : [],
    [eraB, format]
  );

  const profileA = useMemo(() => {
    if (!Array.isArray(profileAByFormat)) return null;
    return profileAByFormat.find((r: any) => r?.format === format) ?? null;
  }, [profileAByFormat, format]);

  const profileB = useMemo(() => {
    if (!Array.isArray(profileBByFormat)) return null;
    return profileBByFormat.find((r: any) => r?.format === format) ?? null;
  }, [profileBByFormat, format]);

  const eraIndexAvgA = avgEraA;
  const eraIndexAvgB = avgEraB;

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      <header className="max-w-4xl mx-auto flex flex-col gap-4 mb-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
            <Swords className="text-emerald-400" /> Era-Adjusted Duel
          </h1>
          <NavTabs />
        </div>
        <p className="text-sm text-zinc-500 max-w-2xl">
          Pick any two batters and compare how they stack up once you normalize for the
          scoring environment of their eras. Era index compares a player&apos;s strike
          rate to the average batter for that year and format (1.00 = average, 1.20 = 20% better).
        </p>
      </header>

      <section className="max-w-4xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlayerInput label="Player A" value={playerA} onChange={setPlayerA} />
          <PlayerInput label="Player B" value={playerB} onChange={setPlayerB} />
        </div>

        <FormatPicker
          formats={['ODI', 'T20', 'Test']}
          value={format}
          onChange={setFormat}
        />

        {/* Overlapped radar profile for both players */}
        <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
          <p className="text-xs text-zinc-400 mb-2">
            Overlayed style comparison in {format}. Blue = {playerA}, Orange = {playerB}.
          </p>
          <DuelRadar
            format={format}
            labelA={playerA}
            labelB={playerB}
            profileA={profileA}
            profileB={profileB}
            eraIndexAvgA={eraIndexAvgA}
            eraIndexAvgB={eraIndexAvgB}
          />
        </div>

        {/* Era index charts stacked vertically */}
        <div className="mt-4 space-y-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 mb-2">
              {playerA} – Era index by year ({format})
            </p>
            <EraChart data={eraAForFormat} />
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 mb-2">
              {playerB} – Era index by year ({format})
            </p>
            <EraChart data={eraBForFormat} />
          </div>
        </div>

        {/* Summary cards side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <EraCard label={playerA} latest={latestEraA} avg={avgEraA} format={format} />
          <EraCard label={playerB} latest={latestEraB} avg={avgEraB} format={format} />
        </div>
      </section>
    </main>
  );
}

function PlayerInput({
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
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          size={16}
        />
        <input
          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-2.5 pl-9 pr-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
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
              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-emerald-500/70 hover:text-emerald-200',
          ].join(' ')}
          onClick={() => onChange(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function EraCard({
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
        No era data yet for <span className="ml-1 font-semibold text-zinc-300">{label}</span>
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


'use client';
import { useMemo, useState } from 'react';
import { useCricketStats } from '@/hooks/useCricketStats';
import NavTabs from '@/components/NavTabs';
import { BarChart3, Plus, X } from 'lucide-react';

type Factor = {
  key: string;
  label: string;
  unit: string;
  get: (ctx: {
    career: any | null;
    profile: any | null;
    eraAvg: number | null;
  }) => number | null;
};

const FACTORS: Factor[] = [
  { key: 'innings', label: 'Innings', unit: '', get: ({ career }) => career?.innings ?? null },
  { key: 'runs', label: 'Runs', unit: '', get: ({ career }) => career?.runs ?? null },
  { key: 'average', label: 'Average', unit: '', get: ({ career }) => career?.average ?? null },
  { key: 'strike_rate', label: 'Strike Rate', unit: '', get: ({ career }) => career?.strike_rate ?? null },
  { key: 'fours', label: 'Fours', unit: '', get: ({ career }) => career?.fours ?? null },
  { key: 'sixes', label: 'Sixes', unit: '', get: ({ career }) => career?.sixes ?? null },
  {
    key: 'boundary_percent',
    label: 'Boundary %',
    unit: '%',
    get: ({ profile }) => profile?.boundary_percent ?? null,
  },
  {
    key: 'survival_rate',
    label: 'Survival Rate',
    unit: '%',
    get: ({ profile }) => profile?.survival_rate ?? null,
  },
  {
    key: 'balls_per_dismissal',
    label: 'Balls / Dismissal',
    unit: '',
    get: ({ profile }) => profile?.balls_per_dismissal ?? null,
  },
  {
    key: 'era_index',
    label: 'Era Index (avg)',
    unit: '×',
    get: ({ eraAvg }) => eraAvg,
  },
];

const DEFAULT_FACTOR_KEYS = ['innings', 'runs', 'average', 'strike_rate', 'era_index'];
const DEFAULT_PLAYERS = ['V Kohli', 'RG Sharma', 'KS Williamson', 'SPD Smith'];

export default function ComparePage() {
  const [format, setFormat] = useState<string>('ODI');
  const [players, setPlayers] = useState<string[]>(DEFAULT_PLAYERS);
  const [factorKeys, setFactorKeys] = useState<string[]>(DEFAULT_FACTOR_KEYS);

  const selectedFactors = useMemo(
    () => FACTORS.filter((f) => factorKeys.includes(f.key)),
    [factorKeys]
  );

  const updatePlayer = (index: number, value: string) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  };

  const addPlayer = () => setPlayers((prev) => [...prev, '']);

  const removePlayer = (index: number) =>
    setPlayers((prev) => prev.filter((_, i) => i !== index));

  const toggleFactor = (key: string) =>
    setFactorKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      <header className="max-w-7xl mx-auto flex flex-col gap-4 mb-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
            <BarChart3 className="text-sky-400" /> Multi-Player Comparison
          </h1>
          <NavTabs />
        </div>
        <p className="text-sm text-zinc-500 max-w-2xl">
          Line up any number of players in the same format and compare them across any
          combination of factors you pick below.
        </p>
      </header>

      <section className="max-w-7xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div>
          <p className="text-xs text-zinc-500 mb-2">Players</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {players.map((p, i) => (
              <CompareInput
                key={i}
                label={`Player ${i + 1}`}
                value={p}
                onChange={(v) => updatePlayer(i, v)}
                onRemove={players.length > 1 ? () => removePlayer(i) : undefined}
              />
            ))}
          </div>
          <button
            onClick={addPlayer}
            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
          >
            <Plus size={14} /> Add player
          </button>
        </div>

        <FormatPicker
          formats={['ODI', 'T20', 'Test']}
          value={format}
          onChange={setFormat}
        />

        <div>
          <p className="text-xs text-zinc-500 mb-2">Factors</p>
          <div className="flex flex-wrap gap-2">
            {FACTORS.map((f) => {
              const active = factorKeys.includes(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => toggleFactor(f.key)}
                  className={[
                    'px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors',
                    active
                      ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-sky-500/70 hover:text-sky-200',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-4 text-left font-semibold">Player</th>
                {selectedFactors.map((f) => (
                  <th key={f.key} className="py-2 px-4 text-right font-semibold">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {players
                .filter((p) => p.trim().length > 0)
                .map((p, i) => (
                  <CompareRow
                    key={`${p}-${i}`}
                    label={p}
                    format={format}
                    factors={selectedFactors}
                  />
                ))}
            </tbody>
          </table>
          {selectedFactors.length === 0 && (
            <p className="text-xs text-zinc-600 italic mt-4">
              Pick at least one factor above to see numbers.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function CompareInput({
  label,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-zinc-500">{label}</p>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-zinc-600 hover:text-red-400 transition-colors"
            aria-label={`Remove ${label}`}
          >
            <X size={12} />
          </button>
        )}
      </div>
      <input
        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
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
    <div className="flex flex-wrap gap-2 items-center mt-2">
      <span className="text-xs text-zinc-500">Format:</span>
      {formats.map((f) => (
        <button
          key={f}
          className={[
            'px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors',
            f === value
              ? 'bg-sky-500/15 border-sky-500 text-sky-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-sky-500/70 hover:text-sky-200',
          ].join(' ')}
          onClick={() => onChange(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function CompareRow({
  label,
  format,
  factors,
}: {
  label: string;
  format: string;
  factors: Factor[];
}) {
  const { data: careerByFormat } = useCricketStats('career', label);
  const { data: profileByFormat } = useCricketStats('player_full_profile', label);
  const { data: eraData } = useCricketStats('era', label);

  const career = useMemo(() => {
    if (!Array.isArray(careerByFormat)) return null;
    return careerByFormat.find((r: any) => r?.format === format) ?? null;
  }, [careerByFormat, format]);

  const profile = useMemo(() => {
    if (!Array.isArray(profileByFormat)) return null;
    return profileByFormat.find((r: any) => r?.format === format) ?? null;
  }, [profileByFormat, format]);

  const eraAvg = useMemo(() => {
    if (!Array.isArray(eraData)) return null;
    const rows = eraData.filter((r: any) => r?.format === format);
    if (!rows.length) return null;
    return rows.reduce((s: number, x: any) => s + Number(x.era_index ?? 0), 0) / rows.length;
  }, [eraData, format]);

  const hasAnyData = career != null || profile != null || eraAvg != null;

  if (!hasAnyData) {
    return (
      <tr>
        <td className="py-2 pr-4 font-semibold text-zinc-100">{label}</td>
        <td
          colSpan={Math.max(factors.length, 1)}
          className="py-2 px-4 text-right text-zinc-600 italic"
        >
          No data for {format}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="py-2 pr-4 font-semibold text-zinc-100">{label}</td>
      {factors.map((f) => {
        const raw = f.get({ career, profile, eraAvg });
        return (
          <td key={f.key} className="py-2 px-4 text-right">
            {raw != null ? (
              f.key === 'era_index' ? (
                <span className="font-semibold text-emerald-400">
                  {Number(raw).toFixed(2)}
                  {f.unit}
                </span>
              ) : (
                <span>
                  {Number(raw)}
                  {f.unit}
                </span>
              )
            ) : (
              <span className="text-zinc-600">–</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import NavTabs from '@/components/NavTabs';
import { Sparkles, Plus, X, AlertTriangle } from 'lucide-react';

type Role = 'batter' | 'bowler';
type Mode = 'discovery' | 'shortlist';

type FactorDetail = {
  sample_balls: number;
  sample_events: number;
  observed: number;
  rate_factor: number;
  event_factor: number;
};

type Available = {
  player: string;
  data_available: true;
  rank: number;
  predicted: Record<string, number>;
  baseline: Record<string, number>;
  factors: Partial<Record<'venue' | 'matchup' | 'opposition' | 'phase' | 'innings', FactorDetail>>;
  missing_context: string[];
  sample_balls: number;
  confidence: 'none' | 'low' | 'medium' | 'high';
};
type PlayerResult = Available | { player: string; data_available: false };

type RecResponse = {
  role: Role;
  format: string;
  mode: Mode;
  recommendation: string | null;
  caveats: string[];
  players: PlayerResult[];
};

const FORMATS = ['ODI', 'T20', 'Test'];
const PHASES = ['powerplay', 'middle', 'death'];
const GENDERS: { v: string; label: string }[] = [
  { v: 'male', label: 'Men' },
  { v: 'female', label: 'Women' },
  { v: 'any', label: 'All' },
];
const DEFAULT_PLAYERS = ['V Kohli', 'RG Sharma', 'KS Williamson'];

const CONF_STYLE: Record<string, string> = {
  high: 'bg-emerald-500/15 border-emerald-500 text-emerald-300',
  medium: 'bg-sky-500/15 border-sky-500 text-sky-300',
  low: 'bg-amber-500/15 border-amber-500 text-amber-300',
  none: 'bg-zinc-800 border-zinc-700 text-zinc-400',
};

const SLICE_KEYS = ['venue', 'matchup', 'opposition', 'phase', 'innings'] as const;

/** headline metric tiles + delta-chip config, per role */
function viewFor(role: Role) {
  if (role === 'batter') {
    return {
      tiles: [
        { key: 'expected_runs_per_dismissal', label: 'Proj. runs / dismissal', accent: true },
        { key: 'strike_rate', label: 'Proj. strike rate' },
        { key: 'balls_per_dismissal', label: 'Proj. balls / dismissal' },
      ],
      headline: 'expected_runs_per_dismissal',
      betterIsHigh: true,
      rate: { label: 'SR', goodWhen: 'up' as const },
      event: { label: 'Out', goodWhen: 'up' as const },
    };
  }
  return {
    tiles: [
      { key: 'expected_runs_per_wicket', label: 'Proj. runs / wicket', accent: true },
      { key: 'economy', label: 'Proj. economy' },
      { key: 'strike_rate', label: 'Proj. strike rate' },
    ],
    headline: 'expected_runs_per_wicket',
    betterIsHigh: false,
    rate: { label: 'Econ', goodWhen: 'down' as const },
    event: { label: 'Wkt', goodWhen: 'up' as const },
  };
}

function baseValue(p: Available, key: string): number | null {
  if (key in p.baseline) return p.baseline[key];
  if (key === 'expected_runs_per_dismissal') {
    return round((p.baseline.balls_per_dismissal * p.baseline.strike_rate) / 100, 1);
  }
  return null;
}

export default function RecommendPage() {
  const [role, setRole] = useState<Role>('batter');
  const [mode, setMode] = useState<Mode>('discovery');
  const [format, setFormat] = useState('ODI');
  const [gender, setGender] = useState('male');
  const [players, setPlayers] = useState<string[]>(DEFAULT_PLAYERS);

  const [venue, setVenue] = useState('');
  const [opponent, setOpponent] = useState('');
  const [opposition, setOpposition] = useState('');
  const [phase, setPhase] = useState('');
  const [innings, setInnings] = useState('');
  const [limit, setLimit] = useState(10);
  const [minSample, setMinSample] = useState(80);

  const [result, setResult] = useState<RecResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opponentLabel = role === 'batter' ? 'Bowler' : 'Batsman';

  const run = useCallback(async () => {
    const params = new URLSearchParams({ role, format, gender });
    if (mode === 'shortlist') {
      const names = players.map((p) => p.trim()).filter(Boolean);
      if (names.length === 0) {
        setError('Add at least one player, or switch to Discover.');
        setResult(null);
        return;
      }
      params.set('players', names.join(','));
    } else {
      params.set('limit', String(limit));
      params.set('min_sample', String(minSample));
    }
    if (venue.trim()) params.set('venue', venue.trim());
    if (opponent.trim()) params.set('opponent', opponent.trim());
    if (opposition.trim()) params.set('opposition', opposition.trim());
    if (phase && format !== 'Test') params.set('phase', phase);
    if (innings) params.set('innings', innings);

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recommend?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      setResult(json as RecResponse);
    } catch (err: any) {
      setError(err?.message ?? 'Request failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [role, mode, format, gender, players, venue, opponent, opposition, phase, innings, limit, minSample]);

  // re-run when the "structural" knobs change; text fields wait for the button
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, mode, format, gender]);

  const view = useMemo(() => viewFor(role), [role]);

  const ranked = (result?.players ?? []).filter((p): p is Available => p.data_available);
  const unavailable = (result?.players ?? []).filter((p) => !p.data_available);

  const barBasis = useMemo(() => {
    const vals = ranked.map((p) => p.predicted[view.headline]).filter((v) => v > 0);
    if (!vals.length) return 0;
    return view.betterIsHigh ? Math.max(...vals) : Math.min(...vals);
  }, [ranked, view]);

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      <header className="max-w-7xl mx-auto flex flex-col gap-4 mb-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
            <Sparkles className="text-sky-400" /> Matchup Recommender
          </h1>
          <NavTabs />
        </div>
        <p className="text-sm text-zinc-500 max-w-2xl">
          Find the {role === 'batter' ? 'batter' : 'bowler'} who projects best for a
          ground, an opponent or a match situation — either across the whole record
          (Discover) or within a shortlist you name. Career baselines are nudged by
          in-context form and shrunk hard when the sample is thin.
        </p>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* ---- controls ---- */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6 h-fit">
          <PillGroup
            label="Recommend"
            options={['batter', 'bowler']}
            optionLabels={{ batter: 'Batters', bowler: 'Bowlers' }}
            value={role}
            onChange={(v) => setRole(v as Role)}
          />
          <PillGroup
            label="Pool"
            options={['discovery', 'shortlist']}
            optionLabels={{ discovery: 'Discover the field', shortlist: 'Rank my shortlist' }}
            value={mode}
            onChange={(v) => setMode(v as Mode)}
          />

          <div className="grid grid-cols-2 gap-4">
            <PillGroup label="Format" options={FORMATS} value={format} onChange={setFormat} />
            <PillGroup
              label="Players"
              options={GENDERS.map((g) => g.v)}
              optionLabels={Object.fromEntries(GENDERS.map((g) => [g.v, g.label]))}
              value={gender}
              onChange={setGender}
            />
          </div>

          {mode === 'shortlist' ? (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Shortlist</p>
              <div className="space-y-2">
                {players.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                      value={p}
                      placeholder={`${opponentLabel === 'Bowler' ? 'Batter' : 'Bowler'} ${i + 1}`}
                      onChange={(e) =>
                        setPlayers((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                      }
                    />
                    {players.length > 1 && (
                      <button
                        onClick={() => setPlayers((prev) => prev.filter((_, j) => j !== i))}
                        className="text-zinc-600 hover:text-red-400 transition-colors"
                        aria-label={`Remove ${i + 1}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setPlayers((prev) => [...prev, ''])}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <NumberField label="Show top" value={limit} min={1} max={50} onChange={setLimit} />
              <NumberField
                label="Min balls / slice"
                value={minSample}
                min={0}
                max={1000}
                step={10}
                onChange={setMinSample}
              />
            </div>
          )}

          <div className="border-t border-zinc-800 pt-5 space-y-4">
            <p className="text-[11px] uppercase tracking-wider text-zinc-600 font-bold">
              Context — leave blank to ignore
            </p>
            <TextField label="Venue" value={venue} onChange={setVenue} placeholder="e.g. Eden Gardens, Kolkata" />
            <TextField
              label={opponentLabel}
              value={opponent}
              onChange={setOpponent}
              placeholder={role === 'batter' ? 'e.g. TA Boult' : 'e.g. V Kohli'}
            />
            <TextField label="Opposition team" value={opposition} onChange={setOpposition} placeholder="e.g. Australia" />
            <PillGroup
              label="Phase"
              options={PHASES}
              value={phase}
              onChange={setPhase}
              allowClear
              disabled={format === 'Test'}
              disabledNote="no phases in Tests"
            />
            <PillGroup
              label="Innings"
              options={['1', '2', '3', '4']}
              optionLabels={{ '1': '1st', '2': '2nd', '3': '3rd', '4': '4th' }}
              value={innings}
              onChange={setInnings}
              allowClear
            />
          </div>

          <button
            onClick={run}
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-tight text-sm rounded-2xl py-3 transition-colors"
          >
            {loading ? 'Crunching…' : 'Recommend'}
          </button>
        </section>

        {/* ---- results ---- */}
        <section className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-2xl p-4 text-sm">
              {error}
            </div>
          )}

          {result && !error && (
            <>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-1">
                  {result.mode === 'discovery' ? 'Top pick' : 'Recommendation'}
                  <span className="text-zinc-600"> · {result.format} · {role}s</span>
                </p>
                {result.recommendation && ranked[0] ? (
                  <p className="text-2xl font-black italic tracking-tight">
                    {result.recommendation}
                    <span className="text-sky-400">
                      {' · '}
                      {ranked[0].predicted[view.headline]}{' '}
                      {role === 'batter' ? 'proj. runs/dismissal' : 'proj. runs/wicket'}
                    </span>
                  </p>
                ) : (
                  <p className="text-zinc-500 italic">No player had usable data for this query.</p>
                )}
                {result.caveats.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {result.caveats.map((c, i) => (
                      <li key={i} className="flex gap-2 text-xs text-amber-300/90">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {ranked.map((p) => (
                <RecCard key={p.player} p={p} role={role} view={view} barBasis={barBasis} />
              ))}

              {unavailable.length > 0 && (
                <p className="text-xs text-zinc-600 italic px-2">
                  No {result.format} {role === 'batter' ? 'batting' : 'bowling'} data for:{' '}
                  {unavailable.map((p) => p.player).join(', ')}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function RecCard({
  p,
  role,
  view,
  barBasis,
}: {
  p: Available;
  role: Role;
  view: ReturnType<typeof viewFor>;
  barBasis: number;
}) {
  const isTop = p.rank === 1;
  const headline = p.predicted[view.headline];
  const pct =
    barBasis > 0
      ? view.betterIsHigh
        ? (headline / barBasis) * 100
        : (barBasis / headline) * 100
      : 0;
  const activeFactors = SLICE_KEYS.filter((k) => p.factors[k]);
  const factorLabel: Record<string, string> = {
    venue: 'Venue',
    matchup: role === 'batter' ? 'vs Bowler' : 'vs Batsman',
    opposition: 'Opposition',
    phase: 'Phase',
    innings: 'Innings',
  };

  return (
    <div
      className={[
        'rounded-3xl p-6 border transition-colors',
        isTop ? 'bg-sky-500/[0.07] border-sky-500/60' : 'bg-zinc-900 border-zinc-800',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={[
              'grid place-items-center w-7 h-7 rounded-full text-xs font-black shrink-0',
              isTop ? 'bg-sky-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400',
            ].join(' ')}
          >
            {p.rank}
          </span>
          <span className="font-black italic tracking-tight text-lg">{p.player}</span>
        </div>
        <span
          className={[
            'px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide',
            CONF_STYLE[p.confidence],
          ].join(' ')}
        >
          {p.confidence} · {p.sample_balls} balls
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        {view.tiles.map((t) => {
          const bv = baseValue(p, t.key);
          return (
            <Stat
              key={t.key}
              label={t.label}
              value={p.predicted[t.key]}
              sub={bv != null ? `base ${bv}` : undefined}
              accent={t.accent}
            />
          );
        })}
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={isTop ? 'h-full bg-sky-400' : 'h-full bg-zinc-600'}
          style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
        />
      </div>

      {activeFactors.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {activeFactors.map((k) => {
            const f = p.factors[k]!;
            return (
              <div key={k} className="bg-zinc-950 border border-zinc-800 rounded-2xl px-3 py-2 text-[11px]">
                <p className="text-zinc-400 font-semibold">
                  {factorLabel[k]}
                  <span className="text-zinc-600 font-normal">
                    {' '}· {f.sample_balls} balls / {f.sample_events} {role === 'batter' ? 'out' : 'wkt'}
                  </span>
                </p>
                <p className="mt-1 flex gap-3">
                  <Delta label={view.rate.label} factor={f.rate_factor} goodWhen={view.rate.goodWhen} />
                  <Delta label={view.event.label} factor={f.event_factor} goodWhen={view.event.goodWhen} />
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Delta({
  label,
  factor,
  goodWhen,
}: {
  label: string;
  factor: number;
  goodWhen: 'up' | 'down';
}) {
  const pct = Math.round((factor - 1) * 100);
  const good = goodWhen === 'up' ? pct > 0 : pct < 0;
  const bad = goodWhen === 'up' ? pct < 0 : pct > 0;
  const color = good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-zinc-500';
  return (
    <span className="tabular-nums">
      <span className="text-zinc-500">{label} </span>
      <span className={color}>
        {pct > 0 ? '+' : ''}
        {pct}%
      </span>
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold leading-tight">
        {label}
      </p>
      <p
        className={[
          'mt-1 font-black tabular-nums',
          accent ? 'text-sky-400 text-2xl' : 'text-zinc-100 text-xl',
        ].join(' ')}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <input
        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <input
        type="number"
        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function PillGroup({
  label,
  options,
  optionLabels,
  value,
  onChange,
  allowClear,
  disabled,
  disabledNote,
}: {
  label: string;
  options: string[];
  optionLabels?: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
  allowClear?: boolean;
  disabled?: boolean;
  disabledNote?: string;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-2">
        {label}
        {disabled && disabledNote && <span className="text-zinc-600 italic"> — {disabledNote}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o === value;
          return (
            <button
              key={o}
              disabled={disabled}
              onClick={() => onChange(allowClear && active ? '' : o)}
              className={[
                'px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors capitalize disabled:opacity-40 disabled:cursor-not-allowed',
                active
                  ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-sky-500/70 hover:text-sky-200',
              ].join(' ')}
            >
              {optionLabels?.[o] ?? o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function round(n: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

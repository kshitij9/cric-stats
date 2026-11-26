'use client';

import EraChart from '@/components/EraChart';
import FormatPicker from '@/components/FormatPicker';
import IncompleteMark from '@/components/IncompleteMark';
import MatchupTable from '@/components/MatchupTable';
import NavTabs from '@/components/NavTabs';
import PlayerRadar from '@/components/PlayerRadar';
import PlayerSearch from '@/components/PlayerSearch';
import { useCricketStats } from '@/hooks/useCricketStats';
import type { Career, EraYear, Format, Matchup, PlayerRef } from '@/lib/types';
import { BarChart3, ShieldAlert } from 'lucide-react';

/** Search, career, shape, era index and matchups for one player. */
export default function PlayerProfile({
  player,
  onPlayer,
  format,
  onFormat,
  quickPicks = [],
}: {
  player: PlayerRef;
  onPlayer: (player: PlayerRef) => void;
  format: Format;
  onFormat: (format: Format) => void;
  quickPicks?: PlayerRef[];
}) {
  const career = useCricketStats<Career[]>('career', player.player_id, format);
  const era = useCricketStats<EraYear[]>('era', player.player_id, format);
  const matchups = useCricketStats<Matchup[]>('matchup', player.player_id, format);
  const record = career.data?.[0] ?? null;

  return (
    <>
      <header className="max-w-7xl mx-auto flex flex-col gap-4 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">
            Cric<span className="text-blue-500">Intell</span>
          </h1>
          <NavTabs />
        </div>

        <div className="w-full md:w-[420px] space-y-2">
          <PlayerSearch selected={player} onSelect={(p) => p && onPlayer(p)} />
          {quickPicks.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-zinc-500">Quick picks:</span>
              {quickPicks.map((p) => (
                <button
                  key={p.player_id}
                  className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 hover:border-blue-500 hover:text-blue-400 text-[11px] font-medium"
                  onClick={() => onPlayer(p)}
                >
                  {p.unique_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-sm text-zinc-500">
          Viewing insights for{' '}
          <span className="font-semibold text-zinc-100">{player.unique_name}</span>
        </p>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <FormatPicker value={format} onChange={onFormat} />

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-1">
                Career Snapshot
              </p>
              <p className="text-lg font-semibold">
                {player.unique_name}
                <IncompleteMark show={record?.may_be_incomplete} />{' '}
                <span className="text-zinc-500 text-sm font-normal">({format})</span>
              </p>
              {record?.first_match && (
                <p className="text-[11px] text-zinc-500">
                  Matches in the data: {record.first_match.slice(0, 4)}–
                  {record.last_match?.slice(0, 4)}
                </p>
              )}
            </div>
            {record ? (
              <div className="flex flex-wrap gap-6 text-sm">
                <Figure label="Innings" value={record.innings} />
                <Figure label="Runs" value={record.runs} />
                <Figure label="Balls" value={record.balls} />
                <Figure label="Avg" value={record.average} />
                <Figure label="SR" value={record.strike_rate} />
                <Figure label="Era index" value={record.era_index?.toFixed(2)} />
              </div>
            ) : (
              <p className="text-sm italic text-zinc-500">
                {career.loading
                  ? 'Loading…'
                  : (career.error ?? `No ${format} batting data for this player.`)}
              </p>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold mb-2">
              <BarChart3 className="text-sky-400" /> Player Profile Shape
            </h2>
            <p className="text-xs text-zinc-500 max-w-2xl mb-4">
              Power hitters spike on <Term>Boundary %</Term> and <Term>Strike Rate</Term>. Anchors
              spike on <Term>Balls / Dismissal</Term>. <Term>Not-out %</Term> is the share of innings
              that ended without a dismissal. <Term>Era Index</Term> compares scoring rate with the
              average batter of the same years and gender (1.00 = average).
            </p>
            <PlayerRadar format={format} profile={record} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold mb-6">
              <BarChart3 className="text-blue-500" /> Era-Adjusted Performance
            </h2>
            <p className="text-xs text-zinc-500 max-w-xl mb-2">
              Era index is a player&apos;s runs divided by the runs an average batter of the same
              gender would have scored from the same balls that year. 1.20 means 20% faster than
              average. The career figure weighs each year by the balls faced in it.
            </p>
            {era.error ? (
              <p className="text-xs text-red-300">{era.error}</p>
            ) : (
              <EraChart data={era.data ?? []} />
            )}
          </div>
        </section>

        <section className="space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold mb-6">
              <ShieldAlert className="text-red-500" /> Tactical Matchups
            </h2>
            <MatchupTable data={matchups.data} format={format} error={matchups.error} />
          </div>
        </section>
      </div>
    </>
  );
}

function Figure({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div>
      <p className="text-zinc-500 text-[11px] uppercase font-bold">{label}</p>
      <p className="font-semibold">{value ?? '–'}</p>
    </div>
  );
}

function Term({ children }: { children: string }) {
  return <span className="text-zinc-200 font-semibold">{children}</span>;
}

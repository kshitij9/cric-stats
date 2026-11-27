'use client';

import { Plus, Scale, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SeasonLines from '@/components/charts/SeasonLines';
import SeasonRuns from '@/components/charts/SeasonRuns';
import IncompleteMark from '@/components/IncompleteMark';
import MatchupTable from '@/components/MatchupTable';
import PlayerSearch from '@/components/PlayerSearch';
import { Card, Empty, ErrorNote, Loading, PageHeader, PRIMARY, SECONDARY } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import { useCricketStats } from '@/hooks/useCricketStats';
import { MAX_COMPARE, PLAYER_COLORS } from '@/lib/colors';
import { QUICK_PICKS } from '@/lib/defaults';
import { FACTORS } from '@/lib/factors';
import { scopeName } from '@/lib/scope';
import type { Career, EraYear, Matchup } from '@/lib/types';

// shown large; the rest follow in a smaller row
const HEADLINE = ['runs', 'average', 'strike_rate', 'era_index'];

export default function PlayerPage() {
  const router = useRouter();
  const { competition, scope, player, compared, setPlayer, addCompared, setCompetition } = useApp();
  const career = useCricketStats<Career[]>('career', player.player_id, scope);
  const era = useCricketStats<EraYear[]>('era', player.player_id, scope);
  const matchups = useCricketStats<Matchup[]>('matchup', player.player_id, scope);
  const record = career.data?.[0] ?? null;
  const label = scopeName(scope);

  const isCompared = compared.some((p) => p.player_id === player.player_id);
  const full = compared.length >= MAX_COMPARE;

  const figure = (key: string) => {
    const factor = FACTORS.find((f) => f.key === key)!;
    const value = record ? factor.get(record) : null;
    return { factor, text: value == null ? '–' : (factor.show?.(value) ?? String(value)) };
  };

  return (
    <>
      <PageHeader icon={UserRound} title="Player profile">
        A batter&apos;s record, season by season, and the bowlers who get them out. Batting only for
        now; bowlers are ranked under Picks.
      </PageHeader>

      <div className="max-w-xl space-y-2">
        <PlayerSearch label="Player" selected={player} onSelect={(p) => p && setPlayer(p)} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">Quick picks:</span>
          {QUICK_PICKS.map((p) => (
            <button
              key={p.player_id}
              type="button"
              aria-pressed={p.player_id === player.player_id}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-medium hover:border-sky-500 hover:text-sky-300 aria-pressed:border-sky-500 aria-pressed:text-sky-300"
              onClick={() => setPlayer(p)}
            >
              {p.unique_name}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">
              {player.unique_name}
              <IncompleteMark show={record?.may_be_incomplete} />
            </h2>
            <p className="text-sm text-zinc-400">
              {label} batting
              {record?.first_match &&
                ` · ${record.first_match.slice(0, 4)}–${record.last_match?.slice(0, 4)}`}
            </p>
          </div>
          <button
            type="button"
            className={isCompared ? SECONDARY : PRIMARY}
            disabled={!isCompared && full}
            onClick={() => {
              addCompared(player);
              router.push('/compare');
            }}
          >
            {isCompared ? <Scale size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
            {isCompared ? 'See in comparison' : full ? 'Comparison is full' : 'Add to comparison'}
          </button>
        </div>

        {record ? (
          <>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {HEADLINE.map((key) => {
                const { factor, text } = figure(key);
                return (
                  <div key={key} className="rounded-xl bg-zinc-950 p-4">
                    <dt className="text-xs text-zinc-400">{factor.label}</dt>
                    <dd className="text-3xl font-bold">{text}</dd>
                    {factor.help && <dd className="text-[11px] text-zinc-500">{factor.help}</dd>}
                  </div>
                );
              })}
            </dl>
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              {FACTORS.filter((f) => !HEADLINE.includes(f.key)).map((f) => (
                <div key={f.key} title={f.help}>
                  <dt className="text-xs text-zinc-500">{f.label}</dt>
                  <dd className="font-semibold">{figure(f.key).text}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : career.loading ? (
          <Loading />
        ) : career.error ? (
          <ErrorNote>{career.error}</ErrorNote>
        ) : (
          <Empty>
            <p>
              No {label} batting data for {player.unique_name}.
            </p>
            <button
              type="button"
              className={SECONDARY}
              onClick={() => setCompetition(competition === 'ipl' ? 'international' : 'ipl')}
            >
              Show {competition === 'ipl' ? 'internationals' : 'the IPL'}
            </button>
          </Empty>
        )}
      </Card>

      {record && (
        <>
          {era.error ? (
            <ErrorNote>{era.error}</ErrorNote>
          ) : !era.data ? (
            <Loading height="h-72" />
          ) : (
            era.data.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Runs by season" hint="Calendar years in which they faced a ball.">
                  <SeasonRuns data={era.data} />
                </Card>
                <Card
                  title="Era index by season"
                  hint={`Runs divided by what an average ${competition === 'ipl' ? 'IPL batter' : 'batter of the same gender'} would have scored from the same balls that year. 1.20 means 20% faster than average; the grey line is average. A season with only a few balls can swing widely.`}
                >
                  <SeasonLines
                    metric="era_index"
                    series={[
                      {
                        id: player.player_id,
                        name: player.unique_name,
                        color: PLAYER_COLORS[0],
                        years: era.data,
                      },
                    ]}
                  />
                </Card>
                <details className="text-sm lg:col-span-2">
                  <summary className="cursor-pointer text-sky-400">Show the seasons as a table</summary>
                  <table className="mt-3 w-full max-w-lg tabular-nums">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                        <th className="py-1.5 text-left">Year</th>
                        <th className="py-1.5 text-right">Runs</th>
                        <th className="py-1.5 text-right">Balls</th>
                        <th className="py-1.5 text-right">Era index</th>
                      </tr>
                    </thead>
                    <tbody>
                      {era.data.map((y) => (
                        <tr key={y.year} className="border-b border-zinc-900">
                          <td className="py-1.5">{y.year}</td>
                          <td className="py-1.5 text-right">{y.runs}</td>
                          <td className="py-1.5 text-right">{y.balls}</td>
                          <td className="py-1.5 text-right">{y.era_index?.toFixed(2) ?? '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>
            )
          )}

          <Card
            id="matchups"
            title="Bowlers who get them out most"
            hint={`${label} bowlers who have bowled more than 15 balls to this batter. Outs count only the bowler's own wickets.`}
          >
            <MatchupTable matchups={matchups} />
          </Card>
        </>
      )}
    </>
  );
}

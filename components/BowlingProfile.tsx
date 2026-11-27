'use client';

import SeasonBars from '@/components/charts/SeasonBars';
import SeasonLines from '@/components/charts/SeasonLines';
import MatchupTable from '@/components/MatchupTable';
import ProfileCard from '@/components/ProfileCard';
import ProfileFigures from '@/components/ProfileFigures';
import SeasonTable from '@/components/SeasonTable';
import { Card, ErrorNote, Loading } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import { useCricketStats } from '@/hooks/useCricketStats';
import { PLAYER_COLORS } from '@/lib/colors';
import { BOWLING_FACTORS } from '@/lib/factors';
import { scopeName } from '@/lib/scope';
import type { BowlingCareer, BowlingMatchup, BowlingYear } from '@/lib/types';

const HEADLINE = ['wickets', 'economy', 'average', 'strike_rate'];

export default function BowlingProfile() {
  const { scope, player } = useApp();
  const career = useCricketStats<BowlingCareer[]>('bowling', player.player_id, scope);
  const seasons = useCricketStats<BowlingYear[]>('bowling_seasons', player.player_id, scope);
  const matchups = useCricketStats<BowlingMatchup[]>('bowling_matchup', player.player_id, scope);
  const record = career.data?.[0] ?? null;
  const label = scopeName(scope);

  return (
    <>
      <ProfileCard career={career}>
        {record && (
          <ProfileFigures
            record={record}
            factors={BOWLING_FACTORS}
            headline={HEADLINE}
            extra={[
              {
                label: 'Best figures',
                text: `${record.best_wickets}/${record.best_runs}`,
                help: 'Most wickets in an innings, then fewest runs',
              },
            ]}
          />
        )}
      </ProfileCard>

      {record && (
        <>
          {seasons.error ? (
            <ErrorNote>{seasons.error}</ErrorNote>
          ) : !seasons.data ? (
            <Loading height="h-72" />
          ) : (
            seasons.data.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Wickets by season" hint="Calendar years in which they bowled.">
                  <SeasonBars data={seasons.data} metric="wickets" label="Wickets" />
                </Card>
                <Card
                  title="Economy by season"
                  hint="Runs conceded per over; lower is better. A season with only a few balls can swing widely."
                >
                  <SeasonLines
                    metric="economy"
                    series={[
                      {
                        id: player.player_id,
                        name: player.unique_name,
                        color: PLAYER_COLORS[0],
                        years: seasons.data,
                      },
                    ]}
                  />
                </Card>
                <SeasonTable
                  rows={seasons.data}
                  columns={[
                    { label: 'Innings', show: (y) => y.innings },
                    { label: 'Balls', show: (y) => y.balls },
                    { label: 'Runs', show: (y) => y.runs_conceded },
                    { label: 'Wickets', show: (y) => y.wickets },
                    { label: 'Economy', show: (y) => y.economy ?? '–' },
                    { label: 'Average', show: (y) => y.average ?? '–' },
                  ]}
                />
              </div>
            )
          )}

          <Card
            id="matchups"
            title="Batters they get out most"
            hint={`${label} batters this bowler has bowled more than 15 balls to. Outs count only the bowler's own wickets; runs include wides and no-balls, and balls are legal ones.`}
          >
            <MatchupTable
              matchups={{
                ...matchups,
                data:
                  matchups.data?.map((m) => ({
                    ...m,
                    id: m.batter_id,
                    name: m.unique_name,
                    rate: m.economy,
                  })) ?? null,
              }}
              opponent="Batter"
              rate={{ label: 'Economy', short: 'Econ', help: 'Economy: runs per over' }}
              empty="This bowler has not bowled more than 15 balls to any batter."
            />
          </Card>
        </>
      )}
    </>
  );
}

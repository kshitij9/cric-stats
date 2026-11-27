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
import { BATTING_FACTORS } from '@/lib/factors';
import { scopeName } from '@/lib/scope';
import type { Career, EraYear, Matchup } from '@/lib/types';

const HEADLINE = ['runs', 'average', 'strike_rate', 'era_index'];

export default function BattingProfile() {
  const { competition, scope, player } = useApp();
  const career = useCricketStats<Career[]>('career', player.player_id, scope);
  const era = useCricketStats<EraYear[]>('era', player.player_id, scope);
  const matchups = useCricketStats<Matchup[]>('matchup', player.player_id, scope);
  const record = career.data?.[0] ?? null;
  const label = scopeName(scope);

  return (
    <>
      <ProfileCard career={career}>
        {record && (
          <ProfileFigures record={record} factors={BATTING_FACTORS} headline={HEADLINE} />
        )}
      </ProfileCard>

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
                  <SeasonBars data={era.data} metric="runs" label="Runs" />
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
                <SeasonTable
                  rows={era.data}
                  columns={[
                    { label: 'Runs', show: (y) => y.runs },
                    { label: 'Balls', show: (y) => y.balls },
                    { label: 'Era index', show: (y) => y.era_index?.toFixed(2) ?? '–' },
                  ]}
                />
              </div>
            )
          )}

          <Card
            id="matchups"
            title="Bowlers who get them out most"
            hint={`${label} bowlers who have bowled more than 15 balls to this batter. Outs count only the bowler's own wickets.`}
          >
            <MatchupTable
              matchups={{
                ...matchups,
                data:
                  matchups.data?.map((m) => ({
                    ...m,
                    id: m.bowler_id,
                    name: m.unique_name,
                    rate: m.strike_rate,
                  })) ?? null,
              }}
              opponent="Bowler"
              rate={{ label: 'Strike rate', short: 'SR', help: 'Strike rate: runs per 100 balls' }}
              empty="No bowler has bowled more than 15 balls to this batter."
            />
          </Card>
        </>
      )}
    </>
  );
}

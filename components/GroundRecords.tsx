import FactTable from '@/components/FactTable';
import { Card } from '@/components/ui';
import { FEW_BALLS, type MatchupPlayer, type Side } from '@/lib/matchup-types';

const figure = (value: number | null) => value ?? '–';

const nobody = (players: MatchupPlayer[], what: string) =>
  players.length > 0 && (
    <p className="text-xs leading-relaxed text-zinc-500">
      No {what} here: {players.map((p) => p.unique_name).join(', ')}.
    </p>
  );

function Team({ side }: { side: Side }) {
  const batted = side.players.filter((p) => p.at_ground.batting);
  const bowled = side.players.filter((p) => p.at_ground.bowling);
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="break-words font-semibold text-sky-300">{side.name}</h3>
      {batted.length > 0 && (
        <FactTable
          first="Batting"
          columns={[
            { label: 'Inns', help: 'Innings here', wide: true },
            { label: 'Runs' },
            { label: 'Balls' },
            { label: 'Avg', help: 'Runs per dismissal here' },
            { label: 'SR', help: 'Strike rate here' },
            { label: 'All SR', help: 'Strike rate in the IPL at every ground' },
          ]}
          rows={batted.map((p) => {
            const here = p.at_ground.batting!;
            return {
              key: p.player_id,
              name: p.unique_name,
              thin: here.balls < FEW_BALLS,
              cells: [
                here.innings,
                here.runs,
                here.balls,
                figure(here.average),
                figure(here.strike_rate),
                figure(p.batting.strike_rate),
              ],
            };
          })}
        />
      )}
      {nobody(side.players.filter((p) => !p.at_ground.batting), 'batting')}
      {bowled.length > 0 && (
        <FactTable
          first="Bowling"
          columns={[
            { label: 'Inns', help: 'Innings bowled in here', wide: true },
            { label: 'Balls' },
            { label: 'Wkts', help: 'Wickets here' },
            { label: 'Econ', help: 'Runs conceded per over here' },
            { label: 'All econ', help: 'Economy in the IPL at every ground' },
          ]}
          rows={bowled.map((p) => {
            const here = p.at_ground.bowling!;
            return {
              key: p.player_id,
              name: p.unique_name,
              thin: here.balls < FEW_BALLS,
              cells: [
                here.innings,
                here.balls,
                here.wickets,
                figure(here.economy),
                figure(p.bowling.economy),
              ],
            };
          })}
        />
      )}
      {/* only those who bowl somewhere: listing every batter would say nothing */}
      {nobody(
        side.players.filter((p) => !p.at_ground.bowling && p.bowling.balls > 0),
        'bowling',
      )}
    </div>
  );
}

/** What each team's players have done at the ground. */
export default function GroundRecords({ sides, ground }: { sides: Side[]; ground: string }) {
  return (
    <Card
      title={`Their records at ${ground}`}
      hint={`Every IPL season. Rows from fewer than ${FEW_BALLS} balls are faint: they say little.`}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {sides.map((side) => (
          <Team key={side.team_id} side={side} />
        ))}
      </div>
    </Card>
  );
}

import PerformerList from '@/components/PerformerList';
import Swatch from '@/components/rivalry/Swatch';
import { Card } from '@/components/ui';
import { FEW_BALLS } from '@/lib/matchup-types';
import { battingLine, bowlingLine } from '@/lib/performers';
import type { Rivalry } from '@/lib/rivalry-types';

/** Who has made most runs and taken most wickets in these meetings. */
export default function Performers({ data }: { data: Rivalry }) {
  const where = data.venue ? ` at ${data.venue.name}` : '';
  return (
    <Card
      title="Top performers"
      hint={`The most runs and wickets in these meetings${where}, counted for the side each player was in that day. Records from fewer than ${FEW_BALLS} balls are faint.`}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {data.teams.map((team, i) => (
          <div key={team} className="min-w-0 space-y-4">
            <h3 className="break-words font-semibold">
              <Swatch side={i as 0 | 1} />
              {team}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <PerformerList
                title="Most runs"
                label={`Most runs: ${team}`}
                lines={data.batting[i].map(battingLine)}
                empty="No runs in these meetings."
              />
              <PerformerList
                title="Most wickets"
                label={`Most wickets: ${team}`}
                lines={data.bowling[i].map(bowlingLine)}
                empty="No wickets in these meetings."
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

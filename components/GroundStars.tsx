import PerformerList from '@/components/PerformerList';
import { Card } from '@/components/ui';
import { TEAM_COLORS } from '@/lib/colors';
import { topRunScorers, topWicketTakers } from '@/lib/faceoff-types';
import { FEW_BALLS, type Side } from '@/lib/matchup-types';
import { battingLine, bowlingLine } from '@/lib/performers';

function Team({ side, colour }: { side: Side; colour: string }) {
  const batting = topRunScorers(side.players).map(({ player, here }) =>
    battingLine({ ...player, ...here }),
  );
  const bowling = topWicketTakers(side.players).map(({ player, here }) =>
    bowlingLine({ ...player, ...here }),
  );
  return (
    <div className="min-w-0 space-y-4">
      <h3 className="break-words font-semibold">
        <span
          aria-hidden
          className="mr-1.5 inline-block size-3 rounded-sm"
          style={{ background: colour }}
        />
        {side.name}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <PerformerList
          title="Most runs"
          label={`Most runs: ${side.name}`}
          lines={batting}
          empty="Nobody in this side has scored a run here."
        />
        <PerformerList
          title="Most wickets"
          label={`Most wickets: ${side.name}`}
          lines={bowling}
          empty="Nobody in this side has taken a wicket here."
        />
      </div>
    </div>
  );
}

/** Each side's leading run scorers and wicket takers at the ground. */
export default function GroundStars({ sides, ground }: { sides: [Side, Side]; ground: string }) {
  return (
    <Card
      title="Ground stars"
      hint={`The most runs and wickets at ${ground} by each side’s present players, every IPL season. Records from fewer than ${FEW_BALLS} balls are faint.`}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Team side={sides[0]} colour={TEAM_COLORS[0]} />
        <Team side={sides[1]} colour={TEAM_COLORS[1]} />
      </div>
    </Card>
  );
}

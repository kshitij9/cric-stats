import { Card } from '@/components/ui';
import { TEAM_COLORS } from '@/lib/colors';
import { topRunScorers, topWicketTakers } from '@/lib/faceoff-types';
import { FEW_BALLS, type Side } from '@/lib/matchup-types';

const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

type Line = { id: string; name: string; thin: boolean; record: string; best: string };

function List({
  title,
  label,
  lines,
  empty,
}: {
  title: string;
  label: string;
  lines: Line[];
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase text-zinc-500">{title}</h4>
      {lines.length === 0 ? (
        <p className="text-xs text-zinc-500">{empty}</p>
      ) : (
        <ol aria-label={label} className="space-y-2">
          {lines.map((line, i) => (
            <li
              key={line.id}
              data-thin={line.thin || undefined}
              className={`flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 ${line.thin ? 'text-zinc-500' : ''}`}
            >
              <span aria-hidden className="text-lg font-black leading-5 text-zinc-600">
                {i + 1}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold">{line.name}</p>
                <p className="text-xs">{line.record}</p>
                <p className="text-xs text-zinc-500">{line.best}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Team({ side, colour }: { side: Side; colour: string }) {
  const batting = topRunScorers(side.players).map(({ player, here }) => ({
    id: player.player_id,
    name: player.unique_name,
    thin: here.balls < FEW_BALLS,
    record: `${count(here.runs, 'run')}, strike rate ${here.strike_rate?.toFixed(1) ?? '–'}, from ${count(here.innings, 'innings', 'innings')}`,
    best: `Best: ${here.best_runs}${here.best_not_out ? ' not out' : ''} from ${count(here.best_balls, 'ball')}`,
  }));
  const bowling = topWicketTakers(side.players).map(({ player, here }) => ({
    id: player.player_id,
    name: player.unique_name,
    thin: here.balls < FEW_BALLS,
    record: `${count(here.wickets, 'wicket')}, economy ${here.economy?.toFixed(2) ?? '–'}, from ${count(here.balls, 'ball')}`,
    best: `Best: ${here.best_wickets} for ${here.best_runs}`,
  }));
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
        <List
          title="Most runs"
          label={`Most runs: ${side.name}`}
          lines={batting}
          empty="Nobody in this side has scored a run here."
        />
        <List
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

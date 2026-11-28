import { Card } from '@/components/ui';
import { TEAM_COLORS } from '@/lib/colors';
import { BATTLE_DISMISSALS, gotOutMost, scoredFastest } from '@/lib/faceoff-types';
import { FEW_PAIR_BALLS, type Meeting, type Pair, type Side } from '@/lib/matchup-types';

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const record = (m: Meeting) =>
  `${m.runs} ${m.runs === 1 ? 'run' : 'runs'} from ${m.balls} ${m.balls === 1 ? 'ball' : 'balls'}, ` +
  (m.dismissals ? `out ${times(m.dismissals)}` : 'not out');

function Battle({ headline, pair, ground }: { headline: string; pair: Pair; ground: boolean }) {
  const there = pair.at_ground;
  return (
    <li className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-sm font-semibold">{headline}</p>
      <p className="text-xs text-zinc-400">
        All grounds: {record(pair)}
      </p>
      {ground && (
        <p className="text-xs text-zinc-500">
          {there ? `At this ground: ${record(there)}` : 'They have not met at this ground'}
        </p>
      )}
    </li>
  );
}

const Swatch = ({ colour }: { colour: string }) => (
  <span
    aria-hidden
    className="mr-1.5 inline-block size-3 rounded-sm align-baseline"
    style={{ background: colour }}
  />
);

function Direction({
  batting,
  bowling,
  colours,
  pairs,
  ground,
}: {
  batting: Side;
  bowling: Side;
  colours: [string, string]; // batting side's, bowling side's
  pairs: Pair[];
  ground: boolean; // whether one is chosen
}) {
  const names = new Map(
    [...batting.players, ...bowling.players].map((p) => [p.player_id, p.unique_name]),
  );
  const lists = [
    {
      title: 'Most dismissals',
      pairs: gotOutMost(pairs),
      empty: `No bowler here has had one of these batters out ${times(BATTLE_DISMISSALS)}.`,
      headline: (p: Pair) =>
        `${names.get(p.bowler_id)} has had ${names.get(p.batter_id)} out ${times(p.dismissals)}`,
    },
    {
      title: 'Fastest scoring',
      pairs: scoredFastest(pairs),
      empty: `No pair has met for ${FEW_PAIR_BALLS} balls or more.`,
      headline: (p: Pair) =>
        `${names.get(p.batter_id)} has scored at ${p.strike_rate?.toFixed(1)} off ${names.get(p.bowler_id)}`,
    },
  ];
  return (
    <div className="min-w-0 space-y-4">
      <h3 className="break-words font-semibold">
        <Swatch colour={colours[0]} />
        {batting.name} batting, <Swatch colour={colours[1]} />
        {bowling.name} bowling
      </h3>
      {lists.map((list) => (
        <div key={list.title} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {list.title}
          </h4>
          {list.pairs.length === 0 ? (
            <p className="text-xs text-zinc-500">{list.empty}</p>
          ) : (
            <ol aria-label={`${list.title}: ${batting.name} batting`} className="space-y-2">
              {list.pairs.map((p) => (
                <Battle
                  key={`${p.batter_id} ${p.bowler_id}`}
                  headline={list.headline(p)}
                  pair={p}
                  ground={ground}
                />
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

/** Who among the two sides has had the better of whom. */
export default function KeyBattles({
  sides: [a, b],
  pairs,
  ground,
}: {
  sides: [Side, Side];
  pairs: [Pair[], Pair[]];
  ground: boolean;
}) {
  return (
    <Card
      title="Key battles"
      hint={`Every IPL season. Picked by dismissals (${BATTLE_DISMISSALS} or more) and by scoring rate (from ${FEW_PAIR_BALLS} balls or more). These are small samples: good stories, weak guides.`}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Direction
          batting={a}
          bowling={b}
          colours={[TEAM_COLORS[0], TEAM_COLORS[1]]}
          pairs={pairs[0]}
          ground={ground}
        />
        <Direction
          batting={b}
          bowling={a}
          colours={[TEAM_COLORS[1], TEAM_COLORS[0]]}
          pairs={pairs[1]}
          ground={ground}
        />
      </div>
    </Card>
  );
}

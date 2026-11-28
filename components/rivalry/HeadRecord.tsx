import Swatch from '@/components/rivalry/Swatch';
import { Card } from '@/components/ui';
import { TEAM_COLORS } from '@/lib/colors';
import { RESULTS_SHOWN, type Rivalry, type Tally } from '@/lib/rivalry-types';

const matches = (n: number) => `${n} ${n === 1 ? 'match' : 'matches'}`;

/** Wins side against side, as one bar shared between them. */
function Bar({ label, teams, tally }: { label: string; teams: Rivalry['teams']; tally: Tally }) {
  const share = (n: number) => `${(n / tally.played) * 100}%`;
  const parts = [
    { key: 'first', n: tally.wins[0], colour: TEAM_COLORS[0], name: `${teams[0]} won` },
    { key: 'other', n: tally.other, colour: '#52525b', name: 'No winner' },
    { key: 'second', n: tally.wins[1], colour: TEAM_COLORS[1], name: `${teams[1]} won` },
  ];
  return (
    <figure data-record={label} className="space-y-2">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-3xl font-black tabular-nums" data-wins="0">
          {tally.wins[0]}
        </span>
        <span className="min-w-0 text-center">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block text-xs text-zinc-500">
            {matches(tally.played)}
            {tally.other > 0 && `, ${tally.other} without a winner`}
          </span>
        </span>
        <span className="text-3xl font-black tabular-nums" data-wins="1">
          {tally.wins[1]}
        </span>
      </figcaption>
      {tally.played > 0 ? (
        <div className="flex h-3 gap-0.5 overflow-hidden rounded">
          {parts.map(
            (p) =>
              p.n > 0 && (
                <span
                  key={p.key}
                  data-part={p.key}
                  title={`${p.name}: ${p.n} of ${tally.played}`}
                  style={{ width: share(p.n), background: p.colour }}
                />
              ),
          )}
        </div>
      ) : (
        <div className="h-3 rounded border border-dashed border-zinc-700" />
      )}
    </figure>
  );
}

/** Who has won, everywhere and at the chosen ground, and the latest results. */
export default function HeadRecord({ data }: { data: Rivalry }) {
  const { teams, seasons, venue } = data;
  // oldest of the latest few first, as form is usually read
  const form = data.meetings.slice(0, RESULTS_SHOWN).reverse();
  return (
    <Card
      title="Head to head"
      hint={`IPL ${seasons.from === seasons.to ? seasons.to : `${seasons.from} to ${seasons.to}`}. A tie settled by a super over counts as a win, though its runs are in no score or figure.`}
    >
      <ul className="grid grid-cols-2 gap-4 text-sm font-semibold" aria-label="Franchises">
        {teams.map((team, i) => (
          <li key={team} className={`min-w-0 break-words ${i === 1 ? 'text-right' : ''}`}>
            <Swatch side={i as 0 | 1} />
            {team}
          </li>
        ))}
      </ul>
      <Bar label="All grounds" teams={teams} tally={data.overall} />
      {data.here && venue && <Bar label={venue.name} teams={teams} tally={data.here} />}
      {form.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-zinc-500">
            Last {form.length}
            {venue ? ' at this ground' : ''}, oldest first
          </p>
          <ol aria-label="Latest winners" className="flex flex-wrap gap-2">
            {form.map((m) => (
              <li
                key={m.match_id}
                className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-semibold"
              >
                {m.winner === null ? (
                  'No winner'
                ) : (
                  <>
                    <Swatch side={m.winner} />
                    {teams[m.winner]}
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

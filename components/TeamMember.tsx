import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { day } from '@/lib/dates';
import type { SquadPlayer } from '@/lib/teams';

const figure = (value: number | null) => (value === null ? '–' : value);

const ICON =
  'rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-sky-300 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-25 disabled:hover:bg-transparent';

/** One place in the batting order. `player` is undefined while it is loading. */
export default function TeamMember({
  position,
  name,
  player,
  first,
  last,
  onMove,
  onRemove,
}: {
  position: number;
  name: string;
  player: SquadPlayer | null | undefined;
  first: boolean;
  last: boolean;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-3 pr-2">
      <span className="w-5 shrink-0 text-right text-sm font-bold text-zinc-500">{position}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
          {name}
          {player?.bowls_regularly && (
            <span
              className="rounded-full border border-sky-500/50 px-2 text-[10px] font-semibold uppercase text-sky-300"
              title={`Bowled in ${player.recent_bowled} of the last ${player.recent_matches} matches`}
            >
              Bowls
            </span>
          )}
        </p>
        {player === null ? (
          <p className="text-[11px] text-amber-300">
            No longer in the match data. Remove this player.
          </p>
        ) : !player ? (
          <p className="text-[11px] text-zinc-600">Loading record…</p>
        ) : (
          <p className="text-[11px] leading-relaxed text-zinc-500">
            {player.teams[0]} · {player.matches} {player.matches === 1 ? 'match' : 'matches'}, last{' '}
            {day(player.last_match)}
            <br />
            {player.batting.runs.toLocaleString('en-GB')} runs, average{' '}
            {figure(player.batting.average)}, strike rate {figure(player.batting.strike_rate)}
            {player.bowling.balls > 0 &&
              ` · ${player.bowling.wickets} ${
                player.bowling.wickets === 1 ? 'wicket' : 'wickets'
              }, economy ${figure(player.bowling.economy)}`}
          </p>
        )}
      </div>
      {/* stacked on a phone, leaving the record room */}
      <div className="flex shrink-0 flex-col sm:flex-row">
        <button
          type="button"
          className={ICON}
          aria-label={`Move ${name} up`}
          disabled={first}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={15} />
        </button>
        <button
          type="button"
          className={ICON}
          aria-label={`Move ${name} down`}
          disabled={last}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={15} />
        </button>
        <button
          type="button"
          className={`${ICON} hover:text-red-400`}
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          <X size={15} />
        </button>
      </div>
    </li>
  );
}

'use client';

import { useState } from 'react';
import Swatch from '@/components/rivalry/Swatch';
import { Card, Empty, SECONDARY } from '@/components/ui';
import { day } from '@/lib/dates';
import { RESULTS_SHOWN, overs, resultOf, type Rivalry } from '@/lib/rivalry-types';

/** The meetings, latest first, with their scores. */
export default function Results({ data }: { data: Rivalry }) {
  const [all, setAll] = useState(false);
  const { teams, meetings, venue } = data;
  const shown = all ? meetings : meetings.slice(0, RESULTS_SHOWN);

  return (
    <Card
      title="Results"
      hint={venue ? `Meetings at ${venue.name}, latest first.` : 'Every meeting, latest first.'}
    >
      {meetings.length === 0 ? (
        <Empty>They have not met {venue ? 'at this ground ' : ''}in these seasons.</Empty>
      ) : (
        <>
          <ol aria-label="Meetings" className="space-y-2">
            {shown.map((m) => (
              <li key={m.match_id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-xs text-zinc-500">
                  {day(m.date)}
                  {!venue && ` · ${m.venue.name}`}
                </p>
                <p className="text-sm font-semibold">
                  {m.winner !== null && <Swatch side={m.winner} />}
                  {resultOf(m, teams)}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs tabular-nums text-zinc-400">
                  {m.scores.map((s) => (
                    <li key={s.side}>
                      {teams[s.side]}{' '}
                      <span className="font-semibold text-zinc-200">
                        {s.runs}/{s.wickets}
                      </span>{' '}
                      ({overs(s.balls)} ov)
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {meetings.length > RESULTS_SHOWN && (
            <button type="button" className={SECONDARY} onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show all ${meetings.length}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

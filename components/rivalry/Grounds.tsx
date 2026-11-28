import Swatch from '@/components/rivalry/Swatch';
import { Card } from '@/components/ui';
import type { Rivalry } from '@/lib/rivalry-types';

/** The record at every ground where they have met. */
export default function Grounds({
  data,
  onGround,
}: {
  data: Rivalry;
  onGround: (venueId: string) => void;
}) {
  return (
    <Card
      title="Where they have met"
      hint="Wins at each ground in these seasons. Choose a ground to see its results and players; choose it again for all grounds."
    >
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-400">
            <th className="py-2 pr-2 text-left font-semibold">Ground</th>
            <th className="px-1 py-2 text-right font-semibold sm:px-3">Played</th>
            {data.teams.map((team, i) => (
              <th key={team} className="w-1/5 px-1 py-2 text-right font-semibold sm:px-3">
                <Swatch side={i as 0 | 1} />
                {team}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 tabular-nums">
          {data.grounds.map((g) => {
            const chosen = g.venue_id === data.venue?.venue_id;
            const [a, b] = g.record.wins;
            return (
              <tr key={g.venue_id} data-ground={g.venue_id} className={chosen ? 'bg-sky-500/10' : ''}>
                <th scope="row" className="py-2 pr-2 text-left">
                  <button
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => onGround(chosen ? '' : g.venue_id)}
                    className="rounded text-left font-semibold underline-offset-2 hover:text-sky-300 hover:underline focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    {g.name}
                  </button>
                </th>
                <td className="px-1 py-2 text-right sm:px-3">{g.record.played}</td>
                <td className={`px-1 py-2 text-right sm:px-3 ${a > b ? 'font-bold text-zinc-50' : 'text-zinc-400'}`}>
                  {a}
                </td>
                <td className={`px-1 py-2 text-right sm:px-3 ${b > a ? 'font-bold text-zinc-50' : 'text-zinc-400'}`}>
                  {b}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

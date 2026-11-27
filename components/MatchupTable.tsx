import { Empty, ErrorNote, Loading } from '@/components/ui';
import type { Loaded } from '@/hooks/useJson';

export type MatchupRow = {
  id: string;
  name: string;
  dismissals: number;
  runs: number;
  balls: number;
  rate: number | null;
};

/** One player's record against the opponents it has met, most dismissals first. */
export default function MatchupTable({
  matchups,
  opponent,
  rate,
  empty,
}: {
  matchups: Loaded<MatchupRow[]>;
  opponent: string; // heading of the first column
  rate: { label: string; short: string; help: string };
  empty: string;
}) {
  const { data, error } = matchups;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500">
            <th className="py-2 pr-3 text-left font-semibold">{opponent}</th>
            <th className="px-1.5 py-2 text-right sm:px-3 font-semibold">Outs</th>
            <th className="px-1.5 py-2 text-right sm:px-3 font-semibold">Runs</th>
            <th className="px-1.5 py-2 text-right sm:px-3 font-semibold">Balls</th>
            <th className="py-2 pl-1.5 text-right font-semibold sm:pl-3">
              <abbr title={rate.help} className="no-underline sm:hidden">
                {rate.short}
              </abbr>
              <span className="hidden sm:inline">{rate.label}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 tabular-nums">
          {data.map((row) => (
            <tr key={row.id}>
              <td className="py-2.5 pr-3 font-semibold">{row.name}</td>
              <td className="px-1.5 py-2.5 text-right sm:px-3 font-bold">{row.dismissals}</td>
              <td className="px-1.5 py-2.5 text-right sm:px-3">{row.runs}</td>
              <td className="px-1.5 py-2.5 text-right sm:px-3">{row.balls}</td>
              <td className="py-2.5 pl-1.5 text-right sm:pl-3">{row.rate ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

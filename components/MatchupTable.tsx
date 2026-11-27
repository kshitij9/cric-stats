import { Empty, ErrorNote, Loading } from '@/components/ui';
import type { Loaded } from '@/hooks/useJson';
import type { Matchup } from '@/lib/types';

export default function MatchupTable({ matchups }: { matchups: Loaded<Matchup[]> }) {
  const { data, error } = matchups;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  if (data.length === 0) {
    return <Empty>No bowler has bowled more than 15 balls to this batter.</Empty>;
  }
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500">
            <th className="py-2 pr-3 text-left font-semibold">Bowler</th>
            <th className="px-1.5 py-2 text-right sm:px-3 font-semibold">Outs</th>
            <th className="px-1.5 py-2 text-right sm:px-3 font-semibold">Runs</th>
            <th className="px-1.5 py-2 text-right sm:px-3 font-semibold">Balls</th>
            <th className="py-2 pl-1.5 text-right font-semibold sm:pl-3">
              <abbr title="Strike rate: runs per 100 balls" className="no-underline sm:hidden">
                SR
              </abbr>
              <span className="hidden sm:inline">Strike rate</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 tabular-nums">
          {data.map((row) => (
            <tr key={row.bowler_id}>
              <td className="py-2.5 pr-3 font-semibold">{row.unique_name}</td>
              <td className="px-1.5 py-2.5 text-right sm:px-3 font-bold">{row.dismissals}</td>
              <td className="px-1.5 py-2.5 text-right sm:px-3">{row.runs}</td>
              <td className="px-1.5 py-2.5 text-right sm:px-3">{row.balls}</td>
              <td className="py-2.5 pl-1.5 text-right sm:pl-3">{row.strike_rate ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

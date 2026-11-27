import IncompleteMark from '@/components/IncompleteMark';
import type { Compared } from '@/hooks/useApp';
import type { Loaded } from '@/hooks/useJson';
import { PLAYER_COLORS } from '@/lib/colors';
import type { Factor } from '@/lib/factors';

/** One row per player, one column per figure; the best in each column is marked. */
export default function ComparisonTable<T extends { may_be_incomplete: boolean }>({
  players,
  careers,
  factors,
  noData,
}: {
  players: Compared[];
  careers: Loaded<T[]>[];
  factors: Factor<T>[];
  noData: string; // shown for a player with nothing in the scope
}) {
  const best = new Map(
    factors.map((f) => {
      const values = careers.flatMap((c) => {
        const value = c.data?.[0] ? f.get(c.data[0]) : null;
        return value == null ? [] : [value];
      });
      // nothing to single out with only one figure
      if (!f.better || values.length < 2) return [f.key, null];
      return [f.key, f.better === 'higher' ? Math.max(...values) : Math.min(...values)];
    }),
  );

  return (
    // "relative" keeps the screen-reader text inside the scrolling area
    <div className="relative overflow-x-auto">
      <p className="mb-2 text-[11px] text-zinc-500 md:hidden">Scroll sideways for more figures.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500">
            <th className="sticky left-0 bg-zinc-900 py-2 pr-4 text-left font-semibold">Player</th>
            {factors.map((f) => (
              <th key={f.key} title={f.help} className="px-3 py-2 text-right font-semibold">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {players.map((player, i) => {
            const career = careers[i];
            const record = career?.data?.[0];
            return (
              <tr key={player.player_id}>
                <td className="sticky left-0 whitespace-nowrap bg-zinc-900 py-2.5 pr-4 font-semibold">
                  <span
                    aria-hidden
                    className="mr-2 inline-block size-2.5 rounded-full"
                    style={{ background: PLAYER_COLORS[player.slot] }}
                  />
                  {player.unique_name}
                  <IncompleteMark show={record?.may_be_incomplete} />
                </td>
                {!record ? (
                  <td
                    colSpan={Math.max(factors.length, 1)}
                    className="px-3 py-2.5 text-right text-xs italic text-zinc-500"
                  >
                    {career?.loading ? 'Loading…' : (career?.error ?? noData)}
                  </td>
                ) : (
                  factors.map((f) => {
                    const value = f.get(record);
                    const leads = value != null && value === best.get(f.key);
                    return (
                      <td
                        key={f.key}
                        data-best={leads || undefined}
                        className={`px-3 py-2.5 text-right tabular-nums ${leads ? 'font-bold text-emerald-400' : ''}`}
                      >
                        {value == null ? (
                          <span className="text-zinc-600">–</span>
                        ) : (
                          (f.show?.(value) ?? value)
                        )}
                        {leads && <span className="sr-only"> (best)</span>}
                      </td>
                    );
                  })
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

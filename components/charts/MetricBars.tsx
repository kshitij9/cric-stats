import type { Factor } from '@/lib/factors';
import type { Career } from '@/lib/types';

export type BarPlayer = { id: string; name: string; color: string; career: Career };

/** A small bar chart for each figure, one bar per player, each on its own scale. */
export default function MetricBars({
  players,
  factors,
}: {
  players: BarPlayer[];
  factors: Factor[];
}) {
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
      {factors.map((f) => {
        const top = Math.max(0, ...players.map((p) => f.get(p.career) ?? 0));
        return (
          <figure key={f.key} className="space-y-2">
            <figcaption>
              <span className="text-sm font-semibold">{f.label}</span>
              {f.help && <span className="block text-[11px] text-zinc-500">{f.help}</span>}
            </figcaption>
            <ul className="space-y-1.5">
              {players.map((p) => {
                const value = f.get(p.career);
                const text = value == null ? '–' : (f.show?.(value) ?? String(value));
                return (
                  <li
                    key={p.id}
                    title={`${p.name}: ${text}`}
                    className="grid grid-cols-[7rem_1fr_4rem] items-center gap-2 text-xs"
                  >
                    <span className="truncate text-zinc-300">{p.name}</span>
                    <span className="h-2.5">
                      <span
                        className="block h-full rounded-r"
                        style={{
                          width: top > 0 && value != null ? `${(value / top) * 100}%` : 0,
                          background: p.color,
                        }}
                      />
                    </span>
                    <span className="text-right font-semibold tabular-nums">{text}</span>
                  </li>
                );
              })}
            </ul>
          </figure>
        );
      })}
    </div>
  );
}

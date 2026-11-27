import type { Factor } from '@/lib/factors';

/** A player's career figures: the headline ones large, the rest in a smaller row. */
export default function ProfileFigures<T>({
  record,
  factors,
  headline,
  extra = [],
}: {
  record: T;
  factors: Factor<T>[];
  headline: string[];
  extra?: { label: string; text: string; help?: string }[];
}) {
  const figure = (factor: Factor<T>) => {
    const value = factor.get(record);
    return value == null ? '–' : (factor.show?.(value) ?? String(value));
  };

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {headline.map((key) => {
          const factor = factors.find((f) => f.key === key)!;
          return (
            <div key={key} className="rounded-xl bg-zinc-950 p-4">
              <dt className="text-xs text-zinc-400">{factor.label}</dt>
              <dd className="text-3xl font-bold">{figure(factor)}</dd>
              {factor.help && <dd className="text-[11px] text-zinc-500">{factor.help}</dd>}
            </div>
          );
        })}
      </dl>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {[
          ...factors
            .filter((f) => !headline.includes(f.key))
            .map((f) => ({ label: f.label, text: figure(f), help: f.help })),
          ...extra,
        ].map((f) => (
          <div key={f.label} title={f.help}>
            <dt className="text-xs text-zinc-500">{f.label}</dt>
            <dd className="font-semibold">{f.text}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

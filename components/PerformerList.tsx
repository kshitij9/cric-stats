export type Performer = {
  id: string;
  name: string;
  thin: boolean; // too little to say much: shown faintly
  record: string;
  best: string;
};

/** A short numbered list of players and what they have done. */
export default function PerformerList({
  title,
  label,
  lines,
  empty,
}: {
  title: string;
  label: string;
  lines: Performer[];
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase text-zinc-500">{title}</h4>
      {lines.length === 0 ? (
        <p className="text-xs text-zinc-500">{empty}</p>
      ) : (
        <ol aria-label={label} className="space-y-2">
          {lines.map((line, i) => (
            <li
              key={line.id}
              data-thin={line.thin || undefined}
              className={`flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 ${line.thin ? 'text-zinc-500' : ''}`}
            >
              <span aria-hidden className="text-lg font-black leading-5 text-zinc-600">
                {i + 1}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold">{line.name}</p>
                <p className="text-xs">{line.record}</p>
                <p className="text-xs text-zinc-500">{line.best}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

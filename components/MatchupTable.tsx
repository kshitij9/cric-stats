import type { Format, Matchup } from '@/lib/types';

export default function MatchupTable({
  data,
  format,
  error,
}: {
  data: Matchup[] | null;
  format: Format;
  error?: string | null;
}) {
  if (error) return <p className="text-xs text-red-300">{error}</p>;
  if (!data) return <div className="animate-pulse h-40 bg-zinc-800 rounded-xl" />;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-zinc-500">
        {format} bowlers who have dismissed this batter most, among those who have bowled more
        than 15 balls to them. Outs count only the bowler&apos;s own wickets.
      </p>
      {data.length === 0 && (
        <p className="text-xs italic text-zinc-600">No bowler meets that in {format}.</p>
      )}
      {data.map((row) => (
        <div
          key={row.bowler_id}
          className="flex justify-between items-center gap-3 p-4 bg-zinc-950 rounded-2xl border border-zinc-800"
        >
          <div>
            <p className="font-bold text-sm">{row.unique_name}</p>
            <p className="text-[11px] text-zinc-500">
              {row.runs} runs from {row.balls} balls · SR {row.strike_rate ?? '–'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-red-500 font-black text-lg">{row.dismissals}</span>
            <p className="text-[10px] text-zinc-500 uppercase font-black">Outs</p>
          </div>
        </div>
      ))}
    </div>
  );
}

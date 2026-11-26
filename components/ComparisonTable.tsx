'use client';

import IncompleteMark from '@/components/IncompleteMark';
import { useCricketStats } from '@/hooks/useCricketStats';
import type { Career, Format, PlayerRef } from '@/lib/types';

export type Factor = {
  key: string;
  label: string;
  get: (career: Career) => number | null;
  show?: (value: number) => string;
};

const percent = (v: number) => `${v}%`;

export const FACTORS: Factor[] = [
  { key: 'innings', label: 'Innings', get: (c) => c.innings },
  { key: 'runs', label: 'Runs', get: (c) => c.runs },
  { key: 'balls', label: 'Balls Faced', get: (c) => c.balls },
  { key: 'average', label: 'Average', get: (c) => c.average },
  { key: 'strike_rate', label: 'Strike Rate', get: (c) => c.strike_rate },
  { key: 'fours', label: 'Fours', get: (c) => c.fours },
  { key: 'sixes', label: 'Sixes', get: (c) => c.sixes },
  { key: 'boundary_percent', label: 'Boundary %', get: (c) => c.boundary_percent, show: percent },
  { key: 'not_out_percent', label: 'Not-out %', get: (c) => c.not_out_percent, show: percent },
  { key: 'balls_per_dismissal', label: 'Balls / Dismissal', get: (c) => c.balls_per_dismissal },
  { key: 'era_index', label: 'Era Index', get: (c) => c.era_index, show: (v) => `${v.toFixed(2)}×` },
];

/** One row per player, one column per factor, all in the same format. */
export default function ComparisonTable({
  players,
  format,
  factors,
}: {
  players: { key: string | number; player: PlayerRef | null }[];
  format: Format;
  factors: Factor[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs md:text-sm">
        <thead>
          <tr className="text-zinc-500 border-b border-zinc-800">
            <th className="py-2 pr-4 text-left font-semibold">Player</th>
            {factors.map((f) => (
              <th key={f.key} className="py-2 px-4 text-right font-semibold">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {players.map(
            ({ key, player }) =>
              player && <Row key={key} player={player} format={format} factors={factors} />,
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ player, format, factors }: { player: PlayerRef; format: Format; factors: Factor[] }) {
  const career = useCricketStats<Career[]>('career', player.player_id, format);
  const record = career.data?.[0];

  return (
    <tr>
      <td className="py-2 pr-4 font-semibold text-zinc-100 whitespace-nowrap">
        {player.unique_name}
        <IncompleteMark show={record?.may_be_incomplete} />
      </td>
      {!record ? (
        <td colSpan={Math.max(factors.length, 1)} className="py-2 px-4 text-right text-zinc-600 italic">
          {career.loading ? 'Loading…' : (career.error ?? `No ${format} batting data`)}
        </td>
      ) : (
        factors.map((f) => {
          const value = f.get(record);
          return (
            <td
              key={f.key}
              className={`py-2 px-4 text-right ${f.key === 'era_index' ? 'font-semibold text-emerald-400' : ''}`}
            >
              {value == null ? <span className="text-zinc-600">–</span> : (f.show?.(value) ?? value)}
            </td>
          );
        })
      )}
    </tr>
  );
}

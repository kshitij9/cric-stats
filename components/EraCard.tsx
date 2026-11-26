'use client';

import IncompleteMark from '@/components/IncompleteMark';
import { useCricketStats } from '@/hooks/useCricketStats';
import type { Career, EraYear, Format, PlayerRef } from '@/lib/types';

/** A player's career era index in a format, and their latest year's. */
export default function EraCard({ player, format }: { player: PlayerRef | null; format: Format }) {
  const career = useCricketStats<Career[]>('career', player?.player_id, format);
  const era = useCricketStats<EraYear[]>('era', player?.player_id, format);
  const record = career.data?.[0];
  const latest = era.data?.at(-1);

  if (!player || !record || record.era_index == null) {
    return (
      <div className="min-h-24 rounded-2xl border border-dashed border-zinc-800 flex items-center justify-center p-4 text-center text-xs text-zinc-500">
        {!player
          ? 'Choose a player'
          : career.loading
            ? 'Loading…'
            : (career.error ?? `No ${format} batting data for ${player.unique_name}`)}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-2">
      <p className="text-sm font-semibold">
        {player.unique_name}
        <IncompleteMark show={record.may_be_incomplete} />
      </p>
      {latest?.era_index != null && (
        <p className="text-xs text-zinc-400">
          Latest year ({latest.year}, {format}):{' '}
          <span className="font-semibold text-emerald-400">
            {latest.era_index.toFixed(2)}× era index
          </span>{' '}
          <span className="text-zinc-600">from {latest.balls} balls</span>
        </p>
      )}
      <p className="text-xs text-zinc-400">
        Career era index ({format}):{' '}
        <span className="font-semibold text-emerald-400">{record.era_index.toFixed(2)}×</span>{' '}
        <span className="text-zinc-600">from {record.balls} balls</span>
      </p>
    </div>
  );
}

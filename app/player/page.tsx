'use client';

import { UserRound } from 'lucide-react';
import BattingProfile from '@/components/BattingProfile';
import BowlingProfile from '@/components/BowlingProfile';
import DisciplineChoice from '@/components/DisciplineChoice';
import PlayerSearch from '@/components/PlayerSearch';
import { PageHeader } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import { QUICK_PICKS } from '@/lib/defaults';

export default function PlayerPage() {
  const { discipline, player, setPlayer } = useApp();

  return (
    <>
      <PageHeader icon={UserRound} title="Player profile">
        {discipline === 'batting'
          ? "A batter's record, season by season, and the bowlers who get them out."
          : "A bowler's record, season by season, and the batters they get out."}
      </PageHeader>

      <DisciplineChoice />

      <div className="max-w-xl space-y-2">
        <PlayerSearch label="Player" selected={player} onSelect={(p) => p && setPlayer(p)} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">Quick picks:</span>
          {QUICK_PICKS[discipline].map((p) => (
            <button
              key={p.player_id}
              type="button"
              aria-pressed={p.player_id === player.player_id}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-medium hover:border-sky-500 hover:text-sky-300 aria-pressed:border-sky-500 aria-pressed:text-sky-300"
              onClick={() => setPlayer(p)}
            >
              {p.unique_name}
            </button>
          ))}
        </div>
      </div>

      {discipline === 'batting' ? <BattingProfile /> : <BowlingProfile />}
    </>
  );
}

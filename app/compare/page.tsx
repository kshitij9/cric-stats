'use client';

import { Scale, X } from 'lucide-react';
import BattingComparison from '@/components/BattingComparison';
import BowlingComparison from '@/components/BowlingComparison';
import DisciplineChoice from '@/components/DisciplineChoice';
import PlayerSearch from '@/components/PlayerSearch';
import { Card, Empty, PageHeader } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import { MAX_COMPARE, PLAYER_COLORS } from '@/lib/colors';

export default function ComparePage() {
  const { discipline, compared, addCompared, removeCompared } = useApp();

  return (
    <>
      <PageHeader icon={Scale} title="Compare">
        Put up to {MAX_COMPARE} players side by side, batting or bowling. Choose the figures that
        matter to you; the best in each is marked.
      </PageHeader>

      <DisciplineChoice />

      <Card title="Players">
        <ul className="flex flex-wrap gap-2">
          {compared.map((p) => (
            <li
              key={p.player_id}
              className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 py-1.5 pl-3 pr-1.5 text-sm font-semibold"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: PLAYER_COLORS[p.slot] }}
              />
              {p.unique_name}
              <button
                type="button"
                aria-label={`Remove ${p.unique_name}`}
                onClick={() => removeCompared(p.player_id)}
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        {compared.length < MAX_COMPARE ? (
          <div className="max-w-md">
            <PlayerSearch
              label="Add a player"
              selected={null}
              onSelect={(p) => p && addCompared(p)}
            />
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            That is the most that can be compared. Remove one to add another.
          </p>
        )}
      </Card>

      {compared.length === 0 ? (
        <Empty>Add a player to start comparing.</Empty>
      ) : discipline === 'batting' ? (
        <BattingComparison />
      ) : (
        <BowlingComparison />
      )}
    </>
  );
}

'use client';

import ComparisonTable, { FACTORS } from '@/components/ComparisonTable';
import EraCard from '@/components/EraCard';
import FormatPicker from '@/components/FormatPicker';
import PlayerProfile from '@/components/PlayerProfile';
import PlayerSearch from '@/components/PlayerSearch';
import { KOHLI, QUICK_PICKS } from '@/lib/defaults';
import type { Format, PlayerRef } from '@/lib/types';
import { BarChart3, Swords } from 'lucide-react';
import { useState } from 'react';

const TABLE_FACTORS = FACTORS.filter((f) =>
  ['innings', 'runs', 'average', 'strike_rate', 'era_index'].includes(f.key),
);

export default function PlayerIntelligence() {
  const [player, setPlayer] = useState<PlayerRef>(KOHLI);
  const [format, setFormat] = useState<Format>('ODI');
  // the first two are also the duel's pair
  const [compared, setCompared] = useState<(PlayerRef | null)[]>(QUICK_PICKS);

  const choose = (index: number, p: PlayerRef | null) =>
    setCompared((prev) => prev.map((old, i) => (i === index ? p : old)));

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      <PlayerProfile
        player={player}
        onPlayer={setPlayer}
        format={format}
        onFormat={setFormat}
        quickPicks={QUICK_PICKS}
      />

      <section className="max-w-7xl mx-auto mt-10">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Swords className="text-emerald-400" /> Era-Adjusted Duel
          </h2>
          <p className="text-sm text-zinc-500">
            Compare how two players stack up once you normalize for the scoring environment of
            their eras. Era index &gt; 1 means a player scores faster than the average batter of
            the same gender in those years; &lt; 1 means slower.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlayerSearch label="Player A" selected={compared[0]} onSelect={(p) => choose(0, p)} clearable />
            <PlayerSearch label="Player B" selected={compared[1]} onSelect={(p) => choose(1, p)} clearable />
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <EraCard player={compared[0]} format={format} />
            <EraCard player={compared[1]} format={format} />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto mt-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <BarChart3 className="text-sky-400" /> Multi-Player Comparison
          </h2>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-sm text-zinc-500">
              Line up players and compare their career batting figures and era index.
            </p>
            <FormatPicker value={format} onChange={setFormat} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {compared.map((p, i) => (
              <PlayerSearch
                key={i}
                label={`Player ${i + 1}`}
                selected={p}
                onSelect={(next) => choose(i, next)}
                clearable
              />
            ))}
          </div>

          <ComparisonTable
            players={compared.map((p, i) => ({ key: i, player: p }))}
            format={format}
            factors={TABLE_FACTORS}
          />
        </div>
      </section>
    </main>
  );
}

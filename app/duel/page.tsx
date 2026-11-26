'use client';

import DuelRadar from '@/components/DuelRadar';
import EraCard from '@/components/EraCard';
import EraChart from '@/components/EraChart';
import FormatPicker from '@/components/FormatPicker';
import NavTabs from '@/components/NavTabs';
import PlayerSearch from '@/components/PlayerSearch';
import { useCricketStats } from '@/hooks/useCricketStats';
import { KOHLI, SHARMA } from '@/lib/defaults';
import type { Career, EraYear, Format, PlayerRef } from '@/lib/types';
import { Swords } from 'lucide-react';
import { useState } from 'react';

export default function DuelPage() {
  const [playerA, setPlayerA] = useState<PlayerRef>(KOHLI);
  const [playerB, setPlayerB] = useState<PlayerRef>(SHARMA);
  const [format, setFormat] = useState<Format>('ODI');

  const careerA = useCricketStats<Career[]>('career', playerA.player_id, format);
  const careerB = useCricketStats<Career[]>('career', playerB.player_id, format);
  const eraA = useCricketStats<EraYear[]>('era', playerA.player_id, format);
  const eraB = useCricketStats<EraYear[]>('era', playerB.player_id, format);

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      <header className="max-w-4xl mx-auto flex flex-col gap-4 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
            <Swords className="text-emerald-400" /> Era-Adjusted Duel
          </h1>
          <NavTabs />
        </div>
        <p className="text-sm text-zinc-500 max-w-2xl">
          Pick any two batters and compare how they stack up once you normalize for the scoring
          environment of their eras. Era index compares a player&apos;s scoring with the average
          batter of the same gender in each year they played (1.00 = average, 1.20 = 20% faster).
        </p>
      </header>

      <section className="max-w-4xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlayerSearch label="Player A" selected={playerA} onSelect={(p) => p && setPlayerA(p)} />
          <PlayerSearch label="Player B" selected={playerB} onSelect={(p) => p && setPlayerB(p)} />
        </div>

        <FormatPicker value={format} onChange={setFormat} accent="emerald" />

        <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
          <p className="text-xs text-zinc-400 mb-2">
            Overlayed style comparison in {format}. Blue = {playerA.unique_name}, Orange ={' '}
            {playerB.unique_name}.
          </p>
          <DuelRadar
            format={format}
            labelA={playerA.unique_name}
            labelB={playerB.unique_name}
            profileA={careerA.data?.[0] ?? null}
            profileB={careerB.data?.[0] ?? null}
          />
        </div>

        <div className="mt-4 space-y-6">
          {[
            { player: playerA, era: eraA },
            { player: playerB, era: eraB },
          ].map(({ player, era }, i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-400 mb-2">
                {player.unique_name} – Era index by year ({format})
              </p>
              <EraChart data={era.data ?? []} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <EraCard player={playerA} format={format} />
          <EraCard player={playerB} format={format} />
        </div>
      </section>
    </main>
  );
}

'use client';

import PlayerProfile from '@/components/PlayerProfile';
import { KOHLI } from '@/lib/defaults';
import type { Format, PlayerRef } from '@/lib/types';
import { useState } from 'react';

export default function PlayerPage() {
  const [player, setPlayer] = useState<PlayerRef>(KOHLI);
  const [format, setFormat] = useState<Format>('ODI');

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      <PlayerProfile player={player} onPlayer={setPlayer} format={format} onFormat={setFormat} />
    </main>
  );
}

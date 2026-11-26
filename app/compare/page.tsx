'use client';

import ComparisonTable, { FACTORS } from '@/components/ComparisonTable';
import FormatPicker from '@/components/FormatPicker';
import NavTabs from '@/components/NavTabs';
import PlayerSearch from '@/components/PlayerSearch';
import { QUICK_PICKS } from '@/lib/defaults';
import type { Format, PlayerRef } from '@/lib/types';
import { BarChart3, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';

const DEFAULT_FACTOR_KEYS = ['innings', 'runs', 'average', 'strike_rate', 'era_index'];

type Slot = { key: number; player: PlayerRef | null };

export default function ComparePage() {
  const [format, setFormat] = useState<Format>('ODI');
  const [slots, setSlots] = useState<Slot[]>(() =>
    QUICK_PICKS.map((player, key) => ({ key, player })),
  );
  // a key that stays with its box when others are removed
  const nextKey = useRef(QUICK_PICKS.length);
  const [factorKeys, setFactorKeys] = useState<string[]>(DEFAULT_FACTOR_KEYS);

  const selectedFactors = FACTORS.filter((f) => factorKeys.includes(f.key));

  const choose = (key: number, player: PlayerRef | null) =>
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, player } : s)));

  const addPlayer = () => {
    const key = nextKey.current++;
    setSlots((prev) => [...prev, { key, player: null }]);
  };

  const toggleFactor = (key: string) =>
    setFactorKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-12 font-sans">
      <header className="max-w-7xl mx-auto flex flex-col gap-4 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
            <BarChart3 className="text-sky-400" /> Multi-Player Comparison
          </h1>
          <NavTabs />
        </div>
        <p className="text-sm text-zinc-500 max-w-2xl">
          Line up any number of players in the same format and compare their batting across any
          combination of factors you pick below.
        </p>
      </header>

      <section className="max-w-7xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div>
          <p className="text-xs text-zinc-500 mb-2">Players</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {slots.map((slot, i) => (
              <div key={slot.key}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-zinc-500">Player {i + 1}</p>
                  {slots.length > 1 && (
                    <button
                      onClick={() => setSlots((prev) => prev.filter((s) => s.key !== slot.key))}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                      aria-label={`Remove Player ${i + 1}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <PlayerSearch
                  selected={slot.player}
                  onSelect={(p) => choose(slot.key, p)}
                  placeholder={`Search player ${i + 1}`}
                  clearable
                />
              </div>
            ))}
          </div>
          <button
            onClick={addPlayer}
            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
          >
            <Plus size={14} /> Add player
          </button>
        </div>

        <FormatPicker value={format} onChange={setFormat} accent="sky" />

        <div>
          <p className="text-xs text-zinc-500 mb-2">Factors</p>
          <div className="flex flex-wrap gap-2">
            {FACTORS.map((f) => {
              const active = factorKeys.includes(f.key);
              return (
                <button
                  key={f.key}
                  aria-pressed={active}
                  onClick={() => toggleFactor(f.key)}
                  className={[
                    'px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors',
                    active
                      ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-sky-500/70 hover:text-sky-200',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <ComparisonTable players={slots} format={format} factors={selectedFactors} />
        {selectedFactors.length === 0 && (
          <p className="text-xs text-zinc-600 italic">Pick at least one factor above to see numbers.</p>
        )}
      </section>
    </main>
  );
}

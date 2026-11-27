'use client';

import SearchBox from '@/components/SearchBox';
import { useApp } from '@/hooks/useApp';
import type { PlayerRef, PlayerSummary } from '@/lib/types';

const years = (p: PlayerSummary) =>
  p.first_year === p.last_year ? `${p.first_year}` : `${p.first_year}–${p.last_year}`;

/** Finds players with a match in the competition on screen. */
export default function PlayerSearch({
  label,
  selected,
  onSelect,
  placeholder = 'Search by player name',
  clearable,
}: {
  label?: string;
  selected: PlayerRef | null;
  onSelect: (player: PlayerRef | null) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  const { competition } = useApp();
  return (
    <SearchBox<PlayerRef, PlayerSummary>
      label={label}
      selected={selected}
      onSelect={(p) =>
        onSelect(p && { player_id: p.player_id, name: p.name, unique_name: p.unique_name })
      }
      endpoint={`/api/players?competition=${competition}`}
      itemKey={(p) => p.player_id}
      itemText={(p) => p.unique_name}
      placeholder={placeholder}
      clearable={clearable}
      renderItem={(p) => (
        <>
          <p className="text-sm font-semibold text-zinc-100">
            {p.unique_name}
            {p.full_name && <span className="ml-2 font-normal text-zinc-400">{p.full_name}</span>}
          </p>
          <p className="text-[11px] text-zinc-500">
            {p.teams.join(', ')}
            {competition === 'international' && ` · ${p.gender === 'female' ? 'Women' : 'Men'}`} ·{' '}
            {years(p)} · {p.matches} {p.matches === 1 ? 'match' : 'matches'}
          </p>
        </>
      )}
    />
  );
}

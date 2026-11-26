'use client';

import SearchBox from '@/components/SearchBox';
import type { VenueRef, VenueSummary } from '@/lib/types';

const title = (v: VenueRef) => (v.city ? `${v.name}, ${v.city}` : v.name);

export default function VenueSearch({
  label,
  selected,
  onSelect,
}: {
  label?: string;
  selected: VenueRef | null;
  onSelect: (venue: VenueRef | null) => void;
}) {
  return (
    <SearchBox<VenueRef, VenueSummary>
      label={label}
      selected={selected}
      onSelect={(v) => onSelect(v && { venue_id: v.venue_id, name: v.name, city: v.city })}
      endpoint="/api/venues"
      itemKey={(v) => v.venue_id}
      itemText={title}
      placeholder="Search by ground or city"
      clearable
      renderItem={(v) => (
        <>
          <p className="text-sm font-semibold text-zinc-100">{v.name}</p>
          <p className="text-[11px] text-zinc-500">
            {v.city || 'city not recorded'} · {v.matches} {v.matches === 1 ? 'match' : 'matches'}
          </p>
        </>
      )}
    />
  );
}

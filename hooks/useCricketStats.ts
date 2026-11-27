'use client';

import { useJson, useJsonList } from '@/hooks/useJson';
import type { Scope } from '@/lib/types';

const url = (type: string, playerId: string, { format, competition }: Scope) =>
  `/api/stats/${type}?id=${encodeURIComponent(playerId)}&format=${format}&competition=${competition}`;

/** One player's statistics in one scope. */
export function useCricketStats<T>(type: string, playerId: string, scope: Scope) {
  return useJson<T>(url(type, playerId, scope));
}

/** The same statistics for several players, in the order given. */
export function useCricketStatsList<T>(type: string, playerIds: string[], scope: Scope) {
  return useJsonList<T>(playerIds.map((id) => url(type, id, scope)));
}

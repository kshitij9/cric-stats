'use client';

import { useEffect, useState } from 'react';
import type { SquadPlayer } from '@/lib/teams';

/**
 * The records of a team's players, asking only about those not yet known, so
 * that adding or moving one does not blank the others. null: no IPL record.
 */
export function useSquad(ids: string[]) {
  const [known, setKnown] = useState<Record<string, SquadPlayer | null>>({});
  const [error, setError] = useState<string | null>(null);
  const missing = ids
    .filter((id) => !(id in known))
    .sort()
    .join(',');

  useEffect(() => {
    if (!missing) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/squad?ids=${missing}`, { signal: controller.signal });
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error);
        const found = new Map((json as SquadPlayer[]).map((p) => [p.player_id, p]));
        setKnown((old) => ({
          ...old,
          ...Object.fromEntries(missing.split(',').map((id) => [id, found.get(id) ?? null])),
        }));
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError((err as Error).message || 'could not read the players');
        }
      }
    })();
    return () => controller.abort();
  }, [missing]);

  return { known, error };
}

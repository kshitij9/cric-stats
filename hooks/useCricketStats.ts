import { useEffect, useState } from 'react';
import type { Format } from '@/lib/types';

type Result<T> = { url: string; data: T | null; error: string | null };

/**
 * One player's statistics in one format. `data` only ever belongs to the player
 * and format asked for now: it is null while a new choice is loading.
 */
export function useCricketStats<T>(type: string, playerId: string | null | undefined, format: Format) {
  const url = playerId
    ? `/api/stats/${type}?id=${encodeURIComponent(playerId)}&format=${format}`
    : null;
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error ?? `Request failed (${response.status})`);
        setResult({ url, data: json as T, error: null });
      } catch (err) {
        if (controller.signal.aborted) return;
        setResult({ url, data: null, error: (err as Error).message });
      }
    };

    load();
    return () => controller.abort();
  }, [url]);

  const current = result && result.url === url ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: url !== null && current === null,
  };
}

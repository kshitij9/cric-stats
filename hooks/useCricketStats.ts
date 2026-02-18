import { useState, useEffect } from 'react';

export function useCricketStats(type: string, playerName: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerName) return;
    const controller = new AbortController();

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/stats/${type}?name=${encodeURIComponent(playerName)}`,
          { signal: controller.signal }
        );
        const json = await response.json();

        if (!response.ok) {
          const message =
            (json && typeof json === 'object' && 'error' in json && (json as any).error) ||
            `Request failed (${response.status})`;
          throw new Error(String(message));
        }

        setData(json);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err?.message ?? 'Request failed');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    return () => controller.abort();
  }, [type, playerName]);

  return { data, loading, error };
}
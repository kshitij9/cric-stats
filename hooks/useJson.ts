'use client';

import { useEffect, useState } from 'react';

export type Loaded<T> = { data: T | null; error: string | null; loading: boolean };

type Answer<T> = { data: T | null; error: string | null };

async function get<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error ?? `Request failed (${response.status})`);
  return json as T;
}

/**
 * The answers from several addresses, in the same order. An answer only ever
 * belongs to the address asked for now: it is loading until that one arrives.
 * A change waits `delay` milliseconds, so typing does not send every keystroke.
 */
export function useJsonList<T>(urls: string[], delay = 0): Loaded<T>[] {
  const key = urls.join('\n');
  const [answers, setAnswers] = useState<Record<string, Answer<T>>>({});

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      for (const url of key.split('\n').filter(Boolean)) {
        get<T>(url, controller.signal).then(
          (data) => setAnswers((old) => ({ ...old, [url]: { data, error: null } })),
          (err: Error) => {
            if (controller.signal.aborted) return;
            setAnswers((old) => ({ ...old, [url]: { data: null, error: err.message } }));
          },
        );
      }
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, delay]);

  return urls.map((url) => {
    const answer = answers[url];
    return answer ? { ...answer, loading: false } : { data: null, error: null, loading: true };
  });
}

/** The answer from one address; nothing is asked while it is null. */
export function useJson<T>(url: string | null, delay = 0): Loaded<T> {
  const [answer] = useJsonList<T>(url ? [url] : [], delay);
  return answer ?? { data: null, error: null, loading: false };
}

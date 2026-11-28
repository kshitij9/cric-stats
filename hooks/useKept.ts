'use client';

import { useState } from 'react';
import type { Loaded } from '@/hooks/useJson';

/**
 * The last answer, kept while the next is on its way, so that changing a choice
 * does not empty the screen and lose the reader's place. `stale` while what is
 * shown is not yet the answer to what is chosen.
 */
export function useKept<T>(loaded: Loaded<T>): Loaded<T> & { stale: boolean } {
  const [kept, setKept] = useState<T | null>(null);
  if (loaded.data && loaded.data !== kept) setKept(loaded.data);
  if (loaded.data || loaded.error) return { ...loaded, stale: false };
  return { ...loaded, data: kept, stale: kept !== null };
}

'use client';

import { useApp } from '@/hooks/useApp';
import { useJson } from '@/hooks/useJson';
import { day } from '@/lib/dates';
import type { Coverage } from '@/lib/types';

/** What the numbers on every screen are based on. */
export default function CoverageNote() {
  const { competition } = useApp();
  const { data, error } = useJson<Coverage>(`/api/coverage?competition=${competition}`);

  return (
    <footer className="mx-auto max-w-6xl border-t border-zinc-800 px-4 py-6 text-xs leading-relaxed text-zinc-500">
      {!data ? (
        error ? 'Could not read what period the data covers.' : 'Reading data coverage…'
      ) : competition === 'ipl' ? (
        <>
          <span className="font-semibold text-zinc-300">
            Data: the IPL from {day(data.from)} to {day(data.to)}.
          </span>{' '}
          Super overs are not counted. Ball-by-ball data from{' '}
          <a className="underline hover:text-sky-300" href="https://cricsheet.org" target="_blank" rel="noreferrer">
            Cricsheet
          </a>
          .
        </>
      ) : (
        <>
          <span className="font-semibold text-zinc-300">
            Data: internationals from {day(data.from)} to {day(data.to)}
          </span>
          , men&apos;s and women&apos;s. No Afghanistan men&apos;s matches (
          <a
            className="underline hover:text-sky-300"
            href="https://cricsheet.org/withheld-matches"
            target="_blank"
            rel="noreferrer"
          >
            the source withholds them
          </a>
          ). Super overs are not counted. Early years are thin, as is women&apos;s cricket before
          2018; <span className="text-amber-400">†</span> marks careers that may be incomplete.
        </>
      )}
    </footer>
  );
}

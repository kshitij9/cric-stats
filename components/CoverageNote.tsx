'use client';

import { useEffect, useState } from 'react';
import type { Coverage } from '@/lib/types';

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** What the numbers on every screen are based on. */
export default function CoverageNote() {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/coverage')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setCoverage)
      .catch(() => setFailed(true));
  }, []);

  return (
    <aside className="bg-zinc-950 border-b border-zinc-800 px-4 md:px-12 py-2 text-[11px] leading-relaxed text-zinc-400">
      {coverage ? (
        <>
          <span className="font-semibold text-zinc-200">
            Data: internationals from {day(coverage.from)} to {day(coverage.to)}
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
      ) : failed ? (
        'Could not read what period the data covers.'
      ) : (
        'Reading data coverage…'
      )}
    </aside>
  );
}

import type { ReactNode } from 'react';

/** Dims what is about to be replaced. */
export default function Stale({ when, children }: { when: boolean; children: ReactNode }) {
  return (
    <div aria-busy={when} className={`transition-opacity ${when ? 'opacity-50' : ''}`}>
      {children}
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { Empty, SECONDARY } from '@/components/ui';
import { useApp } from '@/hooks/useApp';

/** Shows its contents only while the IPL is chosen. */
export default function IplOnly({ children }: { children: ReactNode }) {
  const { competition, setCompetition } = useApp();
  if (competition === 'ipl') return children;
  return (
    <Empty>
      Teams are for the men&rsquo;s IPL for now.
      <button type="button" className={SECONDARY} onClick={() => setCompetition('ipl')}>
        Switch to the IPL
      </button>
    </Empty>
  );
}

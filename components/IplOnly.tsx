'use client';

import type { ReactNode } from 'react';
import { Empty, SECONDARY } from '@/components/ui';
import { useApp } from '@/hooks/useApp';

/** Shows its contents only while the IPL is chosen. */
export default function IplOnly({
  children,
  what = 'Teams are',
}: {
  children: ReactNode;
  what?: string; // the subject of "… for the men's IPL for now"
}) {
  const { competition, setCompetition } = useApp();
  if (competition === 'ipl') return children;
  return (
    <Empty>
      {what} for the men&rsquo;s IPL for now.
      <button type="button" className={SECONDARY} onClick={() => setCompetition('ipl')}>
        Switch to the IPL
      </button>
    </Empty>
  );
}

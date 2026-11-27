'use client';

import { Segmented } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import type { Discipline } from '@/lib/types';

/** Batting or bowling, for the screens that show one at a time. */
export default function DisciplineChoice() {
  const { discipline, setDiscipline } = useApp();
  return (
    <Segmented<Discipline>
      label="Batting or bowling"
      hideLabel
      options={[
        { value: 'batting', label: 'Batting' },
        { value: 'bowling', label: 'Bowling' },
      ]}
      value={discipline}
      onChange={(v) => v && setDiscipline(v)}
    />
  );
}

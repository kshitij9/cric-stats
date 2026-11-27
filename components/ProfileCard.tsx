'use client';

import { Plus, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import IncompleteMark from '@/components/IncompleteMark';
import { Card, Empty, ErrorNote, Loading, PRIMARY, SECONDARY } from '@/components/ui';
import { useApp } from '@/hooks/useApp';
import type { Loaded } from '@/hooks/useJson';
import { MAX_COMPARE } from '@/lib/colors';
import { scopeName } from '@/lib/scope';

type Summary = { first_match: string | null; last_match: string | null; may_be_incomplete: boolean };

/** The player on screen: who they are, and the career figures passed in. */
export default function ProfileCard({
  career,
  children,
}: {
  career: Loaded<Summary[]>;
  children: ReactNode;
}) {
  const router = useRouter();
  const { competition, scope, discipline, player, compared, addCompared, setCompetition } = useApp();
  const record = career.data?.[0] ?? null;
  const label = scopeName(scope);
  const isCompared = compared.some((p) => p.player_id === player.player_id);
  const full = compared.length >= MAX_COMPARE;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">
            {player.unique_name}
            <IncompleteMark show={record?.may_be_incomplete} />
          </h2>
          <p className="text-sm text-zinc-400">
            {label} {discipline}
            {record?.first_match &&
              ` · ${record.first_match.slice(0, 4)}–${record.last_match?.slice(0, 4)}`}
          </p>
        </div>
        <button
          type="button"
          className={isCompared ? SECONDARY : PRIMARY}
          disabled={!isCompared && full}
          onClick={() => {
            addCompared(player);
            router.push('/compare');
          }}
        >
          {isCompared ? <Scale size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
          {isCompared ? 'See in comparison' : full ? 'Comparison is full' : 'Add to comparison'}
        </button>
      </div>

      {record ? (
        children
      ) : career.loading ? (
        <Loading />
      ) : career.error ? (
        <ErrorNote>{career.error}</ErrorNote>
      ) : (
        <Empty>
          <p>
            No {label} {discipline} data for {player.unique_name}.
          </p>
          <button
            type="button"
            className={SECONDARY}
            onClick={() => setCompetition(competition === 'ipl' ? 'international' : 'ipl')}
          >
            Show {competition === 'ipl' ? 'internationals' : 'the IPL'}
          </button>
        </Empty>
      )}
    </Card>
  );
}

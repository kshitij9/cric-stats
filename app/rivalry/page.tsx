'use client';

import { ArrowLeft, Flame } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import IplOnly from '@/components/IplOnly';
import Grounds from '@/components/rivalry/Grounds';
import Performers from '@/components/rivalry/Performers';
import HeadRecord from '@/components/rivalry/HeadRecord';
import Results from '@/components/rivalry/Results';
import Stale from '@/components/Stale';
import {
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  SECONDARY,
  Segmented,
} from '@/components/ui';
import { useJson } from '@/hooks/useJson';
import { useKept } from '@/hooks/useKept';
import type { SeasonChoice } from '@/lib/matchup-types';
import type { FranchiseSpan, Rivalry } from '@/lib/rivalry-types';

export default function RivalryPage() {
  return (
    <>
      <PageHeader icon={Flame} title="Rivalry">
        Two IPL franchises against each other: who has won, how recent meetings went and who did
        most in them, everywhere or at one ground. These are the sides as they lined up on the day,
        not your teams.
      </PageHeader>
      <Link href="/teams" className={SECONDARY}>
        <ArrowLeft size={14} aria-hidden /> Your teams
      </Link>
      <IplOnly what="Rivalries are">
        {/* the choices are in the address, so a rivalry can be bookmarked */}
        <Suspense fallback={<Loading />}>
          <Chosen />
        </Suspense>
      </IplOnly>
    </>
  );
}

type Choice = { a: string; b: string; ground: string; seasons: SeasonChoice };

function Chosen() {
  const params = useSearchParams();
  const router = useRouter();
  const franchises = useJson<FranchiseSpan[]>('/api/rivalry/franchises');

  const choice: Choice = {
    a: params.get('a') ?? '',
    b: params.get('b') ?? '',
    ground: params.get('ground') ?? '',
    seasons: params.get('seasons') === 'recent' ? 'recent' : 'all',
  };

  const choose = (change: Partial<Choice>) => {
    const next = { ...choice, ...change };
    const query = new URLSearchParams(
      Object.entries(next).filter(
        ([key, value]) => value && !(key === 'seasons' && value === 'all'),
      ),
    );
    router.replace(`/rivalry?${query}`, { scroll: false });
  };

  const known = (team: string) => franchises.data?.some((f) => f.team === team) ?? false;
  const a = known(choice.a) ? choice.a : '';
  const b = known(choice.b) && choice.b !== a ? choice.b : '';

  const asked = useJson<Rivalry>(
    a && b
      ? `/api/rivalry?${new URLSearchParams({
          a,
          b,
          seasons: choice.seasons,
          venue: choice.ground,
        })}`
      : null,
  );
  // what is on screen stays, dimmed, until the answer to a new choice arrives
  const { data, error, stale } = useKept(asked);

  if (franchises.error) return <ErrorNote>{franchises.error}</ErrorNote>;
  if (!franchises.data) return <Loading />;

  // grounds where they have met, and the chosen one even if they have not
  const grounds = data?.grounds.map((g) => ({
    id: g.venue_id,
    label: `${g.name} (${g.record.played})`,
  }));
  if (grounds && data?.venue && !grounds.some((g) => g.id === data.venue!.venue_id)) {
    grounds.push({ id: data.venue.venue_id, label: `${data.venue.name} (0)` });
  }

  return (
    <>
      <Card title="Choose">
        <div className="grid gap-4 md:grid-cols-2">
          <FranchiseSelect
            label="First franchise"
            franchises={franchises.data}
            value={a}
            taken={b}
            onChange={(team) => choose({ a: team, ground: '' })}
          />
          <FranchiseSelect
            label="Second franchise"
            franchises={franchises.data}
            value={b}
            taken={a}
            onChange={(team) => choose({ b: team, ground: '' })}
          />
        </div>
        <div className="max-w-md space-y-1.5">
          <label htmlFor="rivalry-ground" className="block text-xs text-zinc-400">
            Ground
          </label>
          <select
            id="rivalry-ground"
            className={SELECT}
            disabled={!a || !b || !grounds}
            value={data?.venue ? choice.ground : ''}
            onChange={(e) => choose({ ground: e.target.value })}
          >
            <option value="">All grounds</option>
            {grounds?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <Segmented<SeasonChoice>
          label="Seasons"
          options={[
            { value: 'all', label: 'All seasons' },
            { value: 'recent', label: 'Last 4 seasons' },
          ]}
          value={choice.seasons}
          onChange={(seasons) => seasons && choose({ seasons })}
        />
      </Card>

      {!a || !b ? (
        <Empty>
          Choose two franchises.
          <button
            type="button"
            className={SECONDARY}
            onClick={() => choose({ a: 'Mumbai Indians', b: 'Chennai Super Kings' })}
          >
            Try Mumbai v Chennai
          </button>
        </Empty>
      ) : error ? (
        <ErrorNote>
          {error}
          {choice.ground && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => choose({ ground: '' })}
            >
              Show all grounds
            </button>
          )}
        </ErrorNote>
      ) : !data ? (
        <Loading />
      ) : (
        <Stale when={stale}>
          <div className="space-y-6">
            <HeadRecord data={data} />
            {/* a new choice starts its list short again */}
            <Results
              key={`${data.teams.join()} ${data.venue?.venue_id} ${data.seasons.choice}`}
              data={data}
            />
            {data.meetings.length > 0 && <Performers data={data} />}
            {data.grounds.length > 0 && (
              <Grounds data={data} onGround={(id) => choose({ ground: id })} />
            )}
          </div>
        </Stale>
      )}
    </>
  );
}

const SELECT =
  'w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50';

function FranchiseSelect({
  label,
  franchises,
  value,
  taken,
  onChange,
}: {
  label: string;
  franchises: FranchiseSpan[];
  value: string;
  taken: string; // chosen on the other side
  onChange: (team: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  const options = (current: boolean) =>
    franchises
      .filter((f) => f.current === current)
      .map((f) => (
        <option key={f.team} value={f.team} disabled={f.team === taken}>
          {f.team}
          {!current &&
            ` (${f.first_season === f.last_season ? f.first_season : `${f.first_season}–${f.last_season}`})`}
        </option>
      ));
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs text-zinc-400">
        {label}
      </label>
      <select id={id} className={SELECT} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a franchise</option>
        <optgroup label="Playing now">{options(true)}</optgroup>
        <optgroup label="No longer playing">{options(false)}</optgroup>
      </select>
    </div>
  );
}

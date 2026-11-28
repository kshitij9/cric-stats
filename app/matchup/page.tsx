'use client';

import { ArrowLeft, Swords } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import FaceOff from '@/components/FaceOff';
import GroundCard from '@/components/GroundCard';
import GroundRecords from '@/components/GroundRecords';
import HeadToHead from '@/components/HeadToHead';
import IplOnly from '@/components/IplOnly';
import KeyBattles from '@/components/KeyBattles';
import {
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  SECONDARY,
  Segmented,
} from '@/components/ui';
import VenueSearch from '@/components/VenueSearch';
import { useJson } from '@/hooks/useJson';
import type { FaceOff as FaceOffData } from '@/lib/faceoff-types';
import type { CurrentGround, GroundProfile, Matchup, SeasonChoice } from '@/lib/matchup-types';
import { TEAM_SIZE, type TeamListing } from '@/lib/teams';

export default function MatchupPage() {
  return (
    <>
      <PageHeader icon={Swords} title="Matchup">
        Set two of your teams against each other: which side has batted and bowled better, who has
        had the better of whom, and how a ground plays. These are records of past matches. It does
        not predict a result.
      </PageHeader>
      <Link href="/teams" className={SECONDARY}>
        <ArrowLeft size={14} aria-hidden /> All teams
      </Link>
      <IplOnly>
        {/* the choices are in the address, so a matchup can be bookmarked */}
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
  const teams = useJson<TeamListing[]>('/api/teams');
  const grounds = useJson<CurrentGround[]>('/api/matchup/grounds');

  const choice: Choice = {
    a: params.get('a') ?? '',
    b: params.get('b') ?? '',
    ground: params.get('ground') ?? '',
    seasons: params.get('seasons') === 'all' ? 'all' : 'recent',
  };

  const choose = (change: Partial<Choice>) => {
    const next = { ...choice, ...change };
    const query = new URLSearchParams(
      Object.entries(next).filter(([key, value]) => value && !(key === 'seasons' && value === 'recent')),
    );
    router.replace(`/matchup?${query}`, { scroll: false });
  };

  // an address may name a team since deleted
  const find = (id: string) => teams.data?.find((t) => String(t.team_id) === id);
  const a = find(choice.a);
  const b = choice.b === choice.a ? undefined : find(choice.b);

  const profile = useJson<GroundProfile>(
    choice.ground
      ? `/api/matchup/ground?venue=${encodeURIComponent(choice.ground)}&seasons=${choice.seasons}`
      : null,
  );
  const venue = profile.data?.venue ?? grounds.data?.find((g) => g.venue_id === choice.ground);
  const groundOk = choice.ground !== '' && !profile.error;
  const matched = useJson<Matchup>(
    a && b && !profile.loading
      ? `/api/matchup?a=${a.team_id}&b=${b.team_id}` +
          (groundOk ? `&venue=${encodeURIComponent(choice.ground)}` : '') +
          // a team changed since must be asked about afresh
          `&v=${a.version}.${b.version}`
      : null,
  );

  const compared = useJson<FaceOffData>(
    a && b && !profile.loading
      ? `/api/matchup/faceoff?a=${a.team_id}&b=${b.team_id}&seasons=${choice.seasons}` +
          (groundOk ? `&venue=${encodeURIComponent(choice.ground)}` : '') +
          `&v=${a.version}.${b.version}`
      : null,
  );

  if (teams.error) return <ErrorNote>{teams.error}</ErrorNote>;
  if (!teams.data) return <Loading />;
  if (teams.data.length < 2) {
    return (
      <Empty>
        A matchup needs two teams.
        <Link className={SECONDARY} href="/teams">
          Make a team
        </Link>
      </Empty>
    );
  }

  const shared = a && b ? a.names.filter((_, i) => b.players.includes(a.players[i])) : [];
  const short = [a, b].flatMap((t) => (t && t.players.length < TEAM_SIZE ? [t] : []));

  return (
    <>
      <Card title="Choose">
        <div className="grid gap-4 md:grid-cols-2">
          <TeamSelect
            label="First team"
            teams={teams.data}
            value={a}
            taken={b}
            onChange={(id) => choose({ a: id })}
          />
          <TeamSelect
            label="Second team"
            teams={teams.data}
            value={b}
            taken={a}
            onChange={(id) => choose({ b: id })}
          />
        </div>
        <div className="max-w-md">
          <VenueSearch
            label="Ground"
            selected={venue ?? null}
            onSelect={(v) => choose({ ground: v?.venue_id ?? '' })}
          />
        </div>
        {grounds.data && (
          <div role="group" aria-label="Grounds of the latest season">
            <p className="mb-1.5 text-xs text-zinc-400">Or a ground of the latest season</p>
            <div className="flex flex-wrap gap-1.5">
              {grounds.data.map((g) => {
                const active = g.venue_id === choice.ground;
                return (
                  <button
                    key={g.venue_id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => choose({ ground: g.venue_id })}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 ${
                      active
                        ? 'border-sky-500 bg-sky-500 font-semibold text-zinc-950'
                        : 'border-zinc-700 text-zinc-300 hover:border-sky-500'
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Segmented<SeasonChoice>
            label="Seasons"
            options={[
              { value: 'recent', label: 'Last 4 seasons' },
              { value: 'all', label: 'All seasons' },
            ]}
            value={choice.seasons}
            onChange={(seasons) => seasons && choose({ seasons })}
          />
          <p className="text-[11px] text-zinc-500">
            For the team comparison and the ground. Battles, player records and head-to-heads cover
            every season.
          </p>
        </div>
        {shared.length > 0 && (
          <p className="text-xs text-amber-300">
            In both teams: {shared.join(', ')}.
          </p>
        )}
        {short.map((t) => (
          <p key={t.team_id} className="text-xs text-amber-300">
            {t.name} has only {t.players.length} of {TEAM_SIZE} players.
          </p>
        ))}
      </Card>

      {a && b && (
        <>
          <FaceOff faceOff={compared} />
          {matched.data && (
            <KeyBattles
              sides={matched.data.sides}
              pairs={matched.data.pairs}
              ground={matched.data.venue !== null}
            />
          )}
        </>
      )}

      {choice.ground && <GroundCard profile={profile} />}

      {!a || !b ? (
        <Empty>Choose two teams to see their players’ records and head-to-heads.</Empty>
      ) : matched.error ? (
        <ErrorNote>{matched.error}</ErrorNote>
      ) : !matched.data ? (
        <Loading />
      ) : (
        <>
          {matched.data.sides.map(
            (side) =>
              side.missing > 0 && (
                <ErrorNote key={side.team_id}>
                  {side.missing} of {side.name}’s players are no longer in the match data. Edit the
                  team.
                </ErrorNote>
              ),
          )}
          {matched.data.venue ? (
            <GroundRecords sides={matched.data.sides} ground={matched.data.venue.name} />
          ) : (
            <Empty>Choose a ground to see what these players have done there.</Empty>
          )}
          <HeadToHead sides={matched.data.sides} pairs={matched.data.pairs} />
        </>
      )}
    </>
  );
}

function TeamSelect({
  label,
  teams,
  value,
  taken,
  onChange,
}: {
  label: string;
  teams: TeamListing[];
  value: TeamListing | undefined;
  taken: TeamListing | undefined; // chosen on the other side
  onChange: (id: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs text-zinc-400">
        {label}
      </label>
      <select
        id={id}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
        value={value?.team_id ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose a team</option>
        {teams.map((t) => (
          <option key={t.team_id} value={t.team_id} disabled={t.team_id === taken?.team_id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

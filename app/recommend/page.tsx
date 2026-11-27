'use client';

import { AlertTriangle, ListOrdered, Plus, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState, type ReactNode } from 'react';
import PickCard, { VIEW, type Ranked, type Role } from '@/components/PickCard';
import PlayerSearch from '@/components/PlayerSearch';
import { Card, Empty, ErrorNote, Loading, PageHeader, Segmented } from '@/components/ui';
import VenueSearch from '@/components/VenueSearch';
import { useApp } from '@/hooks/useApp';
import { useJson } from '@/hooks/useJson';
import { KOHLI, SHARMA, WILLIAMSON } from '@/lib/defaults';
import { scopeName } from '@/lib/scope';
import type { Coverage, PlayerRef, VenueRef } from '@/lib/types';

type Pool = 'discovery' | 'shortlist';
type Phase = 'powerplay' | 'middle' | 'death';
type Gender = 'male' | 'female' | 'any';

type Answer = {
  role: Role;
  recommendation: string | null;
  caveats: string[];
  players: (Ranked | { player_id: string; unique_name: string; data_available: false })[];
};

type Slot = { key: number; player: PlayerRef | null };

const PHASES: { value: Phase; label: string }[] = [
  { value: 'powerplay', label: 'Powerplay' },
  { value: 'middle', label: 'Middle' },
  { value: 'death', label: 'Death' },
];
const ORDINALS = ['1st', '2nd', '3rd', '4th'];

export default function PicksPage() {
  return (
    <>
      <PageHeader icon={ListOrdered} title="Picks">
        Who is likely to do best in a given match? Rank batters or bowlers, then narrow it down by
        ground, opposition or match situation. These are projections from past balls, not fantasy
        points.
      </PageHeader>
      {/* the starting choices can come from the address */}
      <Suspense fallback={<Loading />}>
        <ForCompetition />
      </Suspense>
    </>
  );
}

/** Grounds and teams differ between competitions, so a switch starts afresh. */
function ForCompetition() {
  const { competition } = useApp();
  return <Picks key={competition} />;
}

function Picks() {
  const params = useSearchParams();
  const { competition, scope } = useApp();
  const test = scope.format === 'Test';

  const [role, setRole] = useState<Role>(params.get('role') === 'bowler' ? 'bowler' : 'batter');
  const [pool, setPool] = useState<Pool>('discovery');
  const [gender, setGender] = useState<Gender>('male');
  const [slots, setSlots] = useState<Slot[]>(() =>
    [KOHLI, SHARMA, WILLIAMSON].map((player, key) => ({ key, player })),
  );
  const nextKey = useRef(3);
  const [venue, setVenue] = useState<VenueRef | null>(null);
  const [opponent, setOpponent] = useState<PlayerRef | null>(null);
  const [opposition, setOpposition] = useState('');
  const [phase, setPhase] = useState<Phase | ''>(
    () => PHASES.find((p) => p.value === params.get('phase'))?.value ?? '',
  );
  const [innings, setInnings] = useState('');
  const [limit, setLimit] = useState(10);
  const [minSample, setMinSample] = useState(80);

  const coverage = useJson<Coverage>(`/api/coverage?competition=${competition}`);
  const teams = coverage.data?.teams ?? {};
  const sides =
    competition === 'ipl' || (pool === 'discovery' && gender !== 'any')
      ? [competition === 'ipl' ? 'male' : gender]
      : Object.keys(teams);
  const teamChoices = [...new Set(sides.flatMap((g) => teams[g] ?? []))].sort();

  // a choice that the format has no room for is left out
  const usePhase = test ? '' : phase;
  const inningsChoices = ORDINALS.slice(0, test ? 4 : 2);
  const useInnings = Number(innings) <= inningsChoices.length ? innings : '';

  const shortlist = slots.flatMap((s) => (s.player ? [s.player.player_id] : []));
  let url: string | null = null;
  if (pool === 'discovery' || shortlist.length > 0) {
    const query = new URLSearchParams({ role, ...scope });
    if (pool === 'shortlist') query.set('players', shortlist.join(','));
    else {
      query.set('gender', competition === 'ipl' ? 'male' : gender);
      query.set('limit', String(limit));
      query.set('min_sample', String(minSample));
    }
    if (venue) query.set('venue', venue.venue_id);
    if (opponent) query.set('opponent', opponent.player_id);
    if (opposition) query.set('opposition', opposition);
    if (usePhase) query.set('phase', usePhase);
    if (useInnings) query.set('innings', useInnings);
    url = `/api/recommend?${query}`;
  }
  const answer = useJson<Answer>(url, 300);

  const opponentRole = role === 'batter' ? 'bowler' : 'batter';
  const chips = [
    venue && { label: `At ${venue.name}`, clear: () => setVenue(null) },
    opposition && { label: `Against ${opposition}`, clear: () => setOpposition('') },
    opponent && {
      label: `${role === 'batter' ? 'Facing' : 'Bowling to'} ${opponent.unique_name}`,
      clear: () => setOpponent(null),
    },
    usePhase && {
      label: `${PHASES.find((p) => p.value === usePhase)!.label} overs`,
      clear: () => setPhase(''),
    },
    useInnings && {
      label: `${ORDINALS[Number(useInnings) - 1]} innings`,
      clear: () => setInnings(''),
    },
  ].filter((c) => !!c);

  const clearSituation = () => {
    setVenue(null);
    setOpponent(null);
    setOpposition('');
    setPhase('');
    setInnings('');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="h-fit space-y-4">
        <Card title="1. Who to rank">
          <Segmented<Role>
            label="Role"
            options={[
              { value: 'batter', label: 'Batters' },
              { value: 'bowler', label: 'Bowlers' },
            ]}
            value={role}
            onChange={(v) => {
              if (!v) return;
              setRole(v);
              setOpponent(null); // a bowler chosen for batters is no opponent for bowlers
            }}
          />
          <Segmented<Pool>
            label="From"
            options={[
              { value: 'discovery', label: 'Everyone' },
              { value: 'shortlist', label: 'My shortlist' },
            ]}
            value={pool}
            onChange={(v) => v && setPool(v)}
          />
          {pool === 'discovery' ? (
            <>
              <p className="text-[11px] text-zinc-500">
                Everyone with at least 300 balls on record, including players who have retired.
              </p>
              {competition === 'international' && (
                <Segmented<Gender>
                  label="Players"
                  options={[
                    { value: 'male', label: 'Men' },
                    { value: 'female', label: 'Women' },
                    { value: 'any', label: 'All' },
                  ]}
                  value={gender}
                  onChange={(v) => {
                    if (!v) return;
                    setGender(v);
                    setOpposition(''); // the list of teams changes with it
                  }}
                />
              )}
            </>
          ) : (
            <div className="space-y-2">
              {slots.map((slot, i) => (
                <div key={slot.key} className="flex items-center gap-2">
                  <div className="flex-1">
                    <PlayerSearch
                      selected={slot.player}
                      placeholder={`Shortlist player ${i + 1}`}
                      onSelect={(player) =>
                        setSlots((prev) =>
                          prev.map((s) => (s.key === slot.key ? { ...s, player } : s)),
                        )
                      }
                      clearable
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSlots((prev) => prev.filter((s) => s.key !== slot.key))}
                    className="p-1 text-zinc-500 hover:text-red-400"
                    aria-label={`Remove shortlist player ${i + 1}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const key = nextKey.current++;
                  setSlots((prev) => [...prev, { key, player: null }]);
                }}
                disabled={slots.length >= 20}
                className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-40"
              >
                <Plus size={14} /> Add to shortlist
              </button>
            </div>
          )}
        </Card>

        <Card title="2. The match" hint="All optional. Fill in what you know.">
          <VenueSearch label="Ground" selected={venue} onSelect={setVenue} />
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Opposition team</span>
            <select
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
              value={opposition}
              onChange={(e) => setOpposition(e.target.value)}
            >
              <option value="">Any team</option>
              {teamChoices.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <PlayerSearch
            label={`Opposing ${opponentRole}`}
            selected={opponent}
            onSelect={setOpponent}
            clearable
          />
          {!test && (
            <Segmented<Phase>
              label="Overs"
              options={PHASES}
              value={phase}
              onChange={setPhase}
              allowClear
            />
          )}
          <Segmented
            label="Innings"
            options={inningsChoices.map((label, i) => ({ value: String(i + 1), label }))}
            value={useInnings}
            onChange={setInnings}
            allowClear
          />
          {pool === 'discovery' && (
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-sky-400">
                More options
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumberField label="Players to show" value={limit} min={1} max={50} onChange={setLimit} />
                <NumberField
                  label="Fewest balls in each situation"
                  value={minSample}
                  min={0}
                  max={1000}
                  step={10}
                  onChange={setMinSample}
                />
              </div>
            </details>
          )}
        </Card>
      </div>

      <section aria-label="Ranking" aria-busy={url !== null && answer.loading} className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-semibold">
            {scopeName(scope)} {role === 'batter' ? 'batters' : 'bowlers'}
          </h2>
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.clear}
              aria-label={`Remove: ${chip.label}`}
              className="flex items-center gap-1.5 rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 hover:border-red-400"
            >
              {chip.label} <X size={12} aria-hidden />
            </button>
          ))}
          {chips.length > 0 ? (
            <button type="button" onClick={clearSituation} className="text-xs text-zinc-400 underline">
              Clear all
            </button>
          ) : (
            <span className="text-xs text-zinc-500">over their whole record</span>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Ranked by projected {VIEW[role].headline.label.toLowerCase()};{' '}
          {VIEW[role].higherIsBetter ? 'higher' : 'lower'} is better.
        </p>

        {url === null ? (
          <Empty>Add a player to your shortlist, or rank everyone.</Empty>
        ) : answer.error ? (
          <ErrorNote>{answer.error}</ErrorNote>
        ) : !answer.data ? (
          <Loading height="h-64" />
        ) : (
          <Ranking answer={answer.data} />
        )}

        <details className="text-xs leading-relaxed text-zinc-400">
          <summary className="cursor-pointer font-semibold text-sky-400">
            How are these worked out?
          </summary>
          <p className="mt-2 max-w-2xl">
            Each player starts from their own record in this competition. For every match detail you
            give, that figure is nudged by how they have done in that situation. The fewer balls
            there are to go on, the smaller the nudge. “Confidence” says how many balls support the
            narrowest detail you chose.
          </p>
        </details>
      </section>
    </div>
  );
}

function Ranking({ answer }: { answer: Answer }) {
  const view = VIEW[answer.role];
  const ranked = answer.players.filter((p): p is Ranked => p.data_available);
  const unavailable = answer.players.filter((p) => !p.data_available);
  const best = ranked[0]?.predicted[view.headline.key] ?? 0;

  return (
    <>
      {answer.caveats.length > 0 && (
        <Notes>
          {answer.caveats.map((caveat) => (
            <li key={caveat} className="flex gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>{caveat}</span>
            </li>
          ))}
        </Notes>
      )}
      {ranked.length === 0 ? (
        <Empty>No player has enough data for these choices. Remove one to widen the search.</Empty>
      ) : (
        <ol className="space-y-3">
          {ranked.map((p) => (
            <PickCard key={p.player_id} p={p} role={answer.role} best={best} />
          ))}
        </ol>
      )}
      {unavailable.length > 0 && (
        <p className="text-xs text-zinc-500">
          Not ranked, no data: {unavailable.map((p) => p.unique_name).join(', ')}
        </p>
      )}
    </>
  );
}

function Notes({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
      {children}
    </ul>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col justify-between">
      <span className="mb-1 block text-xs text-zinc-400">{label}</span>
      <input
        type="number"
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

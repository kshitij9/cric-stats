'use client';

import { Copy, Pencil, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import IplOnly from '@/components/IplOnly';
import { Card, Empty, ErrorNote, Loading, PageHeader, PRIMARY, SECONDARY } from '@/components/ui';
import { useJson } from '@/hooks/useJson';
import { day } from '@/lib/dates';
import { send } from '@/lib/team-client';
import {
  NAME_LENGTH,
  TEAM_SIZE,
  type Franchise,
  type LineUp,
  type Team,
  type TeamListing,
} from '@/lib/teams';

export default function TeamsPage() {
  return (
    <>
      <PageHeader icon={Users} title="Teams">
        Put together IPL sides of your own, from scratch or starting from a franchise. They are saved
        on the server, so every device sees them. Matching teams up on different grounds is not built
        yet.
      </PageHeader>
      <IplOnly>
        <Teams />
      </IplOnly>
    </>
  );
}

/** `name`, or `name (2)` and so on if it is taken. */
function freeName(name: string, teams: TeamListing[]) {
  const taken = new Set(teams.map((t) => t.name.toLowerCase()));
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : ` (${n})`;
    const candidate = [...name].slice(0, NAME_LENGTH - suffix.length).join('') + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function Teams() {
  // asked again, under a new address, after every change
  const [changes, setChanges] = useState(0);
  const list = useJson<TeamListing[]>(`/api/teams?after=${changes}`);
  const [kept, setKept] = useState<TeamListing[] | null>(null);
  // keep the last list on screen while the next one is on its way
  if (list.data && list.data !== kept) setKept(list.data);
  const teams = list.data ?? kept;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** One change at a time; the list is read again whether or not it worked. */
  const change = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setChanges((n) => n + 1);
    }
  };

  if (list.error) return <ErrorNote>{list.error}</ErrorNote>;
  if (!teams) return <Loading />;

  return (
    <>
      {error && <ErrorNote>{error}</ErrorNote>}
      <NewTeam teams={teams} busy={busy} change={change} />
      <Card title="Your teams">
        {teams.length === 0 ? (
          <Empty>No teams yet. Make one above.</Empty>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {teams.map((team) => (
              <TeamCard
                key={team.team_id}
                team={team}
                busy={busy}
                onCopy={() =>
                  change(async () => {
                    await send<Team>('POST', '/api/teams', {
                      name: freeName(`${team.name} copy`, teams),
                      players: team.players,
                    });
                  })
                }
                onDelete={() =>
                  change(() =>
                    send('DELETE', `/api/teams/${team.team_id}?version=${team.version}`),
                  )
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function NewTeam({
  teams,
  busy,
  change,
}: {
  teams: TeamListing[];
  busy: boolean;
  change: (work: () => Promise<void>) => Promise<void>;
}) {
  const router = useRouter();
  const franchises = useJson<Franchise[]>('/api/franchises');
  const [name, setName] = useState('');
  const [side, setSide] = useState('');

  const create = (event: FormEvent) => {
    event.preventDefault();
    change(async () => {
      const team = await send<Team>('POST', '/api/teams', { name });
      router.push(`/teams/${team.team_id}`);
    });
  };

  const copy = (event: FormEvent) => {
    event.preventDefault();
    change(async () => {
      const response = await fetch(`/api/franchises?team=${encodeURIComponent(side)}`);
      if (!response.ok) throw new Error('could not read that line-up');
      const lineUp: LineUp = await response.json();
      const team = await send<Team>('POST', '/api/teams', {
        name: freeName(lineUp.team, teams),
        players: lineUp.players,
      });
      router.push(`/teams/${team.team_id}?from=${encodeURIComponent(lineUp.team)}`);
    });
  };

  const input =
    'min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500';

  return (
    <Card title="New team">
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={create} className="min-w-0 space-y-1.5">
          <label htmlFor="team-name" className="block text-xs text-zinc-400">
            Start with an empty team
          </label>
          <div className="flex gap-2">
            <input
              id="team-name"
              className={input}
              placeholder="Team name"
              maxLength={NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className={PRIMARY} disabled={busy || !name.trim()}>
              Create
            </button>
          </div>
        </form>
        <form onSubmit={copy} className="min-w-0 space-y-1.5">
          <label htmlFor="franchise" className="block text-xs text-zinc-400">
            Or copy a franchise&rsquo;s latest line-up
          </label>
          <div className="flex gap-2">
            <select
              id="franchise"
              className={`${input} w-0`}
              value={side}
              onChange={(e) => setSide(e.target.value)}
            >
              <option value="">Choose a franchise</option>
              {franchises.data?.map((f) => (
                <option key={f.team} value={f.team}>
                  {f.team} ({day(f.last_match)})
                </option>
              ))}
            </select>
            <button type="submit" className={PRIMARY} disabled={busy || !side}>
              Copy
            </button>
          </div>
          {franchises.error && <p className="text-xs text-red-300">{franchises.error}</p>}
        </form>
      </div>
    </Card>
  );
}

function TeamCard({
  team,
  busy,
  onCopy,
  onDelete,
}: {
  team: TeamListing;
  busy: boolean;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const full = team.players.length === TEAM_SIZE;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words font-semibold">{team.name}</h3>
        <span className={`shrink-0 text-xs ${full ? 'text-emerald-300' : 'text-amber-300'}`}>
          {team.players.length} of {TEAM_SIZE}
        </span>
      </div>
      <p className="flex-1 text-xs leading-relaxed text-zinc-400">
        {team.names.join(', ') || 'No players yet'}
      </p>
      <div className="flex flex-wrap gap-2">
        {confirming ? (
          <>
            <span className="self-center text-xs text-zinc-300">Delete {team.name}?</span>
            <button
              type="button"
              className={`${SECONDARY} hover:border-red-500 hover:text-red-300`}
              disabled={busy}
              onClick={onDelete}
            >
              Yes, delete
            </button>
            <button type="button" className={SECONDARY} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </>
        ) : (
          <>
            <Link className={SECONDARY} href={`/teams/${team.team_id}`}>
              <Pencil size={14} aria-hidden /> Edit
            </Link>
            <button type="button" className={SECONDARY} disabled={busy} onClick={onCopy}>
              <Copy size={14} aria-hidden /> Copy
            </button>
            <button type="button" className={SECONDARY} onClick={() => setConfirming(true)}>
              <Trash2 size={14} aria-hidden /> Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

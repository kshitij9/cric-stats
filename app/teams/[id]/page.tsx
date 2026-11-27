'use client';

import { AlertTriangle, ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState, type FormEvent } from 'react';
import IplOnly from '@/components/IplOnly';
import PlayerSearch from '@/components/PlayerSearch';
import TeamMember from '@/components/TeamMember';
import { Card, Empty, ErrorNote, Loading, PageHeader, SECONDARY } from '@/components/ui';
import { useJson } from '@/hooks/useJson';
import { useSquad } from '@/hooks/useSquad';
import { day } from '@/lib/dates';
import { send } from '@/lib/team-client';
import {
  BOWLERS_NEEDED,
  NAME_LENGTH,
  RECENT_MATCHES,
  TEAM_SIZE,
  type LineUp,
  type Team,
  type TeamDraft,
} from '@/lib/teams';
import type { PlayerRef } from '@/lib/types';

export default function TeamPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <PageHeader icon={Users} title="Edit team">
        List the players in batting order. Every change is saved as you make it.
      </PageHeader>
      <Link href="/teams" className={SECONDARY}>
        <ArrowLeft size={14} aria-hidden /> All teams
      </Link>
      <IplOnly>
        <Loader key={id} id={id} />
      </IplOnly>
    </>
  );
}

function Loader({ id }: { id: string }) {
  const found = useJson<Team>(`/api/teams/${encodeURIComponent(id)}`);
  if (found.error) return <ErrorNote>{found.error}</ErrorNote>;
  if (!found.data) return <Loading />;
  return (
    // the franchise copied from, if any, is in the address
    <Suspense fallback={<Loading />}>
      <Editor initial={found.data} />
    </Suspense>
  );
}

function Editor({ initial }: { initial: Team }) {
  const from = useSearchParams().get('from');
  const [team, setTeam] = useState(initial); // as the server last gave it
  const [shown, setShown] = useState<TeamDraft>(initial); // with the change being saved
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, string>>({}); // names from the search
  const busy = useRef(false);
  const { known, error: squadError } = useSquad(shown.players);

  const nameOf = (playerId: string) =>
    known[playerId]?.unique_name ?? added[playerId] ?? 'Unknown player';

  /** Shows a change at once and saves it; puts things back if it is refused. */
  const save = async (change: Partial<TeamDraft>) => {
    if (busy.current) return;
    busy.current = true;
    const next = { name: team.name, players: team.players, ...change };
    setShown(next);
    setStatus('saving');
    setError(null);
    const url = `/api/teams/${team.team_id}`;
    try {
      const saved = await send<Team>('PUT', url, { ...next, version: team.version });
      setTeam(saved);
      setShown(saved);
      setStatus('saved');
    } catch (err) {
      setError((err as Error).message);
      setStatus('idle');
      // show what is really saved; it may have been changed on another device
      const response = await fetch(url).catch(() => null);
      const current: Team = response?.ok ? await response.json() : team;
      setTeam(current);
      setShown(current);
    } finally {
      busy.current = false;
    }
  };

  const { players } = shown;
  const full = players.length >= TEAM_SIZE;

  const add = (player: PlayerRef) => {
    if (players.includes(player.player_id)) {
      setError(`${player.unique_name} is already in this team`);
      return;
    }
    setAdded((old) => ({ ...old, [player.player_id]: player.unique_name }));
    save({ players: [...players, player.player_id] });
  };

  const move = (index: number, step: -1 | 1) => {
    const order = [...players];
    [order[index], order[index + step]] = [order[index + step], order[index]];
    save({ players: order });
  };

  const loaded = players.every((p) => p in known);
  const bowlers = players.filter((p) => known[p]?.bowls_regularly).length;

  return (
    <>
      {error && <ErrorNote>{error}</ErrorNote>}
      {squadError && <ErrorNote>{squadError}</ErrorNote>}
      {from && <CopiedFrom franchise={from} players={players} />}

      <Card
        actions={
          <p role="status" className="text-xs text-zinc-500">
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'All changes saved' : ''}
          </p>
        }
        title={`${players.length} of ${TEAM_SIZE} players`}
      >
        <Rename key={team.name} name={shown.name} onSave={(name) => save({ name })} />

        {players.length === 0 ? (
          <Empty>No players yet. Add one below.</Empty>
        ) : (
          <ol aria-label="Batting order" className="space-y-2">
            {players.map((playerId, i) => (
              <TeamMember
                key={playerId}
                position={i + 1}
                name={nameOf(playerId)}
                player={known[playerId]}
                first={i === 0}
                last={i === players.length - 1}
                onMove={(step) => move(i, step)}
                onRemove={() => save({ players: players.filter((p) => p !== playerId) })}
              />
            ))}
          </ol>
        )}

        {full ? (
          <p className="text-xs text-zinc-500">The team is full. Remove a player to add another.</p>
        ) : (
          <div className="max-w-md">
            <PlayerSearch label="Add a player" selected={null} onSelect={(p) => p && add(p)} />
          </div>
        )}
      </Card>

      <Card title="Balance">
        <p className="text-sm text-zinc-300">
          {loaded
            ? `${bowlers} ${bowlers === 1 ? 'player bowls' : 'players bowl'} regularly.`
            : 'Counting bowlers…'}
        </p>
        {full && loaded && bowlers < BOWLERS_NEEDED && (
          <p className="flex items-start gap-2 text-sm text-amber-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            Fewer than {BOWLERS_NEEDED}: at four overs each, this side may struggle to bowl twenty.
          </p>
        )}
        <p className="text-xs leading-relaxed text-zinc-500">
          &ldquo;Bowls&rdquo; means in at least half of a player&rsquo;s last {RECENT_MATCHES} IPL
          matches. Overseas limits and wicketkeepers are not checked, as the data records neither
          nationality nor roles.
        </p>
      </Card>
    </>
  );
}

function Rename({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [typed, setTyped] = useState(name);
  const changed = typed.trim() !== '' && typed.trim() !== name;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (changed) onSave(typed);
  };
  return (
    <form onSubmit={submit} className="max-w-md space-y-1.5">
      <label htmlFor="rename" className="block text-xs text-zinc-400">
        Team name
      </label>
      <div className="flex gap-2">
        <input
          id="rename"
          className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          maxLength={NAME_LENGTH}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button type="submit" className={SECONDARY} disabled={!changed}>
          Rename
        </button>
      </div>
    </form>
  );
}

/** Where a copied team came from, and who did not fit. */
function CopiedFrom({ franchise, players }: { franchise: string; players: string[] }) {
  const { data } = useJson<LineUp>(`/api/franchises?team=${encodeURIComponent(franchise)}`);
  if (!data) return null;
  const left = data.left_out.filter((p) => !players.includes(p.player_id));
  return (
    <p className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-sm leading-relaxed text-sky-200">
      Copied from {data.team}&rsquo;s line-up on {day(data.last_match)}. Check the batting order:
      players who did not bat are placed by where they usually do.
      {left.length > 0 &&
        ` That match listed more than ${TEAM_SIZE} (impact player rule), so ${left
          .map((p) => p.unique_name)
          .join(' and ')} was left out. To swap, remove someone and add them.`}
    </p>
  );
}

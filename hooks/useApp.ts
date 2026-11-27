'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { MAX_COMPARE } from '@/lib/colors';
import { KOHLI, SHARMA } from '@/lib/defaults';
import { isCompetition, isFormat } from '@/lib/scope';
import type { Competition, Format, PlayerRef, Scope } from '@/lib/types';

/**
 * What the whole app is looking at: the competition and format, the player being
 * viewed and the players being compared. Kept in the browser, so it carries over
 * between screens and visits.
 */

/** `slot` fixes a compared player's colour while others come and go. */
export type Compared = PlayerRef & { slot: number };

type State = {
  competition: Competition;
  intlFormat: Format; // remembered while the IPL is shown
  player: PlayerRef;
  compared: Compared[];
};

const DEFAULT: State = {
  competition: 'ipl',
  intlFormat: 'T20',
  player: KOHLI,
  compared: [
    { ...KOHLI, slot: 0 },
    { ...SHARMA, slot: 1 },
  ],
};

const KEY = 'cricintell.v1';
const listeners = new Set<() => void>();
let cache: State | null = null;

const isPlayer = (p: unknown): p is PlayerRef => {
  const ref = p as PlayerRef | null;
  return (
    typeof ref?.player_id === 'string' &&
    /^[0-9a-f]{8}(-[mf])?$/.test(ref.player_id) &&
    typeof ref.name === 'string' &&
    typeof ref.unique_name === 'string'
  );
};

/** Whatever was saved, keeping only the parts that still make sense. */
function restore(saved: Partial<State>): State {
  const compared = Array.isArray(saved.compared)
    ? saved.compared.filter((p) => isPlayer(p) && p.slot >= 0 && p.slot < MAX_COMPARE)
    : DEFAULT.compared;
  return {
    competition: isCompetition(String(saved.competition))
      ? saved.competition!
      : DEFAULT.competition,
    intlFormat: isFormat(String(saved.intlFormat)) ? saved.intlFormat! : DEFAULT.intlFormat,
    player: isPlayer(saved.player) ? saved.player : DEFAULT.player,
    compared,
  };
}

function read(): State {
  if (cache) return cache;
  try {
    const saved = window.localStorage.getItem(KEY);
    cache = saved ? restore(JSON.parse(saved)) : DEFAULT;
  } catch {
    cache = DEFAULT;
  }
  return cache;
}

function write(change: (state: State) => Partial<State>) {
  cache = { ...read(), ...change(read()) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage may be unavailable; the choice still holds for this visit
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const ref = ({ player_id, name, unique_name }: PlayerRef) => ({ player_id, name, unique_name });

const actions = {
  setCompetition: (competition: Competition) => write(() => ({ competition })),
  setFormat: (intlFormat: Format) => write(() => ({ intlFormat })),
  setPlayer: (player: PlayerRef) => write(() => ({ player: ref(player) })),
  /** Adds to the comparison, if there is room and the player is not in it. */
  addCompared: (player: PlayerRef) =>
    write(({ compared }) => {
      if (compared.some((p) => p.player_id === player.player_id)) return {};
      const slot = Array.from({ length: MAX_COMPARE }, (_, i) => i).find(
        (i) => !compared.some((p) => p.slot === i),
      );
      return slot === undefined ? {} : { compared: [...compared, { ...ref(player), slot }] };
    }),
  removeCompared: (playerId: string) =>
    write(({ compared }) => ({ compared: compared.filter((p) => p.player_id !== playerId) })),
  replaceCompared: (players: PlayerRef[]) =>
    write(() => ({
      compared: players.slice(0, MAX_COMPARE).map((p, slot) => ({ ...ref(p), slot })),
    })),
};

export function useApp() {
  // the server, and the first paint, use the defaults
  const state = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const format = state.competition === 'ipl' ? 'T20' : state.intlFormat;
  const scope = useMemo<Scope>(
    () => ({ format, competition: state.competition }),
    [format, state.competition],
  );
  return { ...state, scope, ...actions };
}

/**
 * Saved teams: their shape and the rules a team must meet. Safe to import from
 * pages.
 */

export const TEAM_SIZE = 11;
export const MAX_TEAMS = 100;
export const NAME_LENGTH = 60;

/** Fewer than this many regular bowlers and a side may struggle for 20 overs. */
export const BOWLERS_NEEDED = 5;
/** "Bowls regularly": in at least half of this many of a player's latest matches. */
export const RECENT_MATCHES = 20;

/** What a person chooses; the rest is added when it is saved. */
export type TeamDraft = {
  name: string;
  players: string[]; // player IDs, in batting order; up to TEAM_SIZE
};

export type Team = TeamDraft & {
  team_id: number;
  competition: 'ipl';
  gender: 'male';
  version: number;
  updated_at: string;
};

/** A team with enough about its players to list it. */
export type TeamListing = Team & { names: string[] };

/** What the builder shows about a player, all from one competition. */
export type SquadPlayer = {
  player_id: string;
  name: string;
  unique_name: string;
  teams: string[]; // most recent first
  matches: number;
  last_match: string; // YYYY-MM-DD
  batting: { runs: number; average: number | null; strike_rate: number | null };
  bowling: { balls: number; wickets: number; economy: number | null };
  recent_matches: number; // of the latest RECENT_MATCHES played
  recent_bowled: number; // how many of those they bowled in
  bowls_regularly: boolean;
};

export type Franchise = { team: string; last_match: string };

/** A franchise's latest line-up, in a suggested batting order. */
export type LineUp = Franchise & {
  players: string[];
  /** Named in that match but not among the eleven (impact player rule). */
  left_out: { player_id: string; unique_name: string }[];
};

const PLAYER_ID = /^[0-9a-f]{8}(-[mf])?$/;

/** The draft sent by a page, or why it cannot be saved. */
export function parseDraft(value: unknown): TeamDraft | { error: string } {
  const raw = (value ?? {}) as Record<string, unknown>;
  if (typeof raw.name !== 'string') return { error: 'give the team a name' };
  // control characters, and runs of spaces, would make look-alike names
  const name = raw.name.replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ').trim();
  if (!name) return { error: 'give the team a name' };
  if ([...name].length > NAME_LENGTH) {
    return { error: `a name can be at most ${NAME_LENGTH} characters` };
  }
  const players = raw.players ?? [];
  if (!Array.isArray(players) || !players.every((p) => typeof p === 'string' && PLAYER_ID.test(p))) {
    return { error: 'players must be a list of player IDs' };
  }
  if (players.length > TEAM_SIZE) return { error: `a team has at most ${TEAM_SIZE} players` };
  if (new Set(players).size !== players.length) {
    return { error: 'a player can be in a team only once' };
  }
  return { name, players: players as string[] };
}

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { recommend, type Ctx, type Role } from '@/lib/recommend';
import { parseScope } from '@/lib/scope';
import { findPlayers, isPlayerId } from '@/lib/stats';
import type { Scope } from '@/lib/types';

/**
 * GET/POST /api/recommend
 *
 *   role        'batter' (default) | 'bowler'
 *   format      Test | ODI | T20                (required)
 *   competition international (default) | ipl   (ipl needs format T20)
 *   players     player IDs, comma list / array  (omit => discovery: rank the field)
 *   venue       venue ID
 *   opponent    player ID of the named opponent — for role=batter a bowler, for
 *               role=bowler a batter. Also accepted as `bowler` / `batter`.
 *   opposition  opposing team name (in the IPL, any name the franchise has used)
 *   phase       powerplay | middle | death      (ignored for Test)
 *   innings     1..4
 *   gender      male (default) | female | any   (discovery only: a shortlist
 *               already names who is meant)
 *   limit       discovery result count (default 10, max 50)
 *   min_sample  discovery: min balls per requested slice (default 40)
 */

const PHASES = new Set(['powerplay', 'middle', 'death']);
const ROLES = new Set<Role>(['batter', 'bowler']);
const GENDERS = new Set(['male', 'female', '']); // '' => both

type Parsed = {
  role: Role;
  scope: Scope;
  players: string[] | null; // player IDs
  ctx: Ctx;
  limit: number;
  minSample: number;
};

function parseInput(raw: Record<string, unknown>): Parsed | { error: string } {
  const role = (String(raw.role ?? 'batter').trim() || 'batter') as Role;
  if (!ROLES.has(role)) return { error: `role must be one of ${[...ROLES].join(', ')}` };

  const scope = parseScope(raw.format, raw.competition);
  if ('error' in scope) return scope;

  let players: string[] | null = null;
  let raw_players: unknown = raw.players;
  if (typeof raw_players === 'string') raw_players = raw_players.split(',');
  if (Array.isArray(raw_players)) {
    const cleaned = [...new Set(raw_players.map((p) => String(p).trim()).filter(Boolean))];
    if (cleaned.length > 20) return { error: 'at most 20 players' };
    if (!cleaned.every(isPlayerId)) return { error: 'players must be player IDs' };
    if (cleaned.length > 0) players = cleaned;
  }

  const c = (raw.context ?? raw) as Record<string, unknown>;

  const phaseRaw = String(c.phase ?? '').trim().toLowerCase();
  if (phaseRaw && !PHASES.has(phaseRaw)) {
    return { error: `phase must be one of ${[...PHASES].join(', ')}` };
  }

  let innings = Math.trunc(Number(c.innings ?? 0)) || 0;
  if (innings < 0 || innings > 4) innings = 0;

  let limit = Math.trunc(Number(raw.limit ?? 10)) || 10;
  limit = Math.max(1, Math.min(50, limit));

  let minSample = Math.trunc(Number(raw.min_sample ?? 40));
  if (!Number.isFinite(minSample) || minSample < 0) minSample = 40;
  minSample = Math.min(1000, minSample);

  const opponent = String(
    c.opponent ?? (role === 'batter' ? c.bowler : c.batter) ?? '',
  ).trim();
  if (opponent && !isPlayerId(opponent)) return { error: 'opponent must be a player ID' };

  let gender = String(raw.gender ?? 'male').trim().toLowerCase();
  if (gender === 'any' || gender === 'all' || gender === 'both') gender = '';
  if (!GENDERS.has(gender)) return { error: `gender must be male, female or any` };
  if (players) gender = '';

  return {
    role,
    scope,
    players,
    limit,
    minSample,
    ctx: {
      venue: String(c.venue ?? '').trim(),
      opponent,
      opposition: String(c.opposition ?? '').trim(),
      phase: scope.format === 'Test' ? '' : phaseRaw,
      innings,
      gender,
    },
  };
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

async function handle(raw: Record<string, unknown>) {
  const parsed = parseInput(raw);
  if ('error' in parsed) return bad(parsed.error);

  // an unknown ID would otherwise look like a player or ground with no history
  const { players: ids, ctx } = parsed;
  const found = await findPlayers([...(ids ?? []), ...(ctx.opponent ? [ctx.opponent] : [])]);
  const unknown = [...(ids ?? []), ctx.opponent].filter((id) => id && !found.has(id));
  if (unknown.length) return bad(`unknown player: ${unknown.join(', ')}`);
  if (ctx.venue) {
    const venue = await query(`SELECT 1 FROM venues WHERE venue_id = $1`, [ctx.venue]);
    if (!venue.length) return bad('unknown venue ID');
  }

  const out = await recommend({ ...parsed, players: ids?.map((id) => found.get(id)!) ?? null });
  return NextResponse.json(out);
}

export async function POST(request: Request) {
  try {
    return await handle(await request.json());
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not run the recommender' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    return await handle({
      role: sp.get('role'),
      format: sp.get('format'),
      competition: sp.get('competition'),
      players: sp.get('players'),
      gender: sp.get('gender'),
      limit: sp.get('limit'),
      min_sample: sp.get('min_sample'),
      context: {
        venue: sp.get('venue'),
        opponent: sp.get('opponent'),
        bowler: sp.get('bowler'),
        batter: sp.get('batter'),
        opposition: sp.get('opposition'),
        phase: sp.get('phase'),
        innings: sp.get('innings'),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not run the recommender' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { recommend, type Ctx, type Role } from '@/lib/recommend';

/**
 * GET/POST /api/recommend
 *
 *   role        'batter' (default) | 'bowler'
 *   format      Test | ODI | T20                (required)
 *   players     comma list / array              (omit => discovery: rank the field)
 *   venue       exact venue name
 *   opponent    the named opponent — for role=batter a bowler, for role=bowler a
 *               batter. Also accepted as `bowler` / `batter`.
 *   opposition  opposing team name
 *   phase       powerplay | middle | death      (ignored for Test)
 *   innings     1..4
 *   gender      male (default) | female | any
 *   limit       discovery result count (default 10, max 50)
 *   min_sample  discovery: min balls per requested slice (default 40)
 */

const FORMATS = new Set(['Test', 'ODI', 'T20']);
const PHASES = new Set(['powerplay', 'middle', 'death']);
const ROLES = new Set<Role>(['batter', 'bowler']);
const GENDERS = new Set(['male', 'female', '']); // '' => both

type Parsed = {
  role: Role;
  format: string;
  players: string[] | null;
  ctx: Ctx;
  limit: number;
  minSample: number;
};

function parseInput(raw: Record<string, unknown>): Parsed | { error: string } {
  const role = (String(raw.role ?? 'batter').trim() || 'batter') as Role;
  if (!ROLES.has(role)) return { error: `role must be one of ${[...ROLES].join(', ')}` };

  const format = String(raw.format ?? '').trim();
  if (!FORMATS.has(format)) {
    return { error: `format must be one of ${[...FORMATS].join(', ')}` };
  }

  let players: string[] | null = null;
  let raw_players: unknown = raw.players;
  if (typeof raw_players === 'string') raw_players = raw_players.split(',');
  if (Array.isArray(raw_players)) {
    const cleaned = raw_players.map((p) => String(p).trim()).filter(Boolean);
    if (cleaned.length > 20) return { error: 'at most 20 players' };
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

  let gender = String(raw.gender ?? 'male').trim().toLowerCase();
  if (gender === 'any' || gender === 'all' || gender === 'both') gender = '';
  if (!GENDERS.has(gender)) return { error: `gender must be male, female or any` };

  return {
    role,
    format,
    players,
    limit,
    minSample,
    ctx: {
      venue: String(c.venue ?? '').trim(),
      opponent,
      opposition: String(c.opposition ?? '').trim(),
      phase: format === 'Test' ? '' : phaseRaw,
      innings,
      gender,
    },
  };
}

async function handle(raw: Record<string, unknown>) {
  const parsed = parseInput(raw);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const out = await recommend(parsed);
  return NextResponse.json(out);
}

export async function POST(request: Request) {
  try {
    return await handle(await request.json());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    return await handle({
      role: sp.get('role'),
      format: sp.get('format'),
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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

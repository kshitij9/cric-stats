import { NextResponse } from 'next/server';
import {
  career,
  eraByYear,
  findPlayers,
  isFormat,
  isPlayerId,
  matchups,
  FORMATS,
  type Format,
  type Player,
} from '@/lib/stats';

/**
 * GET /api/stats/{type}?id=<player id>&format=<Test|ODI|T20>
 *
 *   career, player_full_profile   [career batting figures] (empty if none)
 *   era                           era index for each year
 *   matchup                       the bowlers who have dismissed the batter most
 *
 * What each figure means is defined in lib/stats.ts.
 */

const careerRows = async (player: Player, format: Format) => {
  const row = await career(player, format);
  return row ? [row] : [];
};

const QUERIES: Record<string, (player: Player, format: Format) => Promise<unknown[]>> = {
  career: careerRows,
  player_full_profile: careerRows,
  era: eraByYear,
  matchup: matchups,
};

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (!Object.hasOwn(QUERIES, type)) return fail(404, 'Invalid type');

  const searchParams = new URL(request.url).searchParams;
  const id = searchParams.get('id') ?? '';
  const format = searchParams.get('format') ?? '';
  if (!isPlayerId(id)) return fail(400, 'id must be a player ID');
  if (!isFormat(format)) return fail(400, `format must be one of ${FORMATS.join(', ')}`);

  try {
    const player = (await findPlayers([id])).get(id);
    if (!player) return fail(404, 'unknown player');
    return NextResponse.json(await QUERIES[type](player, format));
  } catch (err) {
    console.error(err);
    return fail(500, 'could not read the statistics');
  }
}

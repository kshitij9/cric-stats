import { NextResponse } from 'next/server';
import { findGround } from '@/lib/ground';
import { matchup } from '@/lib/matchup';
import { answer, positive, refuse } from '@/lib/team-api';
import { getTeam } from '@/lib/team-store';

/**
 * GET /api/matchup?a=<team ID>&b=<team ID>&venue=<venue ID, optional>
 *
 * The two teams' players: their IPL records, their records at the ground if one
 * is given, and who has met whom. No prediction.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const a = positive(params.get('a'));
  const b = positive(params.get('b'));
  if (!a || !b) return refuse(400, 'choose two teams: a and b');
  if (a === b) return refuse(400, 'choose two different teams');
  const venueId = (params.get('venue') ?? '').slice(0, 120);
  return answer(async () => {
    const teams = await Promise.all([getTeam(a), getTeam(b)]);
    const venue = venueId ? await findGround(venueId) : null;
    if (venueId && !venue) return refuse(404, 'no IPL ground with that ID');
    return NextResponse.json(await matchup([teams[0], teams[1]], venue));
  }, 'could not match the teams up');
}

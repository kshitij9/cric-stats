import { NextResponse } from 'next/server';
import { faceOff } from '@/lib/faceoff';
import { findGround } from '@/lib/ground';
import { answer, positive, refuse } from '@/lib/team-api';
import { getTeam } from '@/lib/team-store';

/**
 * GET /api/matchup/faceoff?a=<team ID>&b=<team ID>&venue=<venue ID, optional>
 *                         &seasons=<recent|all>
 *
 * Each team's batting and bowling by phase, at every ground and at the one
 * given. What is counted is described in lib/faceoff.ts. No prediction.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const a = positive(params.get('a'));
  const b = positive(params.get('b'));
  if (!a || !b) return refuse(400, 'choose two teams: a and b');
  if (a === b) return refuse(400, 'choose two different teams');
  const seasons = params.get('seasons') ?? 'recent';
  if (seasons !== 'recent' && seasons !== 'all') {
    return refuse(400, 'seasons must be recent or all');
  }
  const venueId = (params.get('venue') ?? '').slice(0, 120);
  return answer(async () => {
    const teams = await Promise.all([getTeam(a), getTeam(b)]);
    const venue = venueId ? await findGround(venueId) : null;
    if (venueId && !venue) return refuse(404, 'no IPL ground with that ID');
    return NextResponse.json(await faceOff([teams[0], teams[1]], venue, seasons));
  }, 'could not compare the teams');
}

import { NextResponse } from 'next/server';
import { findGround, groundProfile } from '@/lib/ground';
import { answer, refuse } from '@/lib/team-api';

/**
 * GET /api/matchup/ground?venue=<venue ID>&seasons=<recent|all>
 *
 * How the ground plays in the IPL, against the others in the same seasons.
 * What is counted is described in lib/ground.ts.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const seasons = params.get('seasons') ?? 'recent';
  if (seasons !== 'recent' && seasons !== 'all') {
    return refuse(400, 'seasons must be recent or all');
  }
  return answer(async () => {
    const venue = await findGround((params.get('venue') ?? '').slice(0, 120));
    if (!venue) return refuse(404, 'no IPL ground with that ID');
    return NextResponse.json(await groundProfile(venue, seasons));
  }, 'could not read the ground');
}

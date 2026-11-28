import { NextResponse } from 'next/server';
import { findGround } from '@/lib/ground';
import { franchiseSpans, rivalry } from '@/lib/rivalry';
import { answer, refuse } from '@/lib/team-api';

/**
 * GET /api/rivalry?a=<franchise>&b=<franchise>&venue=<venue ID, optional>
 *                 &seasons=<all|recent>
 *
 * The record between two IPL franchises, their meetings and who did most in
 * them. What counts is described in lib/rivalry.ts.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const a = (params.get('a') ?? '').slice(0, 80);
  const b = (params.get('b') ?? '').slice(0, 80);
  if (!a || !b) return refuse(400, 'choose two franchises: a and b');
  if (a === b) return refuse(400, 'choose two different franchises');
  const seasons = params.get('seasons') ?? 'all';
  if (seasons !== 'recent' && seasons !== 'all') {
    return refuse(400, 'seasons must be recent or all');
  }
  const venueId = (params.get('venue') ?? '').slice(0, 120);
  return answer(async () => {
    const known = new Set((await franchiseSpans()).map((f) => f.team));
    const unknown = [a, b].find((team) => !known.has(team));
    if (unknown !== undefined) return refuse(404, 'unknown franchise');
    const venue = venueId ? await findGround(venueId) : null;
    if (venueId && !venue) return refuse(404, 'no IPL ground with that ID');
    return NextResponse.json(await rivalry([a, b], venue, seasons));
  }, 'could not read the rivalry');
}

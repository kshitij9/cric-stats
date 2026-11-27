import { NextResponse } from 'next/server';
import { parseCompetition } from '@/lib/scope';
import { searchVenues } from '@/lib/search';

/** GET /api/venues?q=<ground or city, or part of it>&competition=<international|ipl> */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const text = params.get('q') ?? '';
  const competition = parseCompetition(params.get('competition'));
  if (typeof competition !== 'string') {
    return NextResponse.json(competition, { status: 400 });
  }
  try {
    return NextResponse.json(await searchVenues(text.slice(0, 120), competition));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not search venues' }, { status: 500 });
  }
}

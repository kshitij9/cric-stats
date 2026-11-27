import { NextResponse } from 'next/server';
import { coverage } from '@/lib/coverage';
import { parseCompetition } from '@/lib/scope';

// read from the database on each request, never at build time
export const dynamic = 'force-dynamic';

/**
 * GET /api/coverage?competition=<international|ipl>: the period and teams the
 * loaded data covers.
 */
export async function GET(request: Request) {
  const competition = parseCompetition(new URL(request.url).searchParams.get('competition'));
  if (typeof competition !== 'string') {
    return NextResponse.json(competition, { status: 400 });
  }
  try {
    return NextResponse.json(await coverage(competition));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not read the data coverage' }, { status: 500 });
  }
}

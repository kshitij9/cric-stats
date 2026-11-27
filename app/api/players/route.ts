import { NextResponse } from 'next/server';
import { parseCompetition } from '@/lib/scope';
import { searchPlayers } from '@/lib/search';

/** GET /api/players?q=<name or part of it>&gender=<male|female>&competition=<international|ipl> */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const gender = params.get('gender') ?? '';
  if (!['', 'male', 'female'].includes(gender)) {
    return NextResponse.json({ error: 'gender must be male or female' }, { status: 400 });
  }
  const competition = parseCompetition(params.get('competition'));
  if (typeof competition !== 'string') {
    return NextResponse.json(competition, { status: 400 });
  }
  try {
    const text = (params.get('q') ?? '').slice(0, 80);
    return NextResponse.json(await searchPlayers(text, competition, gender));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not search players' }, { status: 500 });
  }
}

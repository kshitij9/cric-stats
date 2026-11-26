import { NextResponse } from 'next/server';
import { searchPlayers } from '@/lib/search';

/** GET /api/players?q=<name or part of it>&gender=<male|female> */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const gender = params.get('gender') ?? '';
  if (!['', 'male', 'female'].includes(gender)) {
    return NextResponse.json({ error: 'gender must be male or female' }, { status: 400 });
  }
  try {
    return NextResponse.json(await searchPlayers((params.get('q') ?? '').slice(0, 80), gender));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not search players' }, { status: 500 });
  }
}

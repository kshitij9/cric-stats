import { NextResponse } from 'next/server';
import { searchVenues } from '@/lib/search';

/** GET /api/venues?q=<ground or city, or part of it> */
export async function GET(request: Request) {
  const text = new URL(request.url).searchParams.get('q') ?? '';
  try {
    return NextResponse.json(await searchVenues(text.slice(0, 120)));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not search venues' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { franchises, lineUp } from '@/lib/squad';

/**
 * GET /api/franchises            the sides of the latest IPL season
 * GET /api/franchises?team=      that side's latest line-up, in batting order
 */
export async function GET(request: Request) {
  const team = new URL(request.url).searchParams.get('team');
  try {
    if (team === null) return NextResponse.json(await franchises());
    const found = await lineUp(team.slice(0, 80));
    return found
      ? NextResponse.json(found)
      : NextResponse.json({ error: 'unknown franchise' }, { status: 404 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not read the franchises' }, { status: 500 });
  }
}

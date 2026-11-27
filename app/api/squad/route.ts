import { NextResponse } from 'next/server';
import { squad } from '@/lib/squad';
import { isPlayerId } from '@/lib/stats';
import { TEAM_SIZE } from '@/lib/teams';

/** GET /api/squad?ids=<up to eleven player IDs>   their IPL records, in that order */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean);
  if (ids.length > TEAM_SIZE || !ids.every(isPlayerId)) {
    return NextResponse.json(
      { error: `ids must be at most ${TEAM_SIZE} player IDs` },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await squad([...new Set(ids)]));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not read the players' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { franchiseSpans } from '@/lib/rivalry';
import { answer } from '@/lib/team-api';

// asked of the database each time: a load can change the answer
export const dynamic = 'force-dynamic';

/** GET /api/rivalry/franchises   every IPL franchise there has been */
export async function GET() {
  return answer(
    async () => NextResponse.json(await franchiseSpans()),
    'could not read the franchises',
  );
}

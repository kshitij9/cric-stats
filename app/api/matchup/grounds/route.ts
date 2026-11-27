import { NextResponse } from 'next/server';
import { currentGrounds } from '@/lib/ground';
import { answer } from '@/lib/team-api';

// asked of the database each time: a load can change the answer
export const dynamic = 'force-dynamic';

/** GET /api/matchup/grounds   the IPL grounds of the latest season */
export async function GET() {
  return answer(
    async () => NextResponse.json(await currentGrounds()),
    'could not read the grounds',
  );
}

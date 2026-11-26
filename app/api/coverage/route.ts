import { NextResponse } from 'next/server';
import { coverage } from '@/lib/coverage';

// read from the database on each request, never at build time
export const dynamic = 'force-dynamic';

/** GET /api/coverage: the period and teams the loaded data covers. */
export async function GET() {
  try {
    return NextResponse.json(await coverage());
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'could not read the data coverage' }, { status: 500 });
  }
}
